import { Form, Head } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import DirectoryEntryController from '@/actions/App/Http/Controllers/Admin/DirectoryEntryController';
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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { RoomKind } from '@/lib/floor-plans';
import { index as directoryIndex } from '@/routes/admin/directory-entries';

type Category = 'office' | 'hotline';

type Entry = {
    id: number;
    category: Category;
    name: string;
    description: string | null;
    phone: string | null;
    email: string | null;
    office_hours: string | null;
    room: string | null;
    floor_room: string | null;
    campus_location_id: number | null;
    sort_order: number;
    campus_location: { id: number; name: string } | null;
};

type Location = { id: number; name: string };

type PlanRooms = {
    campus_location_id: number;
    floor: string;
    rooms: { key: string; name: string; kind: RoomKind }[];
};

const SECTIONS: { value: Category; label: string; hint: string }[] = [
    {
        value: 'office',
        label: 'Offices',
        hint: 'Pick the building so the kiosk can give directions to it.',
    },
    {
        value: 'hotline',
        label: 'Hotlines',
        hint: 'Numbers people can call: school lines and emergency services.',
    },
];

// Radix Select can't hold an empty value, so "no building" gets a stand-in.
const NO_LOCATION = 'none';

function EntryFields({
    entry,
    category,
    locations,
    floorPlans,
    errors,
}: {
    entry?: Entry;
    category: Category;
    locations: Location[];
    floorPlans: PlanRooms[];
    errors: Partial<Record<string, string>>;
}) {
    const [kind, setKind] = useState<Category>(entry?.category ?? category);
    const [locationId, setLocationId] = useState(
        entry?.campus_location_id
            ? String(entry.campus_location_id)
            : NO_LOCATION,
    );
    const [floorRoom, setFloorRoom] = useState(
        entry?.floor_room ?? NO_LOCATION,
    );
    const plan = floorPlans.find(
        (p) => String(p.campus_location_id) === locationId,
    );
    // Rooms people would be sent to (not stairs or open areas).
    const planRooms = plan
        ? plan.rooms.filter((r) => r.kind !== 'stairs' && r.kind !== 'open')
        : [];
    // A room from another building's plan doesn't count.
    const shownFloorRoom = planRooms.some((r) => r.key === floorRoom)
        ? floorRoom
        : NO_LOCATION;

    return (
        <>
            <input type="hidden" name="category" value={kind} />
            <input
                type="hidden"
                name="floor_room"
                value={
                    kind === 'office' && shownFloorRoom !== NO_LOCATION
                        ? shownFloorRoom
                        : ''
                }
            />
            <input
                type="hidden"
                name="campus_location_id"
                value={locationId === NO_LOCATION ? '' : locationId}
            />

            <div className="grid grid-cols-[9rem_1fr] gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="category">Type</Label>
                    <Select
                        value={kind}
                        onValueChange={(value) => setKind(value as Category)}
                    >
                        <SelectTrigger id="category" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="office">Office</SelectItem>
                            <SelectItem value="hotline">Hotline</SelectItem>
                        </SelectContent>
                    </Select>
                    <InputError message={errors.category} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                        id="name"
                        name="name"
                        required
                        defaultValue={entry?.name}
                        placeholder={
                            kind === 'office'
                                ? "Registrar's Office"
                                : 'School Clinic'
                        }
                    />
                    <InputError message={errors.name} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="phone">
                        Phone {kind === 'office' && '(optional)'}
                    </Label>
                    <Input
                        id="phone"
                        name="phone"
                        required={kind === 'hotline'}
                        defaultValue={entry?.phone ?? ''}
                        placeholder="(056) 211-0000 local 101"
                    />
                    <InputError message={errors.phone} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="email">Email (optional)</Label>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        defaultValue={entry?.email ?? ''}
                    />
                    <InputError message={errors.email} />
                </div>
            </div>

            {kind === 'office' && (
                <>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="campus_location">Building</Label>
                            <Select
                                value={locationId}
                                onValueChange={setLocationId}
                            >
                                <SelectTrigger
                                    id="campus_location"
                                    className="w-full"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NO_LOCATION}>
                                        Not on the map
                                    </SelectItem>
                                    {locations.map((location) => (
                                        <SelectItem
                                            key={location.id}
                                            value={String(location.id)}
                                        >
                                            {location.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={errors.campus_location_id} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="room">Where inside</Label>
                            <Input
                                id="room"
                                name="room"
                                defaultValue={entry?.room ?? ''}
                                placeholder="Ground floor, beside the Cashier"
                            />
                            <InputError message={errors.room} />
                        </div>
                    </div>
                    {plan && (
                        <div className="grid gap-2">
                            <Label htmlFor="floor_room">
                                Room on the {plan.floor.toLowerCase()} map
                            </Label>
                            <Select
                                value={shownFloorRoom}
                                onValueChange={setFloorRoom}
                            >
                                <SelectTrigger
                                    id="floor_room"
                                    className="w-full"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NO_LOCATION}>
                                        Not on the floor map
                                    </SelectItem>
                                    {planRooms.map((room) => (
                                        <SelectItem
                                            key={room.key}
                                            value={room.key}
                                        >
                                            {room.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                The kiosk walks visitors through the hallways to
                                this room&apos;s door.
                            </p>
                            <InputError message={errors.floor_room} />
                        </div>
                    )}
                    <div className="grid gap-2">
                        <Label htmlFor="office_hours">Office hours</Label>
                        <Input
                            id="office_hours"
                            name="office_hours"
                            defaultValue={entry?.office_hours ?? ''}
                            placeholder="Mon–Fri, 8:00 AM – 5:00 PM"
                        />
                        <InputError message={errors.office_hours} />
                    </div>
                </>
            )}

            <div className="grid gap-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                    id="description"
                    name="description"
                    rows={3}
                    defaultValue={entry?.description ?? ''}
                    placeholder="What people go here for"
                />
                <InputError message={errors.description} />
            </div>

            <div className="grid w-32 gap-2">
                <Label htmlFor="sort_order">Order</Label>
                <Input
                    id="sort_order"
                    name="sort_order"
                    type="number"
                    min="0"
                    defaultValue={entry?.sort_order ?? 0}
                />
                <InputError message={errors.sort_order} />
            </div>
        </>
    );
}

export default function DirectoryIndex({
    entries,
    locations,
    floorPlans,
}: {
    entries: Entry[];
    locations: Location[];
    floorPlans: PlanRooms[];
}) {
    const [creating, setCreating] = useState<Category | null>(null);
    const [editing, setEditing] = useState<Entry | null>(null);
    const [deleting, setDeleting] = useState<Entry | null>(null);

    return (
        <>
            <Head title="School Directory" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <Heading
                    title="School Directory"
                    description="Offices and hotlines shown on the kiosk's Directory page. Major buildings come from the Campus Map pins."
                />

                {SECTIONS.map((section) => {
                    const rows = entries.filter(
                        (entry) => entry.category === section.value,
                    );

                    return (
                        <section key={section.value} className="space-y-2">
                            <div className="flex flex-wrap items-end justify-between gap-2">
                                <div>
                                    <h2 className="text-sm font-semibold">
                                        {section.label}{' '}
                                        <span className="font-normal text-muted-foreground">
                                            ({rows.length})
                                        </span>
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        {section.hint}
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={() => setCreating(section.value)}
                                >
                                    <Plus /> Add{' '}
                                    {section.value === 'office'
                                        ? 'office'
                                        : 'hotline'}
                                </Button>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-sidebar-border/70 bg-muted/50 text-left dark:border-sidebar-border">
                                        <tr>
                                            <th className="px-4 py-2 font-medium">
                                                Name
                                            </th>
                                            <th className="px-4 py-2 font-medium">
                                                Phone
                                            </th>
                                            {section.value === 'office' && (
                                                <th className="px-4 py-2 font-medium">
                                                    Location
                                                </th>
                                            )}
                                            <th className="w-28 px-4 py-2">
                                                <span className="sr-only">
                                                    Actions
                                                </span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={4}
                                                    className="px-4 py-4 text-center text-muted-foreground"
                                                >
                                                    Nothing here yet.
                                                </td>
                                            </tr>
                                        )}
                                        {rows.map((entry) => (
                                            <tr
                                                key={entry.id}
                                                className="border-b border-sidebar-border/70 last:border-0 dark:border-sidebar-border"
                                            >
                                                <td className="px-4 py-2 font-medium">
                                                    {entry.name}
                                                </td>
                                                <td className="px-4 py-2 tabular-nums">
                                                    {entry.phone ?? (
                                                        <span className="text-muted-foreground">
                                                            —
                                                        </span>
                                                    )}
                                                </td>
                                                {section.value === 'office' && (
                                                    <td className="px-4 py-2">
                                                        {entry.campus_location
                                                            ?.name ?? (
                                                            <span className="text-muted-foreground">
                                                                Not on the map
                                                            </span>
                                                        )}
                                                        {entry.room && (
                                                            <span className="block text-xs text-muted-foreground">
                                                                {entry.room}
                                                            </span>
                                                        )}
                                                    </td>
                                                )}
                                                <td className="px-4 py-2">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() =>
                                                                setEditing(
                                                                    entry,
                                                                )
                                                            }
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
                                                                setDeleting(
                                                                    entry,
                                                                )
                                                            }
                                                        >
                                                            <Trash2 />
                                                            <span className="sr-only">
                                                                Remove
                                                            </span>
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    );
                })}
            </div>

            <Dialog
                open={creating !== null}
                onOpenChange={(open) => !open && setCreating(null)}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add to the directory</DialogTitle>
                    </DialogHeader>
                    {creating && (
                        <Form
                            {...DirectoryEntryController.store.form()}
                            onSuccess={() => setCreating(null)}
                            className="space-y-4"
                        >
                            {({ processing, errors }) => (
                                <>
                                    <EntryFields
                                        category={creating}
                                        locations={locations}
                                        floorPlans={floorPlans}
                                        errors={errors}
                                    />
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button variant="secondary">
                                                Cancel
                                            </Button>
                                        </DialogClose>
                                        <Button
                                            type="submit"
                                            disabled={processing}
                                        >
                                            Add
                                        </Button>
                                    </DialogFooter>
                                </>
                            )}
                        </Form>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={editing !== null}
                onOpenChange={(open) => !open && setEditing(null)}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit directory entry</DialogTitle>
                    </DialogHeader>
                    {editing && (
                        <Form
                            {...DirectoryEntryController.update.form(
                                editing.id,
                            )}
                            onSuccess={() => setEditing(null)}
                            className="space-y-4"
                        >
                            {({ processing, errors }) => (
                                <>
                                    <EntryFields
                                        entry={editing}
                                        category={editing.category}
                                        locations={locations}
                                        floorPlans={floorPlans}
                                        errors={errors}
                                    />
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button variant="secondary">
                                                Cancel
                                            </Button>
                                        </DialogClose>
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
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove from the directory?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        &quot;{deleting?.name}&quot; will no longer show on the
                        kiosk.
                    </p>
                    {deleting && (
                        <Form
                            {...DirectoryEntryController.destroy.form(
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
                                        Remove
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

DirectoryIndex.layout = {
    breadcrumbs: [{ title: 'School Directory', href: directoryIndex() }],
};
