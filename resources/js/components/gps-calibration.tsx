import { Form } from '@inertiajs/react';
import {
    ClipboardPaste,
    ExternalLink,
    LocateFixed,
    Plus,
    Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import MapReferencePointController from '@/actions/App/Http/Controllers/Admin/MapReferencePointController';
import { CampusMap } from '@/components/campus-map';
import type { CampusMapPoint } from '@/components/campus-map';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { createGeoProjector, parseCoordinates } from '@/lib/campus-geo';
import type { GeoReferencePoint } from '@/lib/campus-geo';
import { isHandheld } from '@/lib/device';
import { cn } from '@/lib/utils';

export type MapReferencePoint = GeoReferencePoint & {
    id: number;
    label: string | null;
    accuracy: number | null;
};

type Source = 'paste' | 'gps';

const GPS_STATUS: Record<string, string> = {
    locating: 'Waiting for a GPS signal…',
    unsupported: "This device can't share its location.",
    insecure:
        'GPS only works on a secure (https) link. Open the admin panel over https on your phone.',
    denied: 'Location permission was blocked. Allow it in your browser settings.',
    unavailable: 'No GPS signal. Step outdoors, away from buildings.',
};

/**
 * Lines the campus map up with real GPS. Each reference point pairs a real
 * position with the same spot on the map. The position can be pasted from
 * Google Maps (from any computer) or read from a phone standing at the spot.
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
    const [source, setSource] = useState<Source>(() =>
        isHandheld() ? 'gps' : 'paste',
    );
    const [pasted, setPasted] = useState('');
    const [sampling, setSampling] = useState(false);
    const [mapPoint, setMapPoint] = useState<{ x: number; y: number } | null>(
        null,
    );
    const geo = useGeolocation(open && source === 'gps' && sampling, {
        keepBest: true,
    });

    const parsed = pasted.trim() === '' ? null : parseCoordinates(pasted);
    const reading =
        source === 'paste'
            ? parsed?.ok
                ? {
                      latitude: parsed.latitude,
                      longitude: parsed.longitude,
                      accuracy: null,
                  }
                : null
            : geo.fix;

    const close = () => {
        setOpen(false);
        setSampling(false);
        setPasted('');
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
                    description="Lines the map up with real GPS so students can see where they are on their phones. For 3–4 easy-to-spot places spread around the campus (the main gate, building corners), give their real coordinates and click the same place on the map."
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
                                Pick a landmark that&apos;s easy to find both on
                                Google Maps and on this map, like the main gate
                                or a building corner.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <CampusMap
                                    points={locations}
                                    onMapClick={setMapPoint}
                                    previewPoint={mapPoint}
                                    userLocation={
                                        projector && reading
                                            ? projector.project(
                                                  reading.latitude,
                                                  reading.longitude,
                                              )
                                            : null
                                    }
                                />
                                <p className="mt-2 text-xs text-muted-foreground">
                                    Click the map at that landmark.
                                    {projector &&
                                        ' The blue dot shows where the current calibration puts those coordinates.'}
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
                                            <Label>1. Real coordinates</Label>

                                            <div
                                                className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
                                                role="tablist"
                                                aria-label="Where the coordinates come from"
                                            >
                                                {(
                                                    [
                                                        [
                                                            'paste',
                                                            'From Google Maps',
                                                            ClipboardPaste,
                                                        ],
                                                        [
                                                            'gps',
                                                            "My phone's GPS",
                                                            LocateFixed,
                                                        ],
                                                    ] as const
                                                ).map(
                                                    ([value, label, Icon]) => (
                                                        <button
                                                            key={value}
                                                            type="button"
                                                            role="tab"
                                                            aria-selected={
                                                                source === value
                                                            }
                                                            onClick={() => {
                                                                setSource(
                                                                    value,
                                                                );
                                                                setSampling(
                                                                    false,
                                                                );
                                                                geo.reset();
                                                            }}
                                                            className={cn(
                                                                'flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                                                                source === value
                                                                    ? 'bg-background shadow-sm'
                                                                    : 'text-muted-foreground hover:text-foreground',
                                                            )}
                                                        >
                                                            <Icon className="size-4" />
                                                            {label}
                                                        </button>
                                                    ),
                                                )}
                                            </div>

                                            {source === 'paste' ? (
                                                <div className="grid gap-2">
                                                    <ol className="list-decimal space-y-0.5 pl-5 text-xs text-muted-foreground">
                                                        <li>
                                                            Open{' '}
                                                            <a
                                                                href="https://www.google.com/maps/@?api=1&map_action=map&basemap=satellite"
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="font-medium text-primary underline-offset-4 hover:underline"
                                                            >
                                                                Google Maps
                                                            </a>{' '}
                                                            on satellite view.
                                                        </li>
                                                        <li>
                                                            Right-click exactly
                                                            on the landmark (on
                                                            a phone: press and
                                                            hold).
                                                        </li>
                                                        <li>
                                                            Click the numbers at
                                                            the top of the menu
                                                            to copy them, then
                                                            paste them here.
                                                        </li>
                                                    </ol>
                                                    <Input
                                                        aria-label="Coordinates"
                                                        placeholder="13.036512, 124.003298"
                                                        value={pasted}
                                                        onChange={(e) =>
                                                            setPasted(
                                                                e.target.value,
                                                            )
                                                        }
                                                        inputMode="decimal"
                                                        autoComplete="off"
                                                    />
                                                    {parsed && !parsed.ok && (
                                                        <p className="text-sm text-destructive">
                                                            {parsed.error}
                                                        </p>
                                                    )}
                                                    {parsed?.ok && (
                                                        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                                                            Latitude{' '}
                                                            {parsed.latitude.toFixed(
                                                                6,
                                                            )}
                                                            , longitude{' '}
                                                            {parsed.longitude.toFixed(
                                                                6,
                                                            )}
                                                            <a
                                                                href={`https://www.google.com/maps/search/?api=1&query=${parsed.latitude},${parsed.longitude}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                                                            >
                                                                Check on Google
                                                                Maps
                                                                <ExternalLink className="size-3" />
                                                            </a>
                                                        </p>
                                                    )}
                                                    {parsed?.ok &&
                                                        parsed.fromLink && (
                                                            <Alert>
                                                                <AlertDescription>
                                                                    A Maps link
                                                                    gives the
                                                                    centre of
                                                                    the screen,
                                                                    which may
                                                                    not be the
                                                                    landmark.
                                                                    Right-click
                                                                    the exact
                                                                    spot and
                                                                    copy its
                                                                    numbers
                                                                    instead for
                                                                    a precise
                                                                    point.
                                                                </AlertDescription>
                                                            </Alert>
                                                        )}
                                                </div>
                                            ) : (
                                                <div className="grid gap-2">
                                                    <p className="text-xs text-muted-foreground">
                                                        Stand at the landmark
                                                        with your phone,
                                                        outdoors if possible.
                                                    </p>
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
                                                </div>
                                            )}
                                            <InputError
                                                message={errors.latitude}
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label>
                                                2. Same spot on this map
                                            </Label>
                                            <p className="text-sm text-muted-foreground">
                                                {mapPoint
                                                    ? `Marked at ${mapPoint.x.toFixed(1)}%, ${mapPoint.y.toFixed(1)}%.`
                                                    : 'Click the map at the landmark.'}
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
                                            value={reading?.latitude ?? ''}
                                        />
                                        <input
                                            type="hidden"
                                            name="longitude"
                                            value={reading?.longitude ?? ''}
                                        />
                                        <input
                                            type="hidden"
                                            name="accuracy"
                                            value={reading?.accuracy ?? ''}
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
                                                    !reading ||
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
                                    {point.accuracy !== null
                                        ? ` (phone GPS, ±${Math.round(point.accuracy)} m)`
                                        : ' (entered)'}{' '}
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
