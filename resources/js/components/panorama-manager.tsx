import { Form, router } from '@inertiajs/react';
import {
    Compass,
    LocateFixed,
    MapPinned,
    Navigation2,
    Orbit,
    Trash2,
    Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import CampusPanoramaController from '@/actions/App/Http/Controllers/Admin/CampusPanoramaController';
import InputError from '@/components/input-error';
import { PanoramaViewer } from '@/components/panorama-viewer';
import type { PanoramaView } from '@/components/panorama-viewer';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDeviceHeading } from '@/hooks/use-device-heading';
import { useGeolocation } from '@/hooks/use-geolocation';
import { parseCoordinates } from '@/lib/campus-geo';
import { panoramaTitle } from '@/lib/panorama';
import type { CampusPanorama } from '@/lib/panorama';

/**
 * Lines a photo up with real-world north. Either face north in the photo
 * by hand, or (standing at the spot with a phone) match the photo to what
 * you see and let the compass work it out.
 */
function SetNorthDialog({
    panorama,
    onClose,
}: {
    panorama: CampusPanorama;
    onClose: () => void;
}) {
    const viewRef = useRef<PanoramaView | null>(null);
    const compass = useDeviceHeading(true);
    const [northOffset, setNorthOffset] = useState(panorama.north_offset);
    const [processing, setProcessing] = useState(false);

    const save = (offset: number) => {
        const north = Math.round((((offset % 360) + 360) % 360) * 100) / 100;
        setNorthOffset(north);
        router.put(
            CampusPanoramaController.update.url(panorama.id),
            {
                title: panorama.title,
                latitude: panorama.latitude,
                longitude: panorama.longitude,
                north_offset: north,
            },
            {
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onSuccess: onClose,
            },
        );
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>
                        Set north · {panoramaTitle(panorama)}
                    </DialogTitle>
                    <DialogDescription>
                        Drag the photo until the middle of the view faces north,
                        then tap “This way is north”. Or, standing at this spot
                        with your phone, line the photo up with what you see and
                        tap “Match my compass”.
                    </DialogDescription>
                </DialogHeader>

                {/* Without a heading the viewer opens facing the saved north. */}
                <PanoramaViewer
                    panorama={{ ...panorama, north_offset: northOffset }}
                    viewRef={viewRef}
                    className="aspect-video w-full rounded-lg"
                >
                    {/* Crosshair marking the middle of the view */}
                    <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-red-500/80" />
                </PanoramaViewer>

                <DialogFooter className="gap-2 sm:justify-between">
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">
                            Cancel
                        </Button>
                    </DialogClose>
                    <div className="flex flex-wrap gap-2">
                        {compass.status === 'needs-permission' && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => void compass.requestPermission()}
                            >
                                <Compass /> Allow compass
                            </Button>
                        )}
                        {compass.heading !== null && (
                            <Button
                                type="button"
                                variant="outline"
                                disabled={processing}
                                onClick={() =>
                                    save(
                                        (viewRef.current?.photoDegrees ?? 0) -
                                            (compass.heading ?? 0),
                                    )
                                }
                            >
                                <Compass /> Match my compass
                            </Button>
                        )}
                        <Button
                            type="button"
                            disabled={processing}
                            onClick={() =>
                                save(
                                    viewRef.current?.photoDegrees ??
                                        northOffset,
                                )
                            }
                        >
                            <Navigation2 /> This way is north
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Fixes a photo's name and GPS spot. Cameras often save a stale or rough
 * position (especially indoors), so the spot can be re-taken by standing
 * there with a phone, or pasted from Google Maps.
 */
function EditPositionDialog({
    panorama,
    onClose,
}: {
    panorama: CampusPanorama;
    onClose: () => void;
}) {
    const [latitude, setLatitude] = useState(String(panorama.latitude));
    const [longitude, setLongitude] = useState(String(panorama.longitude));
    const [locating, setLocating] = useState(false);
    const [pasted, setPasted] = useState('');
    // Keep the most precise reading while the phone settles.
    const geo = useGeolocation(locating, { keepBest: true });
    const parsed = pasted.trim() === '' ? null : parseCoordinates(pasted);

    const applySpot = (lat: number, lng: number) => {
        setLatitude(lat.toFixed(7));
        setLongitude(lng.toFixed(7));
    };

    let locatingText = 'Finding your location…';

    if (geo.fix) {
        locatingText = `Best reading so far: ±${Math.round(geo.fix.accuracy)} m`;
    } else if (geo.status === 'denied') {
        locatingText = 'Location is blocked for this site.';
    } else if (geo.status === 'insecure') {
        locatingText = 'Location needs an https link.';
    }

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        Edit position · {panoramaTitle(panorama)}
                    </DialogTitle>
                    <DialogDescription>
                        Phones show the photo taken nearest to them, so this
                        spot should be exactly where the camera stood.
                    </DialogDescription>
                </DialogHeader>

                <Form
                    {...CampusPanoramaController.update.form(panorama.id)}
                    onSuccess={onClose}
                    className="space-y-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-panorama-title">
                                    Name
                                </Label>
                                <Input
                                    id="edit-panorama-title"
                                    name="title"
                                    defaultValue={panorama.title ?? ''}
                                    placeholder="e.g. Chapel Driveway"
                                />
                                <InputError message={errors.title} />
                            </div>

                            <div className="space-y-2 rounded-lg border p-3">
                                <div className="text-sm font-medium">
                                    Use my location here
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Stand where the photo was taken, outdoors if
                                    you can, and hold still for a few seconds.
                                </p>
                                {locating ? (
                                    <div className="flex flex-wrap items-center gap-2 text-sm">
                                        <span className="text-muted-foreground">
                                            {locatingText}
                                        </span>
                                        {geo.fix && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => {
                                                    if (geo.fix) {
                                                        applySpot(
                                                            geo.fix.latitude,
                                                            geo.fix.longitude,
                                                        );
                                                    }

                                                    setLocating(false);
                                                }}
                                            >
                                                Use this reading
                                            </Button>
                                        )}
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setLocating(false)}
                                        >
                                            Stop
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            geo.reset();
                                            setLocating(true);
                                        }}
                                    >
                                        <LocateFixed /> Get my GPS
                                    </Button>
                                )}
                            </div>

                            <div className="space-y-2 rounded-lg border p-3">
                                <Label htmlFor="edit-panorama-paste">
                                    Or paste from Google Maps
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Long-press the spot in Google Maps, copy the
                                    numbers it shows, and paste them here.
                                </p>
                                <div className="flex gap-2">
                                    <Input
                                        id="edit-panorama-paste"
                                        value={pasted}
                                        onChange={(e) =>
                                            setPasted(e.target.value)
                                        }
                                        placeholder="12.9709333, 123.9940417"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={!parsed?.ok}
                                        onClick={() => {
                                            if (parsed?.ok) {
                                                applySpot(
                                                    parsed.latitude,
                                                    parsed.longitude,
                                                );
                                                setPasted('');
                                            }
                                        }}
                                    >
                                        Use
                                    </Button>
                                </div>
                                {parsed && !parsed.ok && (
                                    <InputError message={parsed.error} />
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="grid gap-1">
                                    <Label htmlFor="edit-panorama-lat">
                                        Latitude
                                    </Label>
                                    <Input
                                        id="edit-panorama-lat"
                                        name="latitude"
                                        inputMode="decimal"
                                        value={latitude}
                                        onChange={(e) =>
                                            setLatitude(e.target.value)
                                        }
                                    />
                                    <InputError message={errors.latitude} />
                                </div>
                                <div className="grid gap-1">
                                    <Label htmlFor="edit-panorama-lng">
                                        Longitude
                                    </Label>
                                    <Input
                                        id="edit-panorama-lng"
                                        name="longitude"
                                        inputMode="decimal"
                                        value={longitude}
                                        onChange={(e) =>
                                            setLongitude(e.target.value)
                                        }
                                    />
                                    <InputError message={errors.longitude} />
                                </div>
                            </div>

                            <input
                                type="hidden"
                                name="north_offset"
                                value={panorama.north_offset}
                            />

                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="secondary">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button disabled={processing}>Save</Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}

/** Upload, line up and remove the campus 360° photos. */
export function PanoramaManager({
    panoramas,
}: {
    panoramas: CampusPanorama[];
}) {
    const [settingNorth, setSettingNorth] = useState<CampusPanorama | null>(
        null,
    );
    const [deleting, setDeleting] = useState<CampusPanorama | null>(null);
    const [editing, setEditing] = useState<CampusPanorama | null>(null);

    return (
        <section className="flex flex-col gap-4 rounded-xl border border-sidebar-border/70 p-4 dark:border-sidebar-border">
            <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Orbit className="size-5" /> 360° photos
                </h2>
                <p className="text-sm text-muted-foreground">
                    Visitors' phones show the photo taken nearest to where they
                    stand, turned to match their compass. Upload full 360° JPEGs
                    (twice as wide as tall). The GPS spot is read from the photo
                    when the camera saved it.
                </p>
            </div>

            <Form
                {...CampusPanoramaController.store.form()}
                resetOnSuccess
                className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            >
                {({ processing, errors, progress }) => (
                    <>
                        <div className="grid gap-2">
                            <Label htmlFor="panorama-title">Name</Label>
                            <Input
                                id="panorama-title"
                                name="title"
                                placeholder="e.g. Main Gate"
                            />
                            <InputError message={errors.title} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="panorama-image">360° photo</Label>
                            <Input
                                id="panorama-image"
                                name="image"
                                type="file"
                                accept="image/jpeg"
                                required
                            />
                            <InputError message={errors.image} />
                        </div>
                        <Button disabled={processing}>
                            <Upload />
                            {progress
                                ? `Uploading ${progress.percentage}%`
                                : 'Upload'}
                        </Button>

                        {/* Only for photos the camera saved no GPS in. */}
                        {errors.latitude && (
                            <div className="grid gap-2 sm:col-span-3 sm:grid-cols-2">
                                <InputError
                                    className="sm:col-span-2"
                                    message={errors.latitude}
                                />
                                <Input
                                    name="latitude"
                                    inputMode="decimal"
                                    placeholder="Latitude, e.g. 12.9709333"
                                />
                                <Input
                                    name="longitude"
                                    inputMode="decimal"
                                    placeholder="Longitude, e.g. 123.9940417"
                                />
                            </div>
                        )}
                    </>
                )}
            </Form>

            {panoramas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    No 360° photos yet.
                </p>
            ) : (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {panoramas.map((panorama) => (
                        <li
                            key={panorama.id}
                            className="overflow-hidden rounded-lg border border-sidebar-border/70 dark:border-sidebar-border"
                        >
                            <img
                                src={panorama.url}
                                alt=""
                                loading="lazy"
                                className="aspect-[2/1] w-full object-cover"
                            />
                            <div className="flex items-start justify-between gap-2 p-3">
                                <div className="min-w-0 text-sm">
                                    <div className="truncate font-medium">
                                        {panoramaTitle(panorama)}
                                    </div>
                                    <div className="text-xs text-muted-foreground tabular-nums">
                                        {panorama.latitude.toFixed(6)},{' '}
                                        {panorama.longitude.toFixed(6)}
                                    </div>
                                </div>
                                <div className="flex shrink-0 gap-1">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditing(panorama)}
                                    >
                                        <MapPinned /> Position
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                            setSettingNorth(panorama)
                                        }
                                    >
                                        <Navigation2 /> Set north
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="size-8"
                                        onClick={() => setDeleting(panorama)}
                                    >
                                        <Trash2 />
                                        <span className="sr-only">Remove</span>
                                    </Button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {editing && (
                <EditPositionDialog
                    key={editing.id}
                    panorama={editing}
                    onClose={() => setEditing(null)}
                />
            )}

            {settingNorth && (
                <SetNorthDialog
                    key={settingNorth.id}
                    panorama={settingNorth}
                    onClose={() => setSettingNorth(null)}
                />
            )}

            <Dialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove this 360° photo?</DialogTitle>
                        <DialogDescription>
                            {deleting && panoramaTitle(deleting)} will no longer
                            show on visitors' phones.
                        </DialogDescription>
                    </DialogHeader>
                    {deleting && (
                        <Form
                            {...CampusPanoramaController.destroy.form(
                                deleting.id,
                            )}
                            onSuccess={() => setDeleting(null)}
                        >
                            {({ processing }) => (
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                        >
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                    <Button
                                        variant="destructive"
                                        disabled={processing}
                                    >
                                        Remove
                                    </Button>
                                </DialogFooter>
                            )}
                        </Form>
                    )}
                </DialogContent>
            </Dialog>
        </section>
    );
}
