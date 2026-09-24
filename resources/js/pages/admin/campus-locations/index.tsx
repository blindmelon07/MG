import { Form, Head } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import CampusLocationController from '@/actions/App/Http/Controllers/Admin/CampusLocationController';
import { CampusMap } from '@/components/campus-map';
import type { CampusMapPoint } from '@/components/campus-map';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { index as campusLocationsIndex } from '@/routes/admin/campus-locations';

type CampusLocation = CampusMapPoint & { sort_order: number };

export default function CampusLocationsIndex({
    locations,
}: {
    locations: CampusLocation[];
}) {
    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<CampusLocation | null>(null);
    const [deleting, setDeleting] = useState<CampusLocation | null>(null);
    const [newPoint, setNewPoint] = useState<{ x: number; y: number } | null>(
        null,
    );
    const [editPoint, setEditPoint] = useState<{
        x: number;
        y: number;
    } | null>(null);

    return (
        <>
            <Head title="Campus Map" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <div className="flex items-center justify-between">
                    <Heading
                        title="Campus Map"
                        description="Manage the pins shown on the kiosk's campus map. Click the map to place a pin."
                    />

                    <Dialog
                        open={createOpen}
                        onOpenChange={(open) => {
                            setCreateOpen(open);

                            if (!open) {
                                setNewPoint(null);
                            }
                        }}
                    >
                        <DialogTrigger asChild>
                            <Button>
                                <Plus /> New Location
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>New Location</DialogTitle>
                            </DialogHeader>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <CampusMap
                                        points={locations}
                                        onMapClick={(coords) =>
                                            setNewPoint(coords)
                                        }
                                        previewPoint={newPoint}
                                    />
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        Click anywhere on the map to set this
                                        location&apos;s pin.
                                    </p>
                                </div>

                                <Form
                                    {...CampusLocationController.store.form()}
                                    resetOnSuccess
                                    onSuccess={() => {
                                        setCreateOpen(false);
                                        setNewPoint(null);
                                    }}
                                    className="space-y-4"
                                >
                                    {({ processing, errors }) => (
                                        <>
                                            <div className="grid gap-2">
                                                <Label htmlFor="name">
                                                    Name
                                                </Label>
                                                <Input
                                                    id="name"
                                                    name="name"
                                                    required
                                                    placeholder="e.g. Library"
                                                />
                                                <InputError
                                                    message={errors.name}
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="description">
                                                    Description
                                                </Label>
                                                <Textarea
                                                    id="description"
                                                    name="description"
                                                    placeholder="Optional description"
                                                />
                                                <InputError
                                                    message={errors.description}
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="sort_order">
                                                    Sort order
                                                </Label>
                                                <Input
                                                    id="sort_order"
                                                    name="sort_order"
                                                    type="number"
                                                    min={0}
                                                    defaultValue={0}
                                                />
                                                <InputError
                                                    message={errors.sort_order}
                                                />
                                            </div>

                                            <input
                                                type="hidden"
                                                name="x"
                                                value={newPoint?.x ?? ''}
                                            />
                                            <input
                                                type="hidden"
                                                name="y"
                                                value={newPoint?.y ?? ''}
                                            />
                                            <InputError message={errors.x} />

                                            <DialogFooter>
                                                <Button
                                                    type="submit"
                                                    disabled={
                                                        processing || !newPoint
                                                    }
                                                >
                                                    Create
                                                </Button>
                                            </DialogFooter>
                                        </>
                                    )}
                                </Form>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                <CampusMap
                    points={locations}
                    className="max-w-3xl"
                    onPointClick={(point) =>
                        setEditing(
                            locations.find((l) => l.id === point.id) ?? null,
                        )
                    }
                />

                <div className="overflow-x-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <table className="w-full text-sm">
                        <thead className="border-b border-sidebar-border/70 bg-muted/50 text-left dark:border-sidebar-border">
                            <tr>
                                <th className="px-4 py-2 font-medium">Name</th>
                                <th className="px-4 py-2 font-medium">
                                    Position
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    Sort order
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {locations.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="px-4 py-6 text-center text-muted-foreground"
                                    >
                                        No locations yet. Click &quot;New
                                        Location&quot; to add the first pin.
                                    </td>
                                </tr>
                            )}
                            {locations.map((location) => (
                                <tr
                                    key={location.id}
                                    className="border-b border-sidebar-border/70 last:border-0 dark:border-sidebar-border"
                                >
                                    <td className="px-4 py-2">
                                        <div className="font-medium">
                                            {location.name}
                                        </div>
                                        {location.description && (
                                            <div className="text-xs text-muted-foreground">
                                                {location.description}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 text-muted-foreground">
                                        {location.x.toFixed(1)}%,{' '}
                                        {location.y.toFixed(1)}%
                                    </td>
                                    <td className="px-4 py-2">
                                        {location.sort_order}
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    setEditing(location);
                                                    setEditPoint({
                                                        x: location.x,
                                                        y: location.y,
                                                    });
                                                }}
                                            >
                                                <Pencil />
                                                <span className="sr-only">
                                                    Edit
                                                </span>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    setDeleting(location)
                                                }
                                            >
                                                <Trash2 />
                                                <span className="sr-only">
                                                    Delete
                                                </span>
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Dialog
                open={editing !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditing(null);
                        setEditPoint(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Location</DialogTitle>
                    </DialogHeader>
                    {editing && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <CampusMap
                                    points={locations.filter(
                                        (l) => l.id !== editing.id,
                                    )}
                                    onMapClick={(coords) =>
                                        setEditPoint(coords)
                                    }
                                    previewPoint={editPoint}
                                />
                                <p className="mt-2 text-xs text-muted-foreground">
                                    Click anywhere on the map to move this pin.
                                </p>
                            </div>

                            <Form
                                {...CampusLocationController.update.form(
                                    editing.id,
                                )}
                                onSuccess={() => {
                                    setEditing(null);
                                    setEditPoint(null);
                                }}
                                className="space-y-4"
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <div className="grid gap-2">
                                            <Label htmlFor="edit_name">
                                                Name
                                            </Label>
                                            <Input
                                                id="edit_name"
                                                name="name"
                                                required
                                                defaultValue={editing.name}
                                            />
                                            <InputError message={errors.name} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="edit_description">
                                                Description
                                            </Label>
                                            <Textarea
                                                id="edit_description"
                                                name="description"
                                                defaultValue={
                                                    editing.description ?? ''
                                                }
                                            />
                                            <InputError
                                                message={errors.description}
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="edit_sort_order">
                                                Sort order
                                            </Label>
                                            <Input
                                                id="edit_sort_order"
                                                name="sort_order"
                                                type="number"
                                                min={0}
                                                defaultValue={
                                                    editing.sort_order
                                                }
                                            />
                                            <InputError
                                                message={errors.sort_order}
                                            />
                                        </div>

                                        <input
                                            type="hidden"
                                            name="x"
                                            value={editPoint?.x ?? editing.x}
                                        />
                                        <input
                                            type="hidden"
                                            name="y"
                                            value={editPoint?.y ?? editing.y}
                                        />
                                        <InputError message={errors.x} />

                                        <DialogFooter>
                                            <Button
                                                type="submit"
                                                disabled={processing}
                                            >
                                                Save
                                            </Button>
                                        </DialogFooter>
                                    </>
                                )}
                            </Form>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete location?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        This will remove &quot;{deleting?.name}&quot; from the
                        campus map.
                    </p>
                    {deleting && (
                        <Form
                            {...CampusLocationController.destroy.form(
                                deleting.id,
                            )}
                            onSuccess={() => setDeleting(null)}
                        >
                            {({ processing }) => (
                                <DialogFooter className="mt-4">
                                    <DialogClose asChild>
                                        <Button variant="secondary">
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                    <Button
                                        type="submit"
                                        variant="destructive"
                                        disabled={processing}
                                    >
                                        Delete
                                    </Button>
                                </DialogFooter>
                            )}
                        </Form>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

CampusLocationsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Campus Map',
            href: campusLocationsIndex(),
        },
    ],
};
