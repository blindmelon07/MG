import { Head } from '@inertiajs/react';
import { MapPin } from 'lucide-react';
import { useState } from 'react';
import { CampusMap } from '@/components/campus-map';
import type { CampusMapPoint } from '@/components/campus-map';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// How close (in map percent) a tap must land to select a location.
const TAP_RADIUS = 8;

function nearestLocation(
    locations: CampusMapPoint[],
    { x, y }: { x: number; y: number },
) {
    let nearest: CampusMapPoint | null = null;
    let nearestDistance = TAP_RADIUS;

    for (const location of locations) {
        const distance = Math.hypot(location.x - x, location.y - y);

        if (distance <= nearestDistance) {
            nearest = location;
            nearestDistance = distance;
        }
    }

    return nearest;
}

export default function KioskMapsIndex({
    locations,
}: {
    locations: CampusMapPoint[];
}) {
    const [activeId, setActiveId] = useState<number | null>(null);
    const active = locations.find((location) => location.id === activeId);

    return (
        <>
            <Head title="Campus Map" />

            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Campus Map
                    </h1>
                    <p className="text-muted-foreground">
                        Tap a place on the map or a location below to find your
                        way around Aemilianum College Inc.
                    </p>
                </div>

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
