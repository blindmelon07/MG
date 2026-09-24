import { Form } from '@inertiajs/react';
import { LocateFixed, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import MapReferencePointController from '@/actions/App/Http/Controllers/Admin/MapReferencePointController';
import { CampusMap } from '@/components/campus-map';
import type { CampusMapPoint } from '@/components/campus-map';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGeolocation } from '@/hooks/use-geolocation';
import { createGeoProjector } from '@/lib/campus-geo';
import type { GeoReferencePoint } from '@/lib/campus-geo';

export type MapReferencePoint = GeoReferencePoint & {
    id: number;
    label: string | null;
    accuracy: number | null;
};

const GPS_STATUS: Record<string, string> = {
    locating: 'Waiting for a GPS signal…',
    unsupported: "This device can't share its location.",
    insecure:
        'GPS only works on a secure (https) link. Open the admin panel over https on your phone.',
    denied: 'Location permission was blocked. Allow it in your browser settings.',
    unavailable: 'No GPS signal. Step outdoors, away from buildings.',
};

/**
 * Lets an admin line the campus map up with real GPS: stand somewhere on
 * campus, take a GPS reading, tap the same spot on the map, save.
 */
export function GpsCalibration({
    referencePoints,
    locations,
}: {
    referencePoints: MapReferencePoint[];
    locations: CampusMapPoint[];
}) {
    const projector = useMemo(
        () => createGeoProjector(referencePoints),
        [referencePoints],
    );

    const [open, setOpen] = useState(false);
    const [sampling, setSampling] = useState(false);
    const [mapPoint, setMapPoint] = useState<{ x: number; y: number } | null>(
        null,
    );
    const geo = useGeolocation(open && sampling, { keepBest: true });

    const close = () => {
        setOpen(false);
        setSampling(false);
        setMapPoint(null);
        geo.reset();
    };

    let quality: string;

    if (projector) {
        quality = `Phone location is on. The map matches GPS to about ${Math.max(1, Math.round(projector.errorMeters))} m`;
        quality +=
            referencePoints.length < 3
                ? ' — add a third point to check accuracy.'
                : '.';
    } else if (referencePoints.length === 0) {
        quality = 'Phone location is off until at least 2 points are added.';
    } else {
        quality =
            'Phone location is off. Add another point at least 15 m away from the others.';
    }

    return (
        <div className="flex max-w-3xl flex-col gap-4 rounded-xl border border-sidebar-border/70 p-4 dark:border-sidebar-border">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <Heading
                    variant="small"
                    title="GPS calibration"
                    description="Lines the map up with real GPS so students can see their own location on their phones. Stand at an easy-to-spot place, like a building corner or the main gate, take a reading, then tap that same place on the map. Use 3–4 places spread around the campus."
                />

                <Dialog
                    open={open}
                    onOpenChange={(next) => (next ? setOpen(true) : close())}
                >
                    <DialogTrigger asChild>
                        <Button variant="secondary">
                            <Plus /> Add GPS point
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Add GPS reference point</DialogTitle>
                            <DialogDescription>
                                Do this on your phone while standing at the
                                spot, outdoors if possible.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <CampusMap
                                    points={locations}
                                    onMapClick={setMapPoint}
                                    previewPoint={mapPoint}
                                    userLocation={
                                        projector && geo.fix
                                            ? projector.project(
                                                  geo.fix.latitude,
                                                  geo.fix.longitude,
                                              )
                                            : null
                                    }
                                />
                                <p className="mt-2 text-xs text-muted-foreground">
                                    Tap the map exactly where you are standing.
                                    {projector &&
                                        ' The blue dot shows where the current calibration places you.'}
                                </p>
                            </div>

                            <Form
                                {...MapReferencePointController.store.form()}
                                onSuccess={close}
                                className="space-y-4"
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <div className="grid gap-2">
                                            <Label>1. GPS reading</Label>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => {
                                                    geo.reset();
                                                    setSampling(true);
                                                }}
                                            >
                                                <LocateFixed />
                                                {sampling
                                                    ? 'Restart reading'
                                                    : 'Use my GPS'}
                                            </Button>
                                            {sampling && (
                                                <p className="text-sm text-muted-foreground">
                                                    {geo.fix
                                                        ? `Accurate to about ${Math.round(geo.fix.accuracy)} m. Hold still for a few seconds — the best reading is kept.`
                                                        : (GPS_STATUS[
                                                              geo.status
                                                          ] ?? null)}
                                                </p>
                                            )}
                                            <InputError
                                                message={errors.latitude}
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label>2. Spot on the map</Label>
                                            <p className="text-sm text-muted-foreground">
                                                {mapPoint
                                                    ? `Marked at ${mapPoint.x.toFixed(1)}%, ${mapPoint.y.toFixed(1)}%.`
                                                    : 'Tap the map where you are standing.'}
                                            </p>
                                            <InputError message={errors.x} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="reference_label">
                                                Label
                                            </Label>
                                            <Input
                                                id="reference_label"
                                                name="label"
                                                placeholder="e.g. Main gate"
                                            />
                                            <InputError
                                                message={errors.label}
                                            />
                                        </div>

                                        <input
                                            type="hidden"
                                            name="latitude"
                                            value={geo.fix?.latitude ?? ''}
                                        />
                                        <input
                                            type="hidden"
                                            name="longitude"
                                            value={geo.fix?.longitude ?? ''}
                                        />
                                        <input
                                            type="hidden"
                                            name="accuracy"
                                            value={geo.fix?.accuracy ?? ''}
                                        />
                                        <input
                                            type="hidden"
                                            name="x"
                                            value={mapPoint?.x ?? ''}
                                        />
                                        <input
                                            type="hidden"
                                            name="y"
                                            value={mapPoint?.y ?? ''}
                                        />

                                        <DialogFooter>
                                            <Button
                                                type="submit"
                                                disabled={
                                                    processing ||
                                                    !geo.fix ||
                                                    !mapPoint
                                                }
                                            >
                                                Save point
                                            </Button>
                                        </DialogFooter>
                                    </>
                                )}
                            </Form>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <p className="text-sm">{quality}</p>

            {referencePoints.length > 0 && (
                <ul className="divide-y divide-sidebar-border/70 text-sm dark:divide-sidebar-border">
                    {referencePoints.map((point) => (
                        <li
                            key={point.id}
                            className="flex items-center justify-between gap-3 py-2"
                        >
                            <div>
                                <div className="font-medium">
                                    {point.label ?? 'Unlabelled point'}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {point.latitude.toFixed(6)},{' '}
                                    {point.longitude.toFixed(6)}
                                    {point.accuracy !== null &&
                                        ` (±${Math.round(point.accuracy)} m)`}{' '}
                                    → map {point.x.toFixed(1)}%,{' '}
                                    {point.y.toFixed(1)}%
                                </div>
                            </div>
                            <Form
                                {...MapReferencePointController.destroy.form(
                                    point.id,
                                )}
                            >
                                {({ processing }) => (
                                    <Button
                                        type="submit"
                                        variant="ghost"
                                        size="icon"
                                        disabled={processing}
                                    >
                                        <Trash2 />
                                        <span className="sr-only">
                                            Remove point
                                        </span>
                                    </Button>
                                )}
                            </Form>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
