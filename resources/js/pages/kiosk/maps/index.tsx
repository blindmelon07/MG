import { Head } from '@inertiajs/react';
import {
    ArrowUp,
    CalendarDays,
    Compass,
    Eye,
    LocateFixed,
    LocateOff,
    Map as MapIcon,
    MapPin,
    MoveHorizontal,
    Navigation,
    Orbit,
    Rotate3d,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CAMPUS_WALKING, CampusMap } from '@/components/campus-map';
import type { CampusMapPoint } from '@/components/campus-map';
import { NavigationHud } from '@/components/navigation-hud';
import { PanoramaViewer } from '@/components/panorama-viewer';
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
import { nearestPanorama, panoramaTitle } from '@/lib/panorama';
import type { CampusPanorama } from '@/lib/panorama';
import { cn } from '@/lib/utils';
import { presence } from '@/routes/maps';
import { leave as leavePresence } from '@/routes/maps/presence';

// How close (in map percent) a tap must land to select a location.
const TAP_RADIUS = 8;
// How close the visitor must be to a location to say they're "near" it.
const NEAR_RADIUS = 10;
// How far outside the map edge still counts as being on campus.
const CAMPUS_MARGIN = 5;
// Within this many metres of a destination, you've arrived.
const ARRIVED_METERS = 10;
// Further than this from every 360° photo spot, say how far rather than
// presenting the photo as where you are.
const PHOTO_NEAR_METERS = 60;

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

// How often a phone showing its location reports in to the staff dashboard.
const PRESENCE_INTERVAL_MS = 20_000;

type MapEvent = {
    title: string;
    event_start_at: string | null;
    event_end_at: string | null;
    location: string | null;
};

function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);

    return match ? decodeURIComponent(match[1]) : '';
}

const PRESENCE_CLIENT_KEY = 'campus-map-client';

/**
 * A random id for this tab, so the dashboard shows one dot per phone.
 * Location only works over https, where randomUUID is always available.
 */
function presenceClientId(): string {
    try {
        const stored = sessionStorage.getItem(PRESENCE_CLIENT_KEY);

        if (stored) {
            return stored;
        }

        const id = crypto.randomUUID();
        sessionStorage.setItem(PRESENCE_CLIENT_KEY, id);

        return id;
    } catch {
        return crypto.randomUUID();
    }
}

function sendPresence(
    route: { url: string; method: string },
    body: { client: string; x?: number; y?: number },
) {
    void fetch(route.url, {
        method: route.method.toUpperCase(),
        credentials: 'same-origin',
        keepalive: true,
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-XSRF-TOKEN': xsrfToken(),
        },
        body: JSON.stringify(body),
    }).catch(() => {
        // Best effort: a missed report just means the dot fades sooner.
    });
}

/**
 * While the visitor shares their location and is on campus, tell the server
 * where they are on the map (map percent only) so staff see them live.
 */
function usePresenceReporting(point: { x: number; y: number } | null) {
    const pointRef = useRef(point);
    const active = point !== null;

    useEffect(() => {
        pointRef.current = point;
    }, [point]);

    useEffect(() => {
        if (!active) {
            return;
        }

        const client = presenceClientId();
        const report = () => {
            if (pointRef.current) {
                sendPresence(presence(), { client, ...pointRef.current });
            }
        };

        report();
        const timer = window.setInterval(report, PRESENCE_INTERVAL_MS);

        return () => {
            window.clearInterval(timer);
            sendPresence(leavePresence(), { client });
        };
    }, [active]);
}

const STATUS_MESSAGES: Partial<Record<GeolocationStatus, string>> = {
    locating: 'Finding your location…',
    unsupported: "This device can't share its location.",
    insecure:
        'Location only works when this page is opened over a secure (https) link.',
    denied: 'Location is blocked for this site. To allow it: tap the icon left of the address bar → Permissions → Location → Allow (in the installed app: long-press its icon → App info → Permissions). Then reload.',
    unavailable:
        "Couldn't get a GPS signal. Try moving outdoors, away from buildings.",
};

export default function KioskMapsIndex({
    locations,
    referencePoints,
    panoramas,
    focusLocationId,
    event,
}: {
    locations: CampusMapPoint[];
    referencePoints: GeoReferencePoint[];
    panoramas: CampusPanorama[];
    focusLocationId: number | null;
    event: MapEvent | null;
}) {
    // Opened from an event link: start with the event's area picked.
    const [activeId, setActiveId] = useState<number | null>(focusLocationId);
    const active = locations.find((location) => location.id === activeId);

    const projector = useMemo(
        () => createGeoProjector(referencePoints),
        [referencePoints],
    );
    const [handheld] = useState(isHandheld);
    // Start locating straight away on phones; kiosks use the button.
    const [tracking, setTracking] = useState(handheld);
    // Phones open on the 360° photo where they stand, when there are any,
    // otherwise the Waze-style camera following the visitor's arrow.
    const [view, setView] = useState<
        'photo' | 'first-person' | 'follow' | 'overview'
    >(handheld ? (panoramas.length > 0 ? 'photo' : 'follow') : 'overview');
    // Photo picked by hand, for kiosks and phones without a GPS fix.
    const [pickedPanoramaId, setPickedPanoramaId] = useState<number | null>(
        null,
    );
    // Where the visitor has dragged to look, when there's no compass.
    const [lookHeading, setLookHeading] = useState<number | null>(null);
    // Ask for location even before an admin has calibrated the map, so the
    // phone's permission prompt shows up and is settled ahead of time.
    const geo = useGeolocation(tracking);

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
    usePresenceReporting(
        onCampus && userPoint && !geo.stale
            ? { x: userPoint.x, y: userPoint.y }
            : null,
    );
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
    // Waze-style camera behind the visitor, free to swing a full 360°.
    const followOn = view === 'follow' && firstPersonAvailable && !navigating;
    const lookOn = firstPersonOn || followOn;
    // The 360° photo taken nearest the phone's own GPS. Needs no map
    // calibration: it's photo GPS against phone GPS.
    const photoOn = view === 'photo' && panoramas.length > 0 && !navigating;
    const compass = useDeviceHeading(lookOn || photoOn);
    const [shownPanoramaId, setShownPanoramaId] = useState<number | null>(null);
    const nearestPhoto =
        geo.fix && !geo.stale
            ? nearestPanorama(panoramas, geo.fix, shownPanoramaId)
            : null;
    const shownPanorama =
        nearestPhoto?.panorama ??
        panoramas.find((p) => p.id === pickedPanoramaId) ??
        panoramas[0] ??
        null;

    // Remember which photo is up, so GPS jitter doesn't flick between two.
    if ((shownPanorama?.id ?? null) !== shownPanoramaId) {
        setShownPanoramaId(shownPanorama?.id ?? null);
    }

    const viewOptions = [
        ...(panoramas.length > 0 ? [['photo', Orbit, '360°'] as const] : []),
        ...(firstPersonAvailable
            ? ([
                  ['follow', Navigation, '3D'],
                  ['first-person', Eye, 'Eyes'],
              ] as const)
            : []),
        ['overview', MapIcon, 'Map'] as const,
    ];

    // Without a compass, start out facing the chosen place or the campus centre.
    const initialHeading =
        projector && userPoint
            ? bearingDegrees(
                  projector.offsetMeters(userPoint, active ?? { x: 50, y: 50 }),
              )
            : 0;
    const heading = compass.heading ?? lookHeading ?? initialHeading;

    const guidance = (() => {
        if (!lookOn || !active || !projector || !userPoint) {
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

    const toggleTracking = () => {
        if (tracking) {
            geo.reset();
        } else if (window.isSecureContext && 'geolocation' in navigator) {
            // Ask straight from the tap: some phones only show the
            // permission prompt in direct response to the user.
            navigator.geolocation.getCurrentPosition(
                () => {},
                () => {},
                { enableHighAccuracy: true },
            );
        }

        setTracking(!tracking);
    };

    let locationMessage = STATUS_MESSAGES[geo.status] ?? null;

    if (photoOn && nearestPhoto) {
        // The 360° view says where you are relative to the photo spots.
        locationMessage = null;
    } else if (!projector && geo.status === 'active' && geo.fix) {
        locationMessage = `Your phone's location is working (GPS precision about ${Math.round(geo.fix.accuracy)} m). The school still needs to set up GPS for this map before it can show where you are or how far the campus is.`;
    }

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

            <div className="flex flex-col gap-4 md:gap-6">
                <div className="flex items-center justify-between gap-3 md:flex-wrap md:items-start">
                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                            Campus Map
                        </h1>
                        <p className="hidden text-muted-foreground md:block">
                            Tap a place on the map or a location below to find
                            your way around Aemilianum College Inc.
                        </p>
                    </div>

                    {/* Phones: compact; the status line below says the rest. */}
                    <Button
                        size="sm"
                        className="shrink-0 md:hidden"
                        variant={tracking ? 'secondary' : 'default'}
                        onClick={toggleTracking}
                    >
                        {tracking ? <LocateOff /> : <LocateFixed />}
                        {tracking ? 'Stop' : 'Locate me'}
                    </Button>

                    <Button
                        className="hidden md:inline-flex"
                        variant={tracking ? 'secondary' : 'default'}
                        onClick={toggleTracking}
                    >
                        {tracking ? <LocateOff /> : <LocateFixed />}
                        {tracking
                            ? 'Stop showing my location'
                            : 'Show my location'}
                    </Button>
                </div>

                {event && (
                    <div className="-mt-2 flex items-start gap-3 rounded-xl border border-primary/50 bg-primary/5 p-4 text-sm">
                        <CalendarDays className="mt-0.5 size-5 shrink-0 text-primary" />
                        <div>
                            <div className="font-semibold">{event.title}</div>
                            {event.event_start_at && (
                                <div className="text-muted-foreground">
                                    {new Date(
                                        event.event_start_at,
                                    ).toLocaleString(undefined, {
                                        dateStyle: 'full',
                                        timeStyle: 'short',
                                    })}
                                    {event.event_end_at &&
                                        ` – ${new Date(event.event_end_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`}
                                </div>
                            )}
                            <div className="mt-1">
                                {active
                                    ? `Happening at ${active.name}${event.location ? ` (${event.location})` : ''}. It's marked on the map below.`
                                    : event.location}
                            </div>
                        </div>
                    </div>
                )}

                {handheld &&
                    view !== 'overview' &&
                    tracking &&
                    !firstPersonAvailable &&
                    projector && (
                        <p className="-mt-2 text-sm text-muted-foreground md:-mt-3">
                            The 3D walking view starts once your phone finds you
                            on campus.
                        </p>
                    )}

                {tracking && locationMessage && (
                    <p
                        role="status"
                        className="-mt-2 flex items-start gap-2 text-sm text-muted-foreground md:-mt-3 md:items-center"
                    >
                        <LocateFixed className="mt-0.5 size-4 shrink-0 text-sky-500 md:mt-0" />
                        {locationMessage}
                    </p>
                )}

                <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
                    <div
                        ref={mapRef}
                        // Phones: the map runs edge to edge.
                        className="relative -mx-4 scroll-mt-16 md:mx-0 md:scroll-mt-2 lg:col-span-2"
                    >
                        {/* Pins stay hidden until a location is chosen,
                            either from the list or by tapping the map. */}
                        <CampusMap
                            className={cn(
                                'rounded-none border-x-0 md:rounded-lg md:border-x',
                                lookOn || photoOn || navigating
                                    ? 'aspect-[3/4] sm:aspect-[4/3]'
                                    : 'aspect-square sm:aspect-[4/3]',
                            )}
                            follow={
                                projector && userPoint
                                    ? navigation.trip
                                        ? {
                                              ...userPoint,
                                              forward: projector.headingToWorld(
                                                  navigation.heading,
                                              ),
                                          }
                                        : followOn
                                          ? {
                                                ...userPoint,
                                                forward:
                                                    projector.headingToWorld(
                                                        heading,
                                                    ),
                                            }
                                          : null
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

                        {photoOn && shownPanorama && (
                            <PanoramaViewer
                                className="absolute inset-0 z-10 md:rounded-lg"
                                panorama={shownPanorama}
                                heading={compass.heading}
                            >
                                <div className="pointer-events-none absolute inset-x-2 bottom-2 flex flex-col items-start gap-2">
                                    <div
                                        role="status"
                                        className="flex items-start gap-2 rounded-lg bg-background/90 px-3 py-2 text-sm font-medium shadow-md backdrop-blur"
                                    >
                                        <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                                        <span>
                                            {nearestPhoto
                                                ? nearestPhoto.meters <=
                                                  PHOTO_NEAR_METERS
                                                    ? `${panoramaTitle(shownPanorama)} · photo taken about ${formatDistance(nearestPhoto.meters)} from you`
                                                    : `You're ${formatDistance(nearestPhoto.meters)} from the nearest 360° photo spot (${panoramaTitle(shownPanorama)}).`
                                                : `${panoramaTitle(shownPanorama)} · ${
                                                      tracking
                                                          ? 'waiting for your GPS…'
                                                          : 'tap Locate me to follow where you are'
                                                  }`}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 rounded-lg bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-md backdrop-blur">
                                        {compass.heading !== null ? (
                                            <>
                                                <Compass className="size-4 shrink-0" />
                                                Turn your phone to look around.
                                            </>
                                        ) : (
                                            <>
                                                <Rotate3d className="size-4 shrink-0" />
                                                Drag to look around. Pinch to
                                                zoom.
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

                                    {/* No GPS fix: pick a spot by hand. */}
                                    {!nearestPhoto && panoramas.length > 1 && (
                                        <div className="pointer-events-auto -mx-2 flex max-w-[calc(100%+1rem)] [scrollbar-width:none] gap-1.5 overflow-x-auto px-2">
                                            {panoramas.map((p) => (
                                                <Button
                                                    key={p.id}
                                                    size="sm"
                                                    variant={
                                                        p.id ===
                                                        shownPanorama.id
                                                            ? 'default'
                                                            : 'secondary'
                                                    }
                                                    className="shrink-0 shadow-md"
                                                    onClick={() =>
                                                        setPickedPanoramaId(
                                                            p.id,
                                                        )
                                                    }
                                                >
                                                    {panoramaTitle(p)}
                                                </Button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </PanoramaViewer>
                        )}

                        {!navigating && viewOptions.length > 1 && (
                            <div
                                role="group"
                                aria-label="Map view"
                                className="absolute top-2 right-2 z-20 flex gap-0.5 rounded-lg bg-background/90 p-0.5 shadow-md backdrop-blur"
                            >
                                {viewOptions.map(([value, Icon, label]) => (
                                    <Button
                                        key={value}
                                        size="sm"
                                        variant={
                                            view === value ? 'default' : 'ghost'
                                        }
                                        aria-pressed={view === value}
                                        onClick={() => setView(value)}
                                    >
                                        <Icon />
                                        {label}
                                    </Button>
                                ))}
                            </div>
                        )}

                        {lookOn && (
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
                                    {followOn ? (
                                        <>
                                            <Rotate3d className="size-4 shrink-0" />
                                            Drag to look 360° around you. Pinch
                                            to zoom.
                                        </>
                                    ) : compass.heading !== null ? (
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

                    <div className="flex min-w-0 flex-col gap-3">
                        <Card
                            className={cn(
                                'order-2 border-primary/50 bg-primary/5 lg:order-1 lg:min-h-32',
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

                        {/* Phones: one swipeable row of chips under the map. */}
                        <div className="order-1 -mx-4 flex snap-x scroll-px-4 [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 lg:order-2 lg:mx-0 lg:snap-none lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
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
                                        'flex shrink-0 snap-start items-center gap-2 rounded-full border px-3 py-2 text-left text-sm font-medium whitespace-nowrap transition-colors lg:rounded-lg lg:whitespace-normal',
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
