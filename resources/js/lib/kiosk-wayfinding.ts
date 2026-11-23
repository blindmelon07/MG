/**
 * Mall-directory wayfinding for the kiosk: the walk from the kiosk's fixed
 * spot to a chosen place, as written steps and the 360° photos along it.
 *
 * Pure: no React, no Three.js. Positions are map percent (0–100).
 */
import { SITE_DEPTH, SITE_WIDTH } from '@/components/campus-map';
import type { GeoProjector } from '@/lib/campus-geo';
import { buildGuide, locateOnRoute, spokenDistance } from '@/lib/campus-route';
import type { MapPoint, Meters, RouteGuide } from '@/lib/campus-route';
import type { CampusPanorama } from '@/lib/panorama';

// Until GPS calibration exists, assume the printed plan's scale: north up,
// about 12 m per scene unit. Turns stay right; distances are rough.
const FALLBACK_METERS_PER_UNIT = 12;
// A 360° photo this close to the route counts as "on the way".
const PHOTO_NEAR_ROUTE_METERS = 15;
const WALKING_SPEED = 1.3; // metres per second

export function metersConverter(
    projector: GeoProjector | null,
): (p: MapPoint) => Meters {
    if (projector) {
        const origin = { x: 0, y: 0 };

        return (p) => projector.offsetMeters(origin, p);
    }

    return (p) => ({
        east: (p.x / 100) * SITE_WIDTH * FALLBACK_METERS_PER_UNIT,
        north: -(p.y / 100) * SITE_DEPTH * FALLBACK_METERS_PER_UNIT,
    });
}

export type WalkStep = {
    text: string;
    /** Degrees, negative = left; null for the start and arrival. */
    turn: number | null;
};

const capitalize = (text: string) =>
    text.charAt(0).toUpperCase() + text.slice(1);

/**
 * "Walk about 40 m, then turn left" for each turn, ending at the place.
 * Distances are left out when the map isn't GPS-calibrated, since they
 * would only be guesses.
 */
export function describeWalk(
    guide: RouteGuide,
    destination: string,
    withDistances: boolean,
    start = 'Start at this kiosk (You are here).',
): WalkStep[] {
    const steps: WalkStep[] = [{ text: start, turn: null }];
    let from = 0;

    for (const maneuver of guide.maneuvers) {
        const leg = maneuver.at - from;
        steps.push({
            text:
                withDistances && leg >= 3
                    ? `Walk about ${spokenDistance(leg)}, then ${maneuver.phrase}.`
                    : `${capitalize(maneuver.phrase)}.`,
            turn: maneuver.turn,
        });
        from = maneuver.at;
    }

    const last = guide.length - from;
    steps.push({
        text:
            withDistances && last >= 3
                ? `Continue about ${spokenDistance(last)} to arrive at ${destination}.`
                : `Continue ahead to arrive at ${destination}.`,
        turn: null,
    });

    return steps;
}

export function walkingMinutes(meters: number) {
    return Math.max(1, Math.round(meters / WALKING_SPEED / 60));
}

export type RoutePhoto = {
    panorama: CampusPanorama;
    /** Metres from the kiosk along the route, for ordering. */
    along: number;
    /** Compass heading of the walk at the photo, so it opens facing the way to go. */
    heading: number;
};

/**
 * 360° photos taken near the route, in walking order, so the visitor can
 * preview the walk. Needs GPS calibration to know where each photo sits.
 */
export function photosAlongRoute(
    guide: RouteGuide,
    panoramas: CampusPanorama[],
    projector: GeoProjector | null,
    toMeters: (p: MapPoint) => Meters,
): RoutePhoto[] {
    if (!projector) {
        return [];
    }

    return panoramas
        .map((panorama) => {
            const spot = projector.project(
                panorama.latitude,
                panorama.longitude,
            );
            const progress = locateOnRoute(guide, toMeters(spot));

            return {
                panorama,
                along: progress.along,
                off: progress.offRoute,
                heading: guide.bearings[progress.leg] ?? 0,
            };
        })
        .filter((p) => p.off <= PHOTO_NEAR_ROUTE_METERS)
        .sort((a, b) => a.along - b.along)
        .map(({ panorama, along, heading }) => ({ panorama, along, heading }));
}

/** Plans the walk; null when no path exists. */
export function planWalk(
    route: (from: MapPoint, to: MapPoint) => MapPoint[] | null,
    from: MapPoint,
    to: MapPoint,
    toMeters: (p: MapPoint) => Meters,
): RouteGuide | null {
    const points = route(from, to);

    return points && points.length > 0 ? buildGuide(points, toMeters) : null;
}
