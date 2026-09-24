import { Head } from '@inertiajs/react';
import { LocateFixed, LocateOff, MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CampusMap } from '@/components/campus-map';
import type { CampusMapPoint } from '@/components/campus-map';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useGeolocation } from '@/hooks/use-geolocation';
import type { GeolocationStatus } from '@/hooks/use-geolocation';
import { createGeoProjector } from '@/lib/campus-geo';
import type { GeoReferencePoint } from '@/lib/campus-geo';
import { cn } from '@/lib/utils';

// How close (in map percent) a tap must land to select a location.
const TAP_RADIUS = 8;
// How close the visitor must be to a location to say they're "near" it.
const NEAR_RADIUS = 10;
// How far outside the map edge still counts as being on campus.
const CAMPUS_MARGIN = 5;

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

/** Phones and tablets carry GPS and move with the visitor; kiosks don't. */
function isHandheld() {
    return (
        typeof navigator !== 'undefined' &&
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    );
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
    // Start locating straight away on phones; kiosks use the button.
    const [tracking, setTracking] = useState(isHandheld);
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

    let locationMessage = projector
        ? (STATUS_MESSAGES[geo.status] ?? null)
        : "Your location can't be shown yet: the school still needs to set up GPS for this map.";

    if (geo.status === 'active' && geo.fix) {
        const accuracy = `(accurate to about ${Math.round(geo.fix.accuracy)} m)`;

        if (!onCampus) {
            locationMessage = `You appear to be outside the campus ${accuracy}.`;
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
                    <div className="lg:col-span-2">
                        {/* Pins stay hidden until a location is chosen,
                            either from the list or by tapping the map. */}
                        <CampusMap
                            points={active ? [active] : []}
                            activeId={activeId}
                            onPointClick={(point) => setActiveId(point.id)}
                            onMapClick={(coords) =>
                                setActiveId(
                                    nearestLocation(locations, coords)?.id ??
                                        null,
                                )
                            }
                            userLocation={onCampus ? userPoint : null}
                        />
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
