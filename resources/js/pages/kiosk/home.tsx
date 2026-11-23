import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowUp,
    BookOpen,
    Building2,
    ChevronLeft,
    ChevronRight,
    Clock,
    CornerUpLeft,
    CornerUpRight,
    DoorOpen,
    Footprints,
    GraduationCap,
    MapPin,
    Megaphone,
    Navigation,
    Orbit,
    Map as MapIcon,
    Phone,
    Search,
    Sparkles,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CAMPUS_WALKING, CampusMap } from '@/components/campus-map';
import type { CampusMapPoint } from '@/components/campus-map';
import { FloorPlanView } from '@/components/floor-plan-view';
import { PanoramaViewer } from '@/components/panorama-viewer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { show as announcementShow } from '@/routes/announcements';
import { index as announcementsIndex } from '@/routes/announcements';
import { index as directoryIndex } from '@/routes/directory';
import { index as manualsIndex } from '@/routes/manuals';
import { index as mapsIndex } from '@/routes/maps';
import { login as studentLogin } from '@/routes/student';

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
    location: string | null;
};

type Announcement = {
    id: number;
    title: string;
    slug: string;
    type: 'announcement' | 'event';
};

/** What the visitor picked: a building, or an office inside one. */
type Destination =
    | { kind: 'building'; location: CampusMapPoint }
    | { kind: 'office'; office: Office; location: CampusMapPoint };

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

const QUICK_LINKS = [
    {
        title: 'Directory',
        hint: 'Offices & hotlines',
        icon: Building2,
        href: directoryIndex(),
    },
    {
        title: 'School Manual',
        hint: 'Policies & guides',
        icon: BookOpen,
        href: manualsIndex(),
    },
    {
        title: 'News & Events',
        hint: "What's happening",
        icon: Megaphone,
        href: announcementsIndex(),
    },
    {
        title: 'My Acads',
        hint: 'Grades & subjects',
        icon: GraduationCap,
        href: studentLogin({ query: { kiosk: 1 } }),
    },
];

export default function KioskHome({
    locations,
    offices,
    kioskPosition,
    referencePoints,
    panoramas,
    featuredEvents,
    latestAnnouncements,
    focus,
    handheld,
}: {
    locations: CampusMapPoint[];
    offices: Office[];
    kioskPosition: { x: number; y: number };
    referencePoints: GeoReferencePoint[];
    panoramas: CampusPanorama[];
    featuredEvents: FeaturedEvent[];
    latestAnnouncements: Announcement[];
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
    const [tab, setTab] = useState<'offices' | 'buildings'>(
        offices.length > 0 ? 'offices' : 'buildings',
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

    // Phones get GPS navigation on the Campus Map instead of kiosk routes.
    const showKiosk = !handheld;

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
                      kioskPosition,
                  )
                : null;
        const guide = planWalk(
            (from, to) =>
                (routerRef.current ??= createRouter(CAMPUS_WALKING)).route(
                    from,
                    to,
                ),
            kioskPosition,
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
            ),
            photos: photosAlongRoute(guide, panoramas, projector, toMeters),
        };
    }, [destination, showKiosk, kioskPosition, toMeters, projector, panoramas]);

    const pickLocation = (location: CampusMapPoint) => {
        setPhotoIndex(null);
        setInside(false);
        setDestination({ kind: 'building', location });
    };

    const pickOffice = (office: Office) => {
        const location = locationById.get(office.campus_location_id);

        if (location) {
            setPhotoIndex(null);
            setInside(false);
            setDestination({ kind: 'office', office, location });
        }
    };

    const q = query.trim().toLowerCase();
    const matches = (...fields: (string | null)[]) =>
        q === '' || fields.some((f) => f?.toLowerCase().includes(q));
    const shownOffices = offices.filter((o) =>
        matches(
            o.name,
            o.description,
            o.room,
            locationById.get(o.campus_location_id)?.name ?? null,
        ),
    );
    const shownBuildings = locations.filter((l) =>
        matches(l.name, l.description),
    );

    const photo =
        photoIndex !== null && walk ? walk.photos[photoIndex] : undefined;
    const tickerItems = [
        ...featuredEvents.map((e) => ({
            key: `e${e.id}`,
            slug: e.slug,
            text: `${e.title} · ${new Date(e.event_start_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}${e.location ? ` · ${e.location}` : ''}`,
            event: true,
        })),
        ...latestAnnouncements
            .filter((a) => !featuredEvents.some((e) => e.slug === a.slug))
            .map((a) => ({
                key: `a${a.id}`,
                slug: a.slug,
                text: a.title,
                event: a.type === 'event',
            })),
    ];

    return (
        <>
            <Head title="Welcome" />

            <div className="flex flex-col md:h-full md:min-h-0 lg:grid lg:grid-cols-[minmax(0,1fr)_26rem]">
                {/* The map is the home screen. */}
                <div className="relative flex min-h-0 flex-1 flex-col">
                    <div className="relative min-h-0 flex-1">
                        <CampusMap
                            className="h-[58vh] rounded-none border-0 md:absolute md:inset-0 md:h-auto"
                            points={
                                destination ? [destination.location] : locations
                            }
                            activeId={destination?.location.id ?? null}
                            onPointClick={pickLocation}
                            route={walk?.guide.points ?? null}
                            userLocation={
                                showKiosk
                                    ? {
                                          ...kioskPosition,
                                          label: 'You are here',
                                      }
                                    : null
                            }
                        />

                        {/* Welcome card, until a place is picked. */}
                        {!destination && (
                            <div className="pointer-events-none absolute top-3 left-3 max-w-sm rounded-2xl bg-background/90 p-4 shadow-lg backdrop-blur md:top-5 md:left-5 md:p-5">
                                <p className="text-xs font-semibold tracking-wider text-primary uppercase">
                                    Welcome to Aemilianum College
                                </p>
                                <h1 className="mt-1 text-xl leading-tight font-bold md:text-2xl">
                                    Where do you want to go?
                                </h1>
                                <p className="mt-1.5 text-sm text-muted-foreground md:text-base">
                                    {showKiosk
                                        ? 'Touch a building on the map or pick an office, and we’ll show you the way from here.'
                                        : 'Pick an office or building to see it on the map.'}
                                </p>
                            </div>
                        )}

                        {destination && walk && (
                            <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-3 rounded-2xl bg-background/90 px-4 py-3 shadow-lg backdrop-blur md:top-5 md:left-5">
                                <Navigation className="size-6 text-primary" />
                                <div className="leading-tight">
                                    <div className="font-bold">
                                        To {destination.location.name}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {projector
                                            ? `${formatDistance(walk.guide.length)} · about ${walkingMinutes(walk.guide.length)} min walk`
                                            : 'Follow the blue line'}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Inside the building: the floor, with the walk to the door. */}
                        {inside && walk?.indoor && (
                            <FloorPlanView
                                className="absolute inset-0 z-10"
                                plan={walk.indoor.plan}
                                target={walk.indoor.room}
                                route={walk.indoor.points}
                            />
                        )}

                        {walk?.indoor && photoIndex === null && (
                            <div
                                role="group"
                                aria-label="Map view"
                                className="absolute top-3 right-3 z-20 flex gap-1 rounded-xl bg-background/95 p-1 shadow-lg backdrop-blur md:top-5 md:right-5"
                            >
                                <Button
                                    size="lg"
                                    variant={inside ? 'ghost' : 'default'}
                                    aria-pressed={!inside}
                                    onClick={() => setInside(false)}
                                >
                                    <MapIcon /> Campus
                                </Button>
                                <Button
                                    size="lg"
                                    variant={inside ? 'default' : 'ghost'}
                                    aria-pressed={inside}
                                    onClick={() => setInside(true)}
                                >
                                    <DoorOpen /> Inside{' '}
                                    {walk.indoor.plan.building}
                                </Button>
                            </div>
                        )}

                        {/* 360° preview of the walk, facing the way to go. */}
                        {photo && walk && (
                            <PanoramaViewer
                                className="absolute inset-0 z-10"
                                panorama={photo.panorama}
                                heading={photo.heading}
                            >
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-1 rounded-full bg-primary/85 px-5 py-3 text-primary-foreground shadow-xl">
                                        <ArrowUp className="size-8" />
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
                                    <div className="rounded-lg bg-background/90 px-3 py-2 text-center text-sm font-medium shadow-lg backdrop-blur">
                                        {panoramaTitle(photo.panorama)}
                                        <span className="block text-xs text-muted-foreground">
                                            Stop {(photoIndex ?? 0) + 1} of{' '}
                                            {walk.photos.length} · drag to look
                                            around
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
                                            onClick={() => setPhotoIndex(null)}
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

                    {/* Big touch targets for everything else on the kiosk. */}
                    <div className="hidden gap-3 border-t border-sidebar-border/70 bg-background p-3 md:grid md:grid-cols-4 dark:border-sidebar-border">
                        {QUICK_LINKS.map((link) => (
                            <Link
                                key={link.title}
                                href={link.href}
                                className="group flex items-center gap-3 rounded-2xl border-2 border-sidebar-border/70 p-3 transition-colors hover:border-primary active:scale-[0.98] dark:border-sidebar-border"
                            >
                                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                                    <link.icon className="size-6" />
                                </span>
                                <span className="min-w-0 leading-tight">
                                    <span className="block truncate text-lg font-bold">
                                        {link.title}
                                    </span>
                                    <span className="block truncate text-sm text-muted-foreground">
                                        {link.hint}
                                    </span>
                                </span>
                            </Link>
                        ))}
                    </div>

                    {tickerItems.length > 0 && (
                        <div className="hidden items-center gap-3 overflow-hidden border-t border-sidebar-border/70 bg-primary px-4 py-2 text-primary-foreground md:flex dark:border-sidebar-border">
                            <span className="flex shrink-0 items-center gap-1.5 text-sm font-bold uppercase">
                                <Sparkles className="size-4" /> Latest
                            </span>
                            <div className="relative min-w-0 flex-1 overflow-hidden">
                                <div className="kiosk-ticker flex w-max gap-10 whitespace-nowrap">
                                    {[...tickerItems, ...tickerItems].map(
                                        (item, i) => (
                                            <Link
                                                key={`${item.key}-${i}`}
                                                href={announcementShow(
                                                    item.slug,
                                                )}
                                                className="text-sm font-medium hover:underline"
                                            >
                                                {item.event ? '📅 ' : '📢 '}
                                                {item.text}
                                            </Link>
                                        ),
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Destination panel: pick a place, then read the way there. */}
                <aside className="flex min-h-0 flex-col border-sidebar-border/70 bg-muted/30 md:h-[42%] md:shrink-0 md:border-t lg:h-auto lg:border-t-0 lg:border-l dark:border-sidebar-border">
                    {destination ? (
                        <div className="flex min-h-0 flex-1 flex-col">
                            <div className="border-b border-sidebar-border/70 p-4 dark:border-sidebar-border">
                                <Button
                                    variant="ghost"
                                    className="mb-2 -ml-2"
                                    onClick={reset}
                                >
                                    <ArrowLeft /> All places
                                </Button>
                                <h2 className="text-2xl leading-tight font-bold">
                                    {destination.kind === 'office'
                                        ? destination.office.name
                                        : destination.location.name}
                                </h2>
                                {destination.kind === 'office' && (
                                    <p className="mt-1 flex items-center gap-1.5 text-base font-medium text-primary">
                                        <MapPin className="size-4 shrink-0" />
                                        {destination.location.name}
                                        {destination.office.room &&
                                            ` · ${destination.office.room}`}
                                    </p>
                                )}
                                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                    {destination.kind === 'office' ? (
                                        <>
                                            {destination.office.description && (
                                                <p>
                                                    {
                                                        destination.office
                                                            .description
                                                    }
                                                </p>
                                            )}
                                            {destination.office
                                                .office_hours && (
                                                <p className="flex items-center gap-1.5">
                                                    <Clock className="size-4" />
                                                    {
                                                        destination.office
                                                            .office_hours
                                                    }
                                                </p>
                                            )}
                                            {destination.office.phone && (
                                                <p className="flex items-center gap-1.5">
                                                    <Phone className="size-4" />
                                                    {destination.office.phone}
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        destination.location.description && (
                                            <p>
                                                {
                                                    destination.location
                                                        .description
                                                }
                                            </p>
                                        )
                                    )}
                                </div>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto p-4">
                                {!showKiosk ? (
                                    <Button
                                        size="lg"
                                        className="w-full"
                                        asChild
                                    >
                                        <Link
                                            href={mapsIndex({
                                                query: {
                                                    location:
                                                        destination.location.id,
                                                },
                                            })}
                                        >
                                            <Navigation /> Navigate with my
                                            phone
                                        </Link>
                                    </Button>
                                ) : walk ? (
                                    <>
                                        {walk.photos.length > 0 && (
                                            <Button
                                                size="lg"
                                                className="mb-4 h-14 w-full text-base"
                                                onClick={() => setPhotoIndex(0)}
                                            >
                                                <Orbit className="size-5" />
                                                Preview the walk in 360°
                                            </Button>
                                        )}
                                        <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                                            How to get there
                                        </h3>
                                        <ol className="space-y-2">
                                            {walk.steps.map((step, i) => (
                                                <li
                                                    key={i}
                                                    className="flex items-start gap-3 rounded-xl bg-background p-3 shadow-sm"
                                                >
                                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                                        {i ===
                                                        walk.steps.length -
                                                            1 ? (
                                                            <DoorOpen className="size-5" />
                                                        ) : (
                                                            <TurnIcon
                                                                turn={step.turn}
                                                            />
                                                        )}
                                                    </span>
                                                    <span className="pt-1.5 text-base">
                                                        {step.text}
                                                    </span>
                                                </li>
                                            ))}
                                            {!walk.indoor &&
                                                destination.kind === 'office' &&
                                                destination.office.room && (
                                                    <li className="flex items-start gap-3 rounded-xl border-2 border-dashed border-primary/40 p-3">
                                                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                                            <MapPin className="size-5" />
                                                        </span>
                                                        <span className="pt-1.5 text-base">
                                                            Inside, find{' '}
                                                            <strong>
                                                                {
                                                                    destination
                                                                        .office
                                                                        .name
                                                                }
                                                            </strong>
                                                            :{' '}
                                                            {
                                                                destination
                                                                    .office.room
                                                            }
                                                            .
                                                        </span>
                                                    </li>
                                                )}
                                        </ol>
                                        {walk.indoor && (
                                            <>
                                                <div className="mt-5 mb-2 flex items-center justify-between gap-2">
                                                    <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                                                        Inside the{' '}
                                                        {
                                                            walk.indoor.plan
                                                                .building
                                                        }{' '}
                                                        ·{' '}
                                                        {walk.indoor.plan.floor.toLowerCase()}
                                                    </h3>
                                                    {!inside && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() =>
                                                                setInside(true)
                                                            }
                                                        >
                                                            <MapIcon /> Floor
                                                            map
                                                        </Button>
                                                    )}
                                                </div>
                                                <ol className="space-y-2">
                                                    {walk.indoor.steps.map(
                                                        (step, i) => (
                                                            <li
                                                                key={i}
                                                                className="flex items-start gap-3 rounded-xl bg-background p-3 shadow-sm"
                                                            >
                                                                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-600/10 text-red-600 dark:text-red-400">
                                                                    {i ===
                                                                    walk.indoor!
                                                                        .steps
                                                                        .length -
                                                                        1 ? (
                                                                        <MapPin className="size-5" />
                                                                    ) : (
                                                                        <TurnIcon
                                                                            turn={
                                                                                step.turn
                                                                            }
                                                                        />
                                                                    )}
                                                                </span>
                                                                <span className="pt-1.5 text-base">
                                                                    {step.text}
                                                                </span>
                                                            </li>
                                                        ),
                                                    )}
                                                </ol>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-muted-foreground">
                                        Couldn’t work out a walking route to
                                        this place. Please ask the guard or a
                                        staff member for directions.
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex min-h-0 flex-1 flex-col">
                            <div className="space-y-3 border-b border-sidebar-border/70 p-4 dark:border-sidebar-border">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={query}
                                        onChange={(e) =>
                                            setQuery(e.target.value)
                                        }
                                        placeholder="Search offices and buildings"
                                        className="h-12 pl-10 text-base"
                                    />
                                </div>
                                <div
                                    role="tablist"
                                    className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
                                >
                                    {(
                                        [
                                            ['offices', 'Offices'],
                                            ['buildings', 'Buildings'],
                                        ] as const
                                    ).map(([value, label]) => (
                                        <button
                                            key={value}
                                            type="button"
                                            role="tab"
                                            aria-selected={tab === value}
                                            onClick={() => setTab(value)}
                                            className={cn(
                                                'rounded-lg py-2.5 text-base font-semibold transition-colors',
                                                tab === value
                                                    ? 'bg-background shadow-sm'
                                                    : 'text-muted-foreground',
                                            )}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                                {tab === 'offices' &&
                                    shownOffices.map((office) => (
                                        <button
                                            key={office.id}
                                            type="button"
                                            onClick={() => pickOffice(office)}
                                            className="flex w-full items-center gap-3 rounded-xl bg-background p-3 text-left shadow-sm transition-colors hover:bg-accent active:scale-[0.99]"
                                        >
                                            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                                <DoorOpen className="size-5" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-base font-semibold">
                                                    {office.name}
                                                </span>
                                                <span className="block truncate text-sm text-muted-foreground">
                                                    {
                                                        locationById.get(
                                                            office.campus_location_id,
                                                        )?.name
                                                    }
                                                    {office.room &&
                                                        ` · ${office.room}`}
                                                </span>
                                            </span>
                                            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                                        </button>
                                    ))}
                                {tab === 'buildings' &&
                                    shownBuildings.map((location) => (
                                        <button
                                            key={location.id}
                                            type="button"
                                            onClick={() =>
                                                pickLocation(location)
                                            }
                                            className="flex w-full items-center gap-3 rounded-xl bg-background p-3 text-left shadow-sm transition-colors hover:bg-accent active:scale-[0.99]"
                                        >
                                            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                                <Building2 className="size-5" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-base font-semibold">
                                                    {location.name}
                                                </span>
                                                {location.description && (
                                                    <span className="line-clamp-1 block text-sm text-muted-foreground">
                                                        {location.description}
                                                    </span>
                                                )}
                                            </span>
                                            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                                        </button>
                                    ))}
                                {((tab === 'offices' &&
                                    shownOffices.length === 0) ||
                                    (tab === 'buildings' &&
                                        shownBuildings.length === 0)) && (
                                    <p className="py-6 text-center text-muted-foreground">
                                        {q
                                            ? `Nothing matches “${query.trim()}”.`
                                            : tab === 'offices'
                                              ? 'No offices have been added yet.'
                                              : 'No buildings have been added yet.'}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </aside>

                {/* Phones: the quick links, under the list. */}
                <div className="grid grid-cols-2 gap-3 p-4 md:hidden">
                    {QUICK_LINKS.map((link) => (
                        <Link
                            key={link.title}
                            href={link.href}
                            className="flex items-center gap-2 rounded-xl border border-sidebar-border/70 p-3 font-semibold dark:border-sidebar-border"
                        >
                            <link.icon className="size-5 text-primary" />
                            {link.title}
                        </Link>
                    ))}
                </div>
            </div>
        </>
    );
}

KioskHome.layout = { immersive: true };
