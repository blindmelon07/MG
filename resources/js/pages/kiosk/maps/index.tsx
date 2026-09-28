import { Head } from '@inertiajs/react';
import {
    ArrowUp,
    Compass,
    Eye,
    LocateFixed,
    LocateOff,
    Map as MapIcon,
    MapPin,
    MoveHorizontal,
    Navigation,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { CAMPUS_WALKING, CampusMap } from '@/components/campus-map';
import type { CampusMapPoint } from '@/components/campus-map';
import { NavigationHud } from '@/components/navigation-hud';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCampusNavigation } from '@/hooks/use-campus-navigation';
import { useDeviceHeading } from '@/hooks/use-device-heading';
import { useGeolocation } from '@/hooks/use-geolocation';
import type { GeolocationStatus } from '@/hooks/use-geolocation';
import { useSpeech } from '@/hooks/use-speech';
import {
    bearingDegrees,
    compassDirection,
    createGeoProjector,
    formatDistance,
    relativeDirection,
} from '@/lib/campus-geo';
import type { GeoReferencePoint } from '@/lib/campus-geo';
import { createRouter } from '@/lib/campus-route';
import { isHandheld } from '@/lib/device';
import { cn } from '@/lib/utils';

// How close (in map percent) a tap must land to select a location.
const TAP_RADIUS = 8;
// How close the visitor must be to a location to say they're "near" it.
const NEAR_RADIUS = 10;
// How far outside the map edge still counts as being on campus.
const CAMPUS_MARGIN = 5;
// Within this many metres of a destination, you've arrived.
const ARRIVED_METERS = 10;

function nearestLocation(
    locations: CampusMapPoint[],
    { x, y }: { x: number; y: number },
    radius = TAP_RADIUS,
) {
    let nearest: CampusMapPoint | null = null;
    let nearestDistance = radius;

    for (const location of locations) {
        const distance = Math.hypot(location.x - x, location.y - y);

        if (distance <= nearestDistance) {
            nearest = location;
            nearestDistance = distance;
        }
    }

    return nearest;
}

const STATUS_MESSAGES: Partial<Record<GeolocationStatus, string>> = {
    locating: 'Finding your location…',
    unsupported: "This device can't share its location.",
    insecure:
        'Location only works when this page is opened over a secure (https) link.',
    denied: 'Location permission was blocked. Allow it in your browser settings to see where you are.',
    unavailable:
        "Couldn't get a GPS signal. Try moving outdoors, away from buildings.",
};

export default function KioskMapsIndex({
    locations,
    referencePoints,
}: {
    locations: CampusMapPoint[];
    referencePoints: GeoReferencePoint[];
}) {
    const [activeId, setActiveId] = useState<number | null>(null);
    const active = locations.find((location) => location.id === activeId);

    const projector = useMemo(
        () => createGeoProjector(referencePoints),
        [referencePoints],
    );
    const [handheld] = useState(isHandheld);
    // Start locating straight away on phones; kiosks use the button.
    const [tracking, setTracking] = useState(handheld);
    // Phones default to seeing the campus through the visitor's own eyes.
    const [view, setView] = useState<'first-person' | 'overview'>(
        handheld ? 'first-person' : 'overview',
    );
    // Where the visitor has dragged to look, when there's no compass.
    const [lookHeading, setLookHeading] = useState<number | null>(null);
    // No GPS request until an admin has calibrated the map.
    const geo = useGeolocation(tracking && projector !== null);

    const userPoint =
        projector && geo.fix
            ? projector.project(geo.fix.latitude, geo.fix.longitude)
            : null;
    const onCampus =
        userPoint !== null &&
        userPoint.x >= -CAMPUS_MARGIN &&
        userPoint.x <= 100 + CAMPUS_MARGIN &&
        userPoint.y >= -CAMPUS_MARGIN &&
        userPoint.y <= 100 + CAMPUS_MARGIN;
    const nearby =
        onCampus && userPoint
            ? nearestLocation(locations, userPoint, NEAR_RADIUS)
            : null;

    // First person needs a phone that knows where it is on campus.
    const firstPersonAvailable =
        handheld && projector !== null && onCampus && userPoint !== null;
    // The walking grid is built on the first route request, not on page load.
    const routerRef = useRef<ReturnType<typeof createRouter> | null>(null);
    const router = useMemo(
        () => ({
            route: (
                from: { x: number; y: number },
                to: { x: number; y: number },
            ) =>
                (routerRef.current ??= createRouter(CAMPUS_WALKING)).route(
                    from,
                    to,
                ),
        }),
        [],
    );
    const speech = useSpeech();
    const mapRef = useRef<HTMLDivElement>(null);
    const navigation = useCampusNavigation({
        router,
        projector,
        position: firstPersonAvailable ? userPoint : null,
        speak: speech.speak,
    });
    const navigating = navigation.trip !== null;

    const firstPersonOn =
        view === 'first-person' && firstPersonAvailable && !navigating;
    const compass = useDeviceHeading(firstPersonOn);

    // Without a compass, start out facing the chosen place or the campus centre.
    const initialHeading =
        projector && userPoint
            ? bearingDegrees(
                  projector.offsetMeters(userPoint, active ?? { x: 50, y: 50 }),
              )
            : 0;
    const heading = compass.heading ?? lookHeading ?? initialHeading;

    const guidance = (() => {
        if (!firstPersonOn || !active || !projector || !userPoint) {
            return null;
        }

        const offset = projector.offsetMeters(userPoint, active);
        const meters = Math.hypot(offset.east, offset.north);

        if (meters < ARRIVED_METERS) {
            return {
                arrived: true,
                turn: 0,
                text: `You've arrived at ${active.name}.`,
            };
        }

        const { turn, label } = relativeDirection(
            bearingDegrees(offset),
            heading,
        );

        return {
            arrived: false,
            turn,
            text: `${active.name} is ${label}, about ${formatDistance(meters)} away.`,
        };
    })();

    let locationMessage = projector
        ? (STATUS_MESSAGES[geo.status] ?? null)
        : "Your location can't be shown yet: the school still needs to set up GPS for this map.";

    if (projector && userPoint && geo.fix) {
        const accuracy = `(accurate to about ${Math.round(geo.fix.accuracy)} m)`;

        if (geo.stale) {
            locationMessage = onCampus
                ? 'GPS signal lost — the grey dot shows where you were last seen.'
                : 'GPS signal lost. Try moving outdoors, away from buildings.';
        } else if (!onCampus) {
            // Point the way back, to the Main Gate if it's on the map.
            const gate = locations.find((l) => /main gate/i.test(l.name));
            const offset = projector.offsetMeters(
                userPoint,
                gate ?? { x: 50, y: 50 },
            );
            const distance = formatDistance(
                Math.hypot(offset.east, offset.north),
            );
            const direction = compassDirection(offset);

            locationMessage = gate
                ? `You're outside the campus, about ${distance} from the Main Gate. Head ${direction} to get there ${accuracy}.`
                : `You're outside the campus, about ${distance} away. Head ${direction} to get there ${accuracy}.`;
        } else if (nearby) {
            locationMessage = `You're near ${nearby.name} ${accuracy}.`;
        } else {
            locationMessage = `You're the blue dot on the map ${accuracy}.`;
        }
    }

    return (
        <>
            <Head title="Campus Map" />

            <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Campus Map
                        </h1>
                        <p className="text-muted-foreground">
                            Tap a place on the map or a location below to find
                            your way around Aemilianum College Inc.
                        </p>
                    </div>

                    <Button
                        variant={tracking ? 'secondary' : 'default'}
                        onClick={() => {
                            if (tracking) {
                                geo.reset();
                            }

                            setTracking(!tracking);
                        }}
                    >
                        {tracking ? <LocateOff /> : <LocateFixed />}
                        {tracking
                            ? 'Stop showing my location'
                            : 'Show my location'}
                    </Button>
                </div>

                {handheld &&
                    view === 'first-person' &&
                    tracking &&
                    !firstPersonAvailable &&
                    projector && (
                        <p className="-mt-3 text-sm text-muted-foreground">
                            First-person view starts once your phone finds you
                            on campus.
                        </p>
                    )}

                {tracking && locationMessage && (
                    <p
                        role="status"
                        className="-mt-3 flex items-center gap-2 text-sm text-muted-foreground"
                    >
                        <LocateFixed className="size-4 shrink-0 text-sky-500" />
                        {locationMessage}
                    </p>
                )}

                <div className="grid gap-6 lg:grid-cols-3">
                    <div
                        ref={mapRef}
                        className="relative scroll-mt-2 lg:col-span-2"
                    >
                        {/* Pins stay hidden until a location is chosen,
                            either from the list or by tapping the map. */}
                        <CampusMap
                            className={
                                firstPersonOn || navigating
                                    ? 'aspect-[3/4] sm:aspect-[4/3]'
                                    : undefined
                            }
                            follow={
                                navigation.trip && projector && userPoint
                                    ? {
                                          ...userPoint,
                                          forward: projector.headingToWorld(
                                              navigation.heading,
                                          ),
                                      }
                                    : null
                            }
                            route={navigation.trip?.guide.points ?? null}
                            firstPerson={
                                firstPersonOn && projector && userPoint
                                    ? {
                                          ...userPoint,
                                          forward:
                                              projector.headingToWorld(heading),
                                      }
                                    : null
                            }
                            onLookDrag={
                                compass.heading === null
                                    ? (delta) =>
                                          setLookHeading(
                                              (prev) =>
                                                  ((prev ?? heading) +
                                                      delta +
                                                      360) %
                                                  360,
                                          )
                                    : undefined
                            }
                            points={
                                navigation.trip
                                    ? [navigation.trip.destination]
                                    : active
                                      ? [active]
                                      : []
                            }
                            activeId={activeId}
                            onPointClick={(point) => setActiveId(point.id)}
                            onMapClick={(coords) =>
                                setActiveId(
                                    nearestLocation(locations, coords)?.id ??
                                        null,
                                )
                            }
                            userLocation={
                                onCampus && userPoint
                                    ? { ...userPoint, stale: geo.stale }
                                    : null
                            }
                        />

                        {navigation.trip && (
                            <NavigationHud
                                destination={navigation.trip.destination.name}
                                instruction={navigation.instruction}
                                remaining={navigation.remaining}
                                minutes={navigation.minutes}
                                arrived={navigation.trip.arrived}
                                muted={speech.muted}
                                canSpeak={speech.supported}
                                onToggleMute={() =>
                                    speech.setMuted(!speech.muted)
                                }
                                onEnd={navigation.stop}
                            />
                        )}

                        {firstPersonAvailable && !navigating && (
                            <Button
                                size="sm"
                                variant="secondary"
                                className="absolute top-2 right-2 shadow-md"
                                onClick={() =>
                                    setView(
                                        firstPersonOn
                                            ? 'overview'
                                            : 'first-person',
                                    )
                                }
                            >
                                {firstPersonOn ? <MapIcon /> : <Eye />}
                                {firstPersonOn ? 'Overview' : 'First person'}
                            </Button>
                        )}

                        {firstPersonOn && (
                            <div className="pointer-events-none absolute inset-x-2 bottom-2 flex flex-col items-start gap-2">
                                {guidance && (
                                    <div
                                        role="status"
                                        className="flex items-center gap-2 rounded-lg bg-background/90 px-3 py-2 text-sm font-medium shadow-md backdrop-blur"
                                    >
                                        {guidance.arrived ? (
                                            <MapPin className="size-5 shrink-0 text-primary" />
                                        ) : (
                                            <ArrowUp
                                                className="size-5 shrink-0 text-primary transition-transform"
                                                style={{
                                                    transform: `rotate(${guidance.turn}deg)`,
                                                }}
                                            />
                                        )}
                                        {guidance.text}
                                    </div>
                                )}

                                <div className="flex items-center gap-2 rounded-lg bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-md backdrop-blur">
                                    {compass.heading !== null ? (
                                        <>
                                            <Compass className="size-4 shrink-0" />
                                            Facing{' '}
                                            {compassDirection({
                                                east: Math.sin(
                                                    (heading * Math.PI) / 180,
                                                ),
                                                north: Math.cos(
                                                    (heading * Math.PI) / 180,
                                                ),
                                            })}
                                            . Turn your phone to look around.
                                        </>
                                    ) : (
                                        <>
                                            <MoveHorizontal className="size-4 shrink-0" />
                                            Drag sideways to look around.
                                        </>
                                    )}
                                </div>

                                {compass.status === 'needs-permission' && (
                                    <Button
                                        size="sm"
                                        className="pointer-events-auto shadow-md"
                                        onClick={() =>
                                            void compass.requestPermission()
                                        }
                                    >
                                        <Compass /> Use my compass
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-3">
                        <Card
                            className={cn(
                                'min-h-32 border-primary/50 bg-primary/5',
                                !active && 'hidden lg:block',
                            )}
                        >
                            <CardContent className="flex items-start gap-3">
                                <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
                                <div>
                                    {active ? (
                                        <>
                                            <div className="font-semibold">
                                                {active.name}
                                            </div>
                                            {active.description && (
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {active.description}
                                                </p>
                                            )}
                                            {firstPersonAvailable &&
                                                navigation.trip?.destination
                                                    .id !== active.id && (
                                                    <Button
                                                        className="mt-3"
                                                        onClick={() => {
                                                            navigation.start(
                                                                active,
                                                            );
                                                            // The button sits below the map; bring the map up.
                                                            mapRef.current?.scrollIntoView(
                                                                {
                                                                    behavior:
                                                                        'smooth',
                                                                    block: 'start',
                                                                },
                                                            );
                                                        }}
                                                    >
                                                        <Navigation /> Start
                                                        navigation
                                                    </Button>
                                                )}
                                            {navigation.error && (
                                                <p className="mt-2 text-sm text-destructive">
                                                    {navigation.error}
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            Tap a building on the map or pick a
                                            location to see where it is.
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex flex-col gap-2">
                            {locations.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    No locations have been added to the map yet.
                                </p>
                            )}
                            {locations.map((location) => (
                                <button
                                    key={location.id}
                                    type="button"
                                    onClick={() => setActiveId(location.id)}
                                    className={cn(
                                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors',
                                        activeId === location.id
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-sidebar-border/70 hover:bg-accent dark:border-sidebar-border',
                                    )}
                                >
                                    <MapPin className="size-4 shrink-0" />
                                    {location.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
