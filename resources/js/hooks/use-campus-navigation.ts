import { useCallback, useEffect, useRef, useState } from 'react';
import type { CampusMapPoint } from '@/components/campus-map';
import type { GeoProjector } from '@/lib/campus-geo';
import { compassDirection } from '@/lib/campus-geo';
import {
    buildGuide,
    instructionAt,
    locateOnRoute,
    spokenDistance,
    TURN_NOW_METERS,
} from '@/lib/campus-route';
import type { MapPoint, Meters, RouteGuide } from '@/lib/campus-route';

// Phone GPS wanders 5–15 m, so only re-route when clearly off the path,
// and only after two readings in a row agree.
const OFF_ROUTE_METERS = 15;
const OFF_ROUTE_READINGS = 2;
// Close enough to the end of the route to count as arrived.
const ARRIVED_METERS = 8;
// When to give the heads-up for the next turn.
const ANNOUNCE_AHEAD_METERS = 30;
// Turn the camera toward the next leg this close to a corner.
const TURN_CAMERA_EARLY_METERS = 4;
const WALKING_SPEED = 1.3; // metres per second

type Router = { route: (from: MapPoint, to: MapPoint) => MapPoint[] | null };

type Trip = {
    destination: CampusMapPoint;
    guide: RouteGuide;
    arrived: boolean;
    /** Metres walked along the route; never goes backwards. */
    along: number;
    /** Leg the walker is on. */
    leg: number;
    offRouteReadings: number;
    /** Prompts already spoken, so each is said once. */
    announced: string[];
};

type Prompt = { id: number; text: string };

type Planner = {
    plan: (from: MapPoint, to: CampusMapPoint) => RouteGuide | null;
    toMeters: (p: MapPoint) => Meters;
};

let promptId = 0;
const prompt = (text: string): Prompt => ({ id: ++promptId, text });

export function newTrip(destination: CampusMapPoint, guide: RouteGuide): Trip {
    return {
        destination,
        guide,
        arrived: false,
        along: 0,
        leg: 0,
        offRouteReadings: 0,
        announced: [],
    };
}

/** Moves a trip forward for one GPS reading. Pure: returns what to show and say. */
export function advance(
    trip: Trip,
    position: MapPoint,
    { plan, toMeters }: Planner,
): { trip: Trip; say: Prompt | null } {
    if (trip.arrived) {
        return { trip, say: null };
    }

    const here = toMeters(position);
    const progress = locateOnRoute(trip.guide, here, trip.along);

    if (progress.offRoute > OFF_ROUTE_METERS) {
        const readings = trip.offRouteReadings + 1;

        if (readings >= OFF_ROUTE_READINGS) {
            const rerouted = plan(position, trip.destination);

            if (rerouted) {
                return {
                    trip: newTrip(trip.destination, rerouted),
                    say: prompt('Recalculating route.'),
                };
            }
        }

        return { trip: { ...trip, offRouteReadings: readings }, say: null };
    }

    const along = Math.max(trip.along, progress.along);
    const moved = { ...trip, along, leg: progress.leg, offRouteReadings: 0 };
    const end = trip.guide.meters[trip.guide.meters.length - 1];

    if (
        trip.guide.length - along < ARRIVED_METERS ||
        Math.hypot(end.east - here.east, end.north - here.north) <
            ARRIVED_METERS
    ) {
        return {
            trip: { ...moved, arrived: true },
            say: prompt(`You have arrived at ${trip.destination.name}.`),
        };
    }

    const next = instructionAt(trip.guide, along, trip.destination.name);

    if (!next.maneuver) {
        return { trip: moved, say: null };
    }

    const key = next.maneuver.at.toFixed(1);
    const now = next.distance <= TURN_NOW_METERS;
    const tag = `${key}:${now ? 'now' : 'ahead'}`;

    if (
        moved.announced.includes(tag) ||
        (!now && next.distance > ANNOUNCE_AHEAD_METERS)
    ) {
        return { trip: moved, say: null };
    }

    return {
        trip: {
            ...moved,
            announced: [...moved.announced, tag, `${key}:ahead`],
        },
        say: prompt(`${next.text}.`),
    };
}

/**
 * Turn-by-turn walking directions from the visitor's GPS position to a campus
 * location, with spoken prompts. `position` is the visitor's map spot.
 */
export function useCampusNavigation({
    router,
    projector,
    position,
    speak,
}: {
    router: Router;
    projector: GeoProjector | null;
    position: MapPoint | null;
    speak: (text: string) => void;
}) {
    const [trip, setTrip] = useState<Trip | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState<Prompt | null>(null);
    const [seen, setSeen] = useState<MapPoint | null>(null);

    const toMeters = useCallback(
        (p: MapPoint): Meters =>
            projector
                ? projector.offsetMeters({ x: 0, y: 0 }, p)
                : { east: 0, north: 0 },
        [projector],
    );
    const plan = useCallback(
        (from: MapPoint, to: CampusMapPoint) => {
            const points = router.route(from, to);

            return points ? buildGuide(points, toMeters) : null;
        },
        [router, toMeters],
    );

    // A new GPS reading: work out progress straight away, during render, so
    // the screen and the voice never lag a reading behind. Positions are
    // compared by value because the caller recomputes them every render.
    const positionChanged =
        position !== null &&
        (seen === null || seen.x !== position.x || seen.y !== position.y);

    if (positionChanged) {
        setSeen(position);

        if (trip) {
            const result = advance(trip, position, { plan, toMeters });
            setTrip(result.trip);

            if (result.say) {
                setPending(result.say);
            }
        }
    }

    // Speaking is a side effect, so it happens after render; each prompt once.
    const spokenRef = useRef(0);

    useEffect(() => {
        if (pending && pending.id !== spokenRef.current) {
            spokenRef.current = pending.id;
            speak(pending.text);
        }
    }, [pending, speak]);

    /** Call from a tap: iOS only lets speech start from one. */
    const start = (destination: CampusMapPoint) => {
        if (!projector || !position) {
            return;
        }

        const guide = plan(position, destination);

        if (!guide) {
            setError(`Couldn't find a walking route to ${destination.name}.`);
            speak(`Sorry, I couldn't find a route to ${destination.name}.`);

            return;
        }

        setError(null);
        setPending(null);
        setTrip(newTrip(destination, guide));

        const first = instructionAt(guide, 0, destination.name);
        const bearing = ((guide.bearings[0] ?? 0) * Math.PI) / 180;
        const direction = compassDirection({
            east: Math.sin(bearing),
            north: Math.cos(bearing),
        });

        // Spoken right here, inside the tap, so iOS allows it.
        speak(
            `Starting route to ${destination.name}, ${spokenDistance(guide.length)}. Head ${direction}.` +
                (first.maneuver ? ` ${first.text}.` : ''),
        );
    };

    const stop = useCallback(() => {
        setTrip(null);
        setError(null);
        setPending(null);
    }, []);

    if (!trip) {
        return { trip: null, error, start, stop } as const;
    }

    const remaining = trip.arrived
        ? 0
        : Math.max(0, trip.guide.length - trip.along);
    const instruction = trip.arrived
        ? null
        : instructionAt(trip.guide, trip.along, trip.destination.name);

    // Course-up camera: face along the current leg, turning a little early
    // at corners like a person would.
    const turnSoon =
        instruction?.maneuver &&
        instruction.distance < TURN_CAMERA_EARLY_METERS &&
        trip.leg + 1 < trip.guide.bearings.length;
    const heading =
        trip.guide.bearings[turnSoon ? trip.leg + 1 : trip.leg] ?? 0;

    return {
        trip,
        error,
        start,
        stop,
        instruction,
        remaining,
        minutes: Math.max(1, Math.ceil(remaining / WALKING_SPEED / 60)),
        heading,
    } as const;
}
