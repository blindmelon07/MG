import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    ArrowUp,
    Building2,
    Car,
    ChevronLeft,
    ChevronRight,
    Church,
    Clock,
    CornerUpLeft,
    CornerUpRight,
    Cpu,
    DoorOpen,
    Dumbbell,
    Footprints,
    House,
    Info,
    Landmark,
    LocateFixed,
    LocateOff,
    Map as MapIcon,
    MapPin,
    Megaphone,
    MousePointerClick,
    Navigation,
    Orbit,
    Phone,
    Scale,
    Search,
    Trees,
    Utensils,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CAMPUS_WALKING, CampusMap } from '@/components/campus-map';
import type { CampusMapPoint } from '@/components/campus-map';
import { FloorPlanView } from '@/components/floor-plan-view';
import { KioskMarquee } from '@/components/kiosk-marquee';
import type { MarqueeItem } from '@/components/kiosk-marquee';
import { PanoramaViewer } from '@/components/panorama-viewer';
import { Button } from '@/components/ui/button';
import { useGeolocation } from '@/hooks/use-geolocation';
import type { GeolocationStatus } from '@/hooks/use-geolocation';
import { createGeoProjector, formatDistance } from '@/lib/campus-geo';
import type { GeoReferencePoint } from '@/lib/campus-geo';
import { createRouter } from '@/lib/campus-route';
import {
    entranceApproach,
    floorPlanFor,
    planIndoorWalk,
} from '@/lib/floor-plans';
import {
    describeWalk,
    metersConverter,
    photosAlongRoute,
    planWalk,
    walkingMinutes,
} from '@/lib/kiosk-wayfinding';
import { panoramaTitle } from '@/lib/panorama';
import type { CampusPanorama } from '@/lib/panorama';
import { cn } from '@/lib/utils';
import {
    index as announcementsIndex,
    show as announcementShow,
} from '@/routes/announcements';
import { index as directoryIndex } from '@/routes/directory';
import { index as mapsIndex } from '@/routes/maps';

type Location = CampusMapPoint & { photo_url: string | null };

type Office = {
    id: number;
    name: string;
    description: string | null;
    phone: string | null;
    office_hours: string | null;
    room: string | null;
    floor_room: string | null;
    campus_location_id: number;
};

type FeaturedEvent = {
    id: number;
    title: string;
    slug: string;
    summary: string;
    event_start_at: string;
    event_end_at: string | null;
    location: string | null;
};

type Announcement = {
    id: number;
    title: string;
    slug: string;
    type: 'announcement' | 'event';
    published_at: string | null;
    event_start_at: string | null;
    location: string | null;
};

/** What the visitor picked: a building, or an office inside one. */
type Destination =
    | { kind: 'building'; location: Location }
    | { kind: 'office'; office: Office; location: Location };

// Only a location this precise (phone GPS) starts routes. Laptops guess
// theirs from Wi-Fi, often hundreds of metres off.
const PRECISE_FIX_METERS = 30;
// How far outside the map plot (percent) still counts as on campus.
const CAMPUS_MARGIN = 5;

const LOCATION_STATUS: Partial<Record<GeolocationStatus, string>> = {
    locating: 'Finding your location…',
    unsupported: "This device can't share its location.",
    insecure:
        'Location only works when this page is opened over a secure (https) link.',
    denied: 'Location is blocked for this site. Allow it in your browser’s site settings, then try again.',
    unavailable:
        "Couldn't get a GPS signal. Try moving outdoors, away from buildings.",
};

// A shared screen: after this long untouched, go back to the start.
const IDLE_RESET_MS = 90_000;

function useIdleReset(onIdle: () => void) {
    const onIdleRef = useRef(onIdle);

    useEffect(() => {
        onIdleRef.current = onIdle;
    }, [onIdle]);

    useEffect(() => {
        let timer = setTimeout(() => onIdleRef.current(), IDLE_RESET_MS);
        const reset = () => {
            clearTimeout(timer);
            timer = setTimeout(() => onIdleRef.current(), IDLE_RESET_MS);
        };
        const events = ['pointerdown', 'keydown', 'wheel'];
        events.forEach((e) => window.addEventListener(e, reset));

        return () => {
            clearTimeout(timer);
            events.forEach((e) => window.removeEventListener(e, reset));
        };
    }, []);
}

function TurnIcon({ turn }: { turn: number | null }) {
    if (turn === null) {
        return <Footprints className="size-5" />;
    }

    if (Math.abs(turn) < 55) {
        return (
            <ArrowUp
                className="size-5"
                style={{ transform: `rotate(${turn}deg)` }}
            />
        );
    }

    return turn < 0 ? (
        <CornerUpLeft className="size-5" />
    ) : (
        <CornerUpRight className="size-5" />
    );
}

/** A fitting icon for a campus place, from its name. */
function iconFor(name: string): LucideIcon {
    const n = name.toLowerCase();
    const icons: [RegExp, LucideIcon][] = [
        [/gate|entrance/, Landmark],
        [/ait|computer|laborator/, Cpu],
        [/automotive|garage|parking/, Car],
        [/gym/, Dumbbell],
        [/chapel|church/, Church],
        [/convent/, House],
        [/quadrangle|field|court|lawn/, Trees],
        [/canteen/, Utensils],
        [/law/, Scale],
        [/sign/, MapPin],
    ];

    return icons.find(([pattern]) => pattern.test(n))?.[1] ?? Building2;
}

/** Panel chrome shared by the map and location list. */
const panel =
    'flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/15 bg-brand-950/50 shadow-xl';

function PanelTitle({
    icon: Icon,
    children,
    aside,
}: {
    icon: LucideIcon;
    children: React.ReactNode;
    aside?: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-brand-900/70 px-4 py-2.5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Icon className="size-5 text-gold-300" />
                {children}
            </h2>
            {aside}
        </div>
    );
}

function DateBadge({ value }: { value: string }) {
    const date = new Date(value);

    return (
        <div className="w-12 shrink-0 overflow-hidden rounded-lg border border-red-200 bg-white text-center shadow-sm">
            <div className="bg-red-600 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">
                {date.toLocaleDateString(undefined, { month: 'short' })}
            </div>
            <div className="py-0.5 text-xl leading-tight font-extrabold text-brand-950">
                {date.getDate()}
            </div>
        </div>
    );
}

const timeOf = (value: string) =>
    new Date(value).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
    });

export default function KioskHome({
    locations,
    offices,
    kioskPosition,
    referencePoints,
    panoramas,
    featuredEvents,
    latestAnnouncements,
    ticker,
    focus,
    handheld,
}: {
    locations: Location[];
    offices: Office[];
    kioskPosition: { x: number; y: number };
    referencePoints: GeoReferencePoint[];
    panoramas: CampusPanorama[];
    featuredEvents: FeaturedEvent[];
    latestAnnouncements: Announcement[];
    ticker: MarqueeItem[];
    focus: { office: number | null; location: number | null };
    handheld: boolean;
}) {
    const [destination, setDestination] = useState<Destination | null>(() => {
        const office = offices.find((o) => o.id === focus.office);
        const officeLocation = office
            ? locations.find((l) => l.id === office.campus_location_id)
            : undefined;

        if (office && officeLocation) {
            return { kind: 'office', office, location: officeLocation };
        }

        const location = locations.find((l) => l.id === focus.location);

        return location ? { kind: 'building', location } : null;
    });
    const [tab, setTab] = useState<'buildings' | 'offices'>(
        focus.office ? 'offices' : 'buildings',
    );
    const [query, setQuery] = useState('');
    const [photoIndex, setPhotoIndex] = useState<number | null>(null);
    // Map area shows the campus route, or the floor inside the building.
    const [inside, setInside] = useState(false);

    const reset = () => {
        setDestination(null);
        setPhotoIndex(null);
        setInside(false);
        setQuery('');
    };
    useIdleReset(reset);

    const projector = useMemo(
        () => createGeoProjector(referencePoints),
        [referencePoints],
    );
    const toMeters = useMemo(() => metersConverter(projector), [projector]);
    // The walking grid is built on the first route request, not on page load.
    const routerRef = useRef<ReturnType<typeof createRouter> | null>(null);

    const locationById = useMemo(
        () => new Map(locations.map((l) => [l.id, l])),
        [locations],
    );

    // The visitor's own device location, when they ask for it. Never on the
    // kiosk PC itself: it doesn't move, and its location guess is rough.
    const { kioskMode } = usePage().props;
    const [useMyLocation, setUseMyLocation] = useState(false);
    const geo = useGeolocation(useMyLocation && !kioskMode);
    const devicePoint =
        projector && geo.fix
            ? projector.project(geo.fix.latitude, geo.fix.longitude)
            : null;
    const precise =
        geo.fix !== null &&
        geo.fix.accuracy <= PRECISE_FIX_METERS &&
        !geo.stale;
    const onCampus =
        devicePoint !== null &&
        devicePoint.x >= -CAMPUS_MARGIN &&
        devicePoint.x <= 100 + CAMPUS_MARGIN &&
        devicePoint.y >= -CAMPUS_MARGIN &&
        devicePoint.y <= 100 + CAMPUS_MARGIN;
    const fromDevice = useMyLocation && precise && onCampus;
    // Rounded to about 2 m, so GPS jitter doesn't re-plan the walk constantly.
    const deviceX = fromDevice ? Math.round(devicePoint.x) : null;
    const deviceY = fromDevice ? Math.round(devicePoint.y) : null;
    const origin = useMemo(
        () =>
            deviceX !== null && deviceY !== null
                ? { x: deviceX, y: deviceY }
                : kioskPosition,
        [deviceX, deviceY, kioskPosition],
    );

    const locationNote = (() => {
        if (!useMyLocation) {
            return null;
        }

        if (!projector) {
            return "This campus map isn't set up for GPS yet, so routes start from the kiosk.";
        }

        if (geo.status !== 'active' || !geo.fix) {
            return LOCATION_STATUS[geo.status] ?? null;
        }

        if (!precise) {
            return `Your location is only accurate to about ${formatDistance(geo.fix.accuracy)}${handheld ? '' : ' (laptops guess it from Wi-Fi)'}, so routes start from the kiosk for now.`;
        }

        if (!onCampus) {
            return "You're not on campus yet, so routes start from the kiosk.";
        }

        return null;
    })();

    // Kiosks always have a starting point; phones need their own location.
    const showKiosk = !handheld || fromDevice;

    const walk = useMemo(() => {
        if (!destination || !showKiosk) {
            return null;
        }

        // Offices placed on a floor plan: walk to the nearest entrance, then
        // through the hallways to the door.
        const plan =
            destination.kind === 'office' && destination.office.floor_room
                ? floorPlanFor(destination.location.name)
                : null;
        const indoor =
            plan && destination.kind === 'office'
                ? planIndoorWalk(
                      plan,
                      destination.office.floor_room ?? '',
                      origin,
                      destination.office.name,
                  )
                : null;
        const guide = planWalk(
            (from, to) =>
                (routerRef.current ??= createRouter(CAMPUS_WALKING)).route(
                    from,
                    to,
                ),
            origin,
            indoor
                ? entranceApproach(indoor.plan, indoor.entrance)
                : destination.location,
            toMeters,
        );

        if (!guide) {
            return null;
        }

        return {
            guide,
            indoor,
            steps: describeWalk(
                guide,
                destination.location.name,
                projector !== null,
                fromDevice ? 'Start from where you are now.' : undefined,
            ),
            photos: photosAlongRoute(guide, panoramas, projector, toMeters),
        };
    }, [
        destination,
        showKiosk,
        origin,
        fromDevice,
        toMeters,
        projector,
        panoramas,
    ]);

    const pick = (next: Destination) => {
        setPhotoIndex(null);
        setInside(false);
        setDestination(next);
    };
    const pickLocation = (point: CampusMapPoint) => {
        const location = locationById.get(point.id);

        if (location) {
            pick({ kind: 'building', location });
        }
    };
    const pickOffice = (office: Office) => {
        const location = locationById.get(office.campus_location_id);

        if (location) {
            pick({ kind: 'office', office, location });
        }
    };

    const q = query.trim().toLowerCase();
    const matches = (...fields: (string | null | undefined)[]) =>
        q === '' || fields.some((f) => f?.toLowerCase().includes(q));
    const shownOffices = offices.filter((o) =>
        matches(
            o.name,
            o.description,
            o.room,
            locationById.get(o.campus_location_id)?.name,
        ),
    );
    const shownBuildings = locations.filter((l) =>
        matches(l.name, l.description),
    );

    const photo =
        photoIndex !== null && walk ? walk.photos[photoIndex] : undefined;
    const floorNames = walk?.indoor
        ? Object.fromEntries(
              offices
                  .filter(
                      (o) =>
                          o.floor_room &&
                          locationById.get(o.campus_location_id)?.name ===
                              walk.indoor!.plan.building,
                  )
                  .map((o) => [o.floor_room, o.name]),
          )
        : undefined;

    const news = [
        ...featuredEvents.map((e) => ({
            key: `e${e.id}`,
            slug: e.slug,
            title: e.title,
            date: e.event_start_at,
            venue: e.location,
            time: `${timeOf(e.event_start_at)}${e.event_end_at ? ` – ${timeOf(e.event_end_at)}` : ''}`,
        })),
        ...latestAnnouncements
            .filter((a) => !featuredEvents.some((e) => e.slug === a.slug))
            .map((a) => ({
                key: `a${a.id}`,
                slug: a.slug,
                title: a.title,
                date: a.event_start_at ?? a.published_at,
                venue: a.location,
                time: a.event_start_at ? timeOf(a.event_start_at) : null,
            })),
    ].slice(0, 4);

    const name =
        destination?.kind === 'office'
            ? destination.office.name
            : destination?.location.name;

    return (
        <>
            <Head title="Welcome" />

            <div className="flex flex-col gap-3 bg-gradient-to-b from-brand-900 to-brand-950 p-3 text-white lg:h-full lg:min-h-0 xl:p-4">
                <div className="flex flex-col gap-3 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_15rem_23rem] xl:grid-cols-[minmax(0,1fr)_17rem_26rem]">
                    {/* Interactive campus map */}
                    <section className={panel}>
                        <PanelTitle
                            icon={MapIcon}
                            aside={
                                walk?.indoor && photoIndex === null ? (
                                    <div
                                        role="group"
                                        aria-label="Map view"
                                        className="flex gap-1 rounded-full bg-brand-950/70 p-1"
                                    >
                                        {(
                                            [
                                                {
                                                    value: false,
                                                    Icon: MapIcon,
                                                    label: 'Campus',
                                                },
                                                {
                                                    value: true,
                                                    Icon: DoorOpen,
                                                    label: `Inside ${walk.indoor.plan.building}`,
                                                },
                                            ] satisfies {
                                                value: boolean;
                                                Icon: LucideIcon;
                                                label: string;
                                            }[]
                                        ).map(({ value, Icon, label }) => (
                                            <button
                                                key={String(value)}
                                                type="button"
                                                aria-pressed={inside === value}
                                                onClick={() => setInside(value)}
                                                className={cn(
                                                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold',
                                                    inside === value
                                                        ? 'bg-gradient-to-b from-gold-300 to-gold-500 text-brand-950'
                                                        : 'text-white/85',
                                                )}
                                            >
                                                <Icon className="size-4" />
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                ) : null
                            }
                        >
                            Interactive Campus Map{' '}
                            <span className="text-sm font-medium text-white/70">
                                (3D Navigation)
                            </span>
                        </PanelTitle>

                        <div className="relative h-[58vh] min-h-0 lg:h-auto lg:flex-1">
                            <CampusMap
                                className="absolute inset-0 aspect-auto rounded-none border-0"
                                labeledPins
                                points={
                                    destination
                                        ? [destination.location]
                                        : locations
                                }
                                activeId={destination?.location.id ?? null}
                                onPointClick={pickLocation}
                                route={walk?.guide.points ?? null}
                                userLocation={
                                    fromDevice
                                        ? { ...origin, label: 'You' }
                                        : !handheld
                                          ? {
                                                ...kioskPosition,
                                                label: 'You are here',
                                            }
                                          : null
                                }
                            />

                            {!kioskMode && photoIndex === null && !inside && (
                                <div className="absolute top-3 right-3 z-[5] flex max-w-[18rem] flex-col items-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (
                                                !useMyLocation &&
                                                window.isSecureContext &&
                                                'geolocation' in navigator
                                            ) {
                                                // Ask straight from the tap; some phones only prompt then.
                                                navigator.geolocation.getCurrentPosition(
                                                    () => {},
                                                    () => {},
                                                    {
                                                        enableHighAccuracy: true,
                                                    },
                                                );
                                            }

                                            if (useMyLocation) {
                                                geo.reset();
                                            }

                                            setUseMyLocation(!useMyLocation);
                                        }}
                                        className={cn(
                                            'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur transition-colors',
                                            fromDevice
                                                ? 'border-sky-300 bg-sky-500 text-white'
                                                : 'border-gold-400/60 bg-brand-950/85 text-white hover:bg-brand-900',
                                        )}
                                    >
                                        {useMyLocation ? (
                                            <LocateOff className="size-4" />
                                        ) : (
                                            <LocateFixed className="size-4 text-gold-300" />
                                        )}
                                        {useMyLocation
                                            ? 'Stop using my location'
                                            : 'Use my location'}
                                    </button>
                                    {locationNote && (
                                        <p
                                            role="status"
                                            className="rounded-xl bg-brand-950/90 px-3 py-2 text-right text-xs leading-snug text-white/90 shadow-lg backdrop-blur"
                                        >
                                            {locationNote}
                                        </p>
                                    )}
                                </div>
                            )}

                            {!destination && (
                                <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-gold-400/60 bg-brand-950/85 px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur">
                                    <MousePointerClick className="size-4 text-gold-300" />
                                    Touch a place to see how to get there
                                </div>
                            )}

                            {destination && walk && (
                                <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 rounded-2xl border border-gold-400/60 bg-brand-950/85 px-4 py-2.5 shadow-lg backdrop-blur">
                                    <Navigation className="size-5 text-gold-300" />
                                    <div className="leading-tight">
                                        <div className="font-bold">
                                            To {name}
                                        </div>
                                        <div className="text-sm text-white/75">
                                            {projector
                                                ? `${formatDistance(walk.guide.length)} · about ${walkingMinutes(walk.guide.length)} min walk`
                                                : 'Follow the blue line'}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {inside && walk?.indoor && (
                                <FloorPlanView
                                    className="absolute inset-0 z-10"
                                    plan={walk.indoor.plan}
                                    target={walk.indoor.room}
                                    route={walk.indoor.points}
                                    names={floorNames}
                                />
                            )}

                            {/* 360° preview of the walk, facing the way to go. */}
                            {photo && walk && (
                                <PanoramaViewer
                                    className="absolute inset-0 z-10"
                                    panorama={photo.panorama}
                                    heading={photo.heading}
                                >
                                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                        <div className="flex flex-col items-center gap-1 rounded-full bg-brand-800/85 px-5 py-3 text-white shadow-xl">
                                            <ArrowUp className="size-8 text-gold-300" />
                                            <span className="text-sm font-bold">
                                                Walk this way
                                            </span>
                                        </div>
                                    </div>
                                    <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
                                        <Button
                                            size="lg"
                                            variant="secondary"
                                            className="shadow-lg"
                                            disabled={photoIndex === 0}
                                            onClick={() =>
                                                setPhotoIndex((i) =>
                                                    Math.max(0, (i ?? 0) - 1),
                                                )
                                            }
                                        >
                                            <ChevronLeft /> Back
                                        </Button>
                                        <div className="rounded-lg bg-background/90 px-3 py-2 text-center text-sm font-medium text-foreground shadow-lg backdrop-blur">
                                            {panoramaTitle(photo.panorama)}
                                            <span className="block text-xs text-muted-foreground">
                                                Stop {(photoIndex ?? 0) + 1} of{' '}
                                                {walk.photos.length} · drag to
                                                look around
                                            </span>
                                        </div>
                                        {photoIndex !== null &&
                                        photoIndex < walk.photos.length - 1 ? (
                                            <Button
                                                size="lg"
                                                className="shadow-lg"
                                                onClick={() =>
                                                    setPhotoIndex(
                                                        (i) => (i ?? 0) + 1,
                                                    )
                                                }
                                            >
                                                Next <ChevronRight />
                                            </Button>
                                        ) : (
                                            <Button
                                                size="lg"
                                                className="shadow-lg"
                                                onClick={() =>
                                                    setPhotoIndex(null)
                                                }
                                            >
                                                Done
                                            </Button>
                                        )}
                                    </div>
                                    <Button
                                        size="icon"
                                        variant="secondary"
                                        className="absolute top-3 right-3 shadow-lg"
                                        onClick={() => setPhotoIndex(null)}
                                        aria-label="Close the 360° preview"
                                    >
                                        <X />
                                    </Button>
                                </PanoramaViewer>
                            )}
                        </div>
                    </section>

                    {/* Select a location */}
                    <section
                        className={cn(panel, 'max-h-[70vh] lg:max-h-none')}
                    >
                        <PanelTitle icon={MousePointerClick}>
                            Select a Location
                        </PanelTitle>
                        <div className="space-y-2 border-b border-white/10 p-3">
                            <div className="grid grid-cols-2 gap-1 rounded-full bg-brand-950/70 p-1">
                                {(
                                    [
                                        ['buildings', 'Buildings'],
                                        ['offices', 'Offices'],
                                    ] as const
                                ).map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        aria-pressed={tab === value}
                                        onClick={() => setTab(value)}
                                        className={cn(
                                            'rounded-full py-1.5 text-sm font-semibold transition-colors',
                                            tab === value
                                                ? 'bg-white text-brand-900'
                                                : 'text-white/80',
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <div className="relative">
                                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/60" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search"
                                    className="h-10 w-full rounded-full border border-white/20 bg-brand-950/60 pr-3 pl-9 text-sm text-white placeholder:text-white/50 focus:border-gold-400 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 [scrollbar-width:none] space-y-2 overflow-y-auto p-3 [&::-webkit-scrollbar]:hidden">
                            {tab === 'buildings' &&
                                shownBuildings.map((location) => {
                                    const Icon = iconFor(location.name);
                                    const active =
                                        destination?.kind === 'building' &&
                                        destination.location.id === location.id;

                                    return (
                                        <button
                                            key={location.id}
                                            type="button"
                                            onClick={() =>
                                                pick({
                                                    kind: 'building',
                                                    location,
                                                })
                                            }
                                            className={cn(
                                                'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-[15px] leading-tight font-semibold transition-colors',
                                                active
                                                    ? 'border-gold-300 bg-gradient-to-b from-gold-300 to-gold-500 text-brand-950 shadow-md'
                                                    : 'border-white/20 bg-brand-900/60 hover:bg-brand-800',
                                            )}
                                        >
                                            <Icon className="size-5 shrink-0" />
                                            {location.name}
                                        </button>
                                    );
                                })}
                            {tab === 'offices' &&
                                shownOffices.map((office) => {
                                    const active =
                                        destination?.kind === 'office' &&
                                        destination.office.id === office.id;

                                    return (
                                        <button
                                            key={office.id}
                                            type="button"
                                            onClick={() => pickOffice(office)}
                                            className={cn(
                                                'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left leading-tight transition-colors',
                                                active
                                                    ? 'border-gold-300 bg-gradient-to-b from-gold-300 to-gold-500 text-brand-950 shadow-md'
                                                    : 'border-white/20 bg-brand-900/60 hover:bg-brand-800',
                                            )}
                                        >
                                            <DoorOpen className="size-5 shrink-0" />
                                            <span className="min-w-0">
                                                <span className="block text-[15px] font-semibold">
                                                    {office.name}
                                                </span>
                                                <span
                                                    className={cn(
                                                        'block truncate text-xs',
                                                        active
                                                            ? 'text-brand-900/80'
                                                            : 'text-white/60',
                                                    )}
                                                >
                                                    {
                                                        locationById.get(
                                                            office.campus_location_id,
                                                        )?.name
                                                    }
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })}
                            {((tab === 'buildings' &&
                                shownBuildings.length === 0) ||
                                (tab === 'offices' &&
                                    shownOffices.length === 0)) && (
                                <p className="py-6 text-center text-sm text-white/60">
                                    {q
                                        ? `Nothing matches “${query.trim()}”.`
                                        : 'Nothing here yet.'}
                                </p>
                            )}
                        </div>

                        <Link
                            href={directoryIndex()}
                            className="flex items-center justify-center gap-1.5 border-t border-white/10 py-2.5 text-sm font-semibold text-gold-300 hover:text-gold-200"
                        >
                            Offices & hotlines directory
                            <ArrowRight className="size-4" />
                        </Link>
                    </section>

                    {/* Location details and news */}
                    <div className="flex min-h-0 flex-col gap-3">
                        {/* Keeps its own height; the news below gives way
                            (and scrolls) when the screen is short. */}
                        <section
                            className={cn(
                                'flex min-h-0 flex-col overflow-hidden rounded-2xl border-2 border-gold-400 bg-gradient-to-b from-white to-gold-200/60 text-brand-950 shadow-xl',
                                destination ? 'lg:flex-1' : 'shrink-0',
                            )}
                        >
                            <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-gold-300 to-gold-500 px-4 py-2.5">
                                <h2 className="flex items-center gap-2 text-lg font-bold">
                                    <Info className="size-5 rounded-full bg-brand-900 p-0.5 text-white" />
                                    Location Details
                                </h2>
                                {destination && (
                                    <button
                                        type="button"
                                        onClick={reset}
                                        className="flex items-center gap-1 rounded-full bg-brand-900/10 px-2.5 py-1 text-sm font-semibold hover:bg-brand-900/20"
                                    >
                                        <X className="size-4" /> Clear
                                    </button>
                                )}
                            </div>

                            {!destination ? (
                                <div className="flex gap-3 p-4">
                                    <div className="flex size-24 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-800 to-brand-950 text-gold-300 shadow-inner">
                                        <MapPin className="size-10 fill-gold-400 text-brand-950" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-extrabold text-brand-800">
                                            Welcome!
                                        </h3>
                                        <p className="mt-1 text-[15px] leading-snug text-brand-950/80">
                                            {fromDevice
                                                ? 'Touch a building or office and we’ll show you the way from where you are.'
                                                : showKiosk
                                                  ? 'Touch a building or office and we’ll show you the way from this kiosk.'
                                                  : 'Tap “Use my location”, then pick a building or office to get directions.'}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                                    <div className="flex gap-3">
                                        {destination.location.photo_url ? (
                                            <img
                                                src={
                                                    destination.location
                                                        .photo_url
                                                }
                                                alt=""
                                                className="aspect-[4/3] w-32 shrink-0 rounded-xl object-cover shadow-md xl:w-36"
                                            />
                                        ) : (
                                            <div className="flex aspect-[4/3] w-32 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-700 to-brand-950 text-gold-300 shadow-md xl:w-36">
                                                {(() => {
                                                    const Icon =
                                                        destination.kind ===
                                                        'office'
                                                            ? DoorOpen
                                                            : iconFor(
                                                                  destination
                                                                      .location
                                                                      .name,
                                                              );

                                                    return (
                                                        <Icon className="size-10" />
                                                    );
                                                })()}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <h3 className="text-2xl leading-tight font-extrabold text-brand-800">
                                                {name}
                                            </h3>
                                            {destination.kind === 'office' && (
                                                <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-brand-700">
                                                    <MapPin className="size-4 shrink-0" />
                                                    {destination.location.name}
                                                </p>
                                            )}
                                            <p className="mt-1 text-[15px] leading-snug text-brand-950/80">
                                                {destination.kind === 'office'
                                                    ? (destination.office
                                                          .description ??
                                                      destination.office.room)
                                                    : destination.location
                                                          .description}
                                            </p>
                                        </div>
                                    </div>

                                    {destination.kind === 'office' &&
                                        (destination.office.office_hours ||
                                            destination.office.phone) && (
                                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-brand-950/80">
                                                {destination.office
                                                    .office_hours && (
                                                    <span className="flex items-center gap-1.5">
                                                        <Clock className="size-4" />
                                                        {
                                                            destination.office
                                                                .office_hours
                                                        }
                                                    </span>
                                                )}
                                                {destination.office.phone && (
                                                    <span className="flex items-center gap-1.5">
                                                        <Phone className="size-4" />
                                                        {
                                                            destination.office
                                                                .phone
                                                        }
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                    {!showKiosk ? (
                                        <Link
                                            href={mapsIndex({
                                                query: {
                                                    location:
                                                        destination.location.id,
                                                },
                                            })}
                                            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-brand-800 px-4 py-3 font-semibold text-white"
                                        >
                                            <Navigation className="size-5" />
                                            Navigate with my phone
                                        </Link>
                                    ) : walk ? (
                                        <>
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {walk.photos.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setPhotoIndex(0)
                                                        }
                                                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-800 px-3 py-2.5 font-semibold text-white shadow-md active:scale-[0.98]"
                                                    >
                                                        <Orbit className="size-5 text-gold-300" />
                                                        360° walk preview
                                                    </button>
                                                )}
                                                {walk.indoor && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setInside(!inside)
                                                        }
                                                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-800 px-3 py-2.5 font-semibold text-white shadow-md active:scale-[0.98]"
                                                    >
                                                        <DoorOpen className="size-5 text-gold-300" />
                                                        {inside
                                                            ? 'Campus route'
                                                            : 'Floor map'}
                                                    </button>
                                                )}
                                            </div>

                                            <h4 className="mt-4 mb-2 text-xs font-bold tracking-wider text-brand-700 uppercase">
                                                How to get there
                                            </h4>
                                            <ol className="space-y-1.5">
                                                {[
                                                    ...walk.steps.map((s) => ({
                                                        ...s,
                                                        indoor: false,
                                                    })),
                                                    ...(
                                                        walk.indoor?.steps ?? []
                                                    ).map((s) => ({
                                                        ...s,
                                                        indoor: true,
                                                    })),
                                                ].map((step, i, all) => (
                                                    <li
                                                        key={i}
                                                        className="flex items-start gap-2.5 rounded-xl bg-white/80 p-2.5 shadow-sm"
                                                    >
                                                        <span
                                                            className={cn(
                                                                'flex size-8 shrink-0 items-center justify-center rounded-full',
                                                                step.indoor
                                                                    ? 'bg-red-600/10 text-red-600'
                                                                    : 'bg-brand-800/10 text-brand-800',
                                                            )}
                                                        >
                                                            {i ===
                                                            all.length - 1 ? (
                                                                <MapPin className="size-5" />
                                                            ) : (
                                                                <TurnIcon
                                                                    turn={
                                                                        step.turn
                                                                    }
                                                                />
                                                            )}
                                                        </span>
                                                        <span className="pt-1 text-[15px] leading-snug">
                                                            {step.text}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ol>
                                            {!walk.indoor &&
                                                destination.kind === 'office' &&
                                                destination.office.room && (
                                                    <p className="mt-2 rounded-xl border-2 border-dashed border-brand-700/40 p-2.5 text-[15px]">
                                                        Inside, find{' '}
                                                        <strong>{name}</strong>:{' '}
                                                        {
                                                            destination.office
                                                                .room
                                                        }
                                                        .
                                                    </p>
                                                )}
                                        </>
                                    ) : (
                                        <p className="mt-4 text-sm text-brand-950/70">
                                            Couldn’t work out a walking route to
                                            this place. Please ask the guard or
                                            a staff member for directions.
                                        </p>
                                    )}
                                </div>
                            )}
                        </section>

                        {/* News: hidden while directions take the space. */}
                        <section
                            className={cn(
                                'flex min-h-0 flex-col overflow-hidden rounded-2xl border-2 border-gold-400 bg-white text-brand-950 shadow-xl lg:flex-1',
                                destination && 'lg:hidden',
                            )}
                        >
                            <div className="flex items-center gap-2 bg-gradient-to-r from-gold-300 to-gold-500 px-4 py-2.5">
                                <Megaphone className="size-5" />
                                <h2 className="text-lg font-bold">
                                    Announcements & Events
                                </h2>
                            </div>
                            <div className="min-h-0 flex-1 [scrollbar-width:none] divide-y divide-brand-900/10 overflow-y-auto px-4 [&::-webkit-scrollbar]:hidden">
                                {news.length === 0 && (
                                    <p className="py-4 text-sm text-brand-950/60">
                                        No announcements right now.
                                    </p>
                                )}
                                {news.map((item) => (
                                    <Link
                                        key={item.key}
                                        href={announcementShow(item.slug)}
                                        className="flex items-center gap-3 py-2.5"
                                    >
                                        {item.date ? (
                                            <DateBadge value={item.date} />
                                        ) : (
                                            <Megaphone className="size-6 shrink-0 text-red-600" />
                                        )}
                                        <span className="min-w-0 flex-1 text-sm leading-snug">
                                            <span className="line-clamp-1 font-bold">
                                                {item.title}
                                            </span>
                                            {item.venue && (
                                                <span className="block truncate text-brand-950/75">
                                                    Venue: {item.venue}
                                                </span>
                                            )}
                                            {item.time && (
                                                <span className="block text-brand-950/75">
                                                    Time: {item.time}
                                                </span>
                                            )}
                                        </span>
                                        <ChevronRight className="size-6 shrink-0 rounded-full bg-gold-400 p-1 text-brand-950" />
                                    </Link>
                                ))}
                            </div>
                            <div className="p-3 pt-1">
                                <Link
                                    href={announcementsIndex()}
                                    className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-300 to-gold-500 py-2.5 font-bold shadow-md"
                                >
                                    View All Announcements & Events
                                    <ArrowRight className="size-4" />
                                </Link>
                            </div>
                        </section>
                    </div>
                </div>

                <KioskMarquee items={ticker} />
            </div>
        </>
    );
}

KioskHome.layout = { immersive: true };
