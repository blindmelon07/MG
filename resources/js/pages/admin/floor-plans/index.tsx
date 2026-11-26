import { Form, Head, Link } from '@inertiajs/react';
import { DoorOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import FloorPlanController from '@/actions/App/Http/Controllers/Admin/FloorPlanController';
import Heading from '@/components/heading';
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
import {
    create,
    edit,
    index as floorPlansIndex,
} from '@/routes/admin/floor-plans';

type PlanRow = {
    id: number;
    building: string | null;
    floor: string;
    rooms: number;
    entrances: number;
    offices: number;
    image_url: string | null;
};

export default function FloorPlansIndex({
    plans,
    buildingsLeft,
}: {
    plans: PlanRow[];
    buildingsLeft: number;
}) {
    const [deleting, setDeleting] = useState<PlanRow | null>(null);

    return (
        <>
            <Head title="Floor Plans" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <Heading
                        title="Floor Plans"
                        description="Upload a picture of a building's floor sign and trace its rooms and hallways. Offices placed on a room get turn-by-turn directions to the door on the kiosk."
                    />
                    {buildingsLeft > 0 ? (
                        <Button asChild>
                            <Link href={create()}>
                                <Plus /> New floor plan
                            </Link>
                        </Button>
                    ) : (
                        <Button
                            disabled
                            title="Every building already has a floor plan"
                        >
                            <Plus /> New floor plan
                        </Button>
                    )}
                </div>

                {plans.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-sidebar-border/70 px-6 py-12 text-center dark:border-sidebar-border">
                        <DoorOpen className="size-8 text-muted-foreground" />
                        <div>
                            <p className="font-medium">No floor plans yet</p>
                            <p className="text-sm text-muted-foreground">
                                Start with the building visitors ask about most.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {plans.map((plan) => (
                            <article
                                key={plan.id}
                                className="flex flex-col overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border"
                            >
                                <Link
                                    href={edit(plan.id)}
                                    className="flex aspect-[16/9] items-center justify-center bg-muted"
                                >
                                    {plan.image_url ? (
                                        <img
                                            src={plan.image_url}
                                            alt=""
                                            className="h-full w-full object-contain"
                                        />
                                    ) : (
                                        <DoorOpen className="size-10 text-muted-foreground/60" />
                                    )}
                                </Link>
                                <div className="flex flex-1 items-start justify-between gap-2 p-4">
                                    <div className="min-w-0">
                                        <h2 className="truncate font-semibold">
                                            {plan.building ??
                                                'Unknown building'}
                                        </h2>
                                        <p className="text-sm text-muted-foreground">
                                            {plan.floor} · {plan.rooms}{' '}
                                            {plan.rooms === 1
                                                ? 'room'
                                                : 'rooms'}{' '}
                                            · {plan.entrances}{' '}
                                            {plan.entrances === 1
                                                ? 'entrance'
                                                : 'entrances'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {plan.offices === 0
                                                ? 'No offices placed yet'
                                                : `${plan.offices} ${plan.offices === 1 ? 'office' : 'offices'} placed`}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            asChild
                                        >
                                            <Link href={edit(plan.id)}>
                                                <Pencil />
                                                <span className="sr-only">
                                                    Edit
                                                </span>
                                            </Link>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setDeleting(plan)}
                                        >
                                            <Trash2 />
                                            <span className="sr-only">
                                                Remove
                                            </span>
                                        </Button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>

            <Dialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove this floor plan?</DialogTitle>
                        <DialogDescription>
                            The kiosk will route to {deleting?.building} itself
                            instead of to office doors inside it. Offices placed
                            on its rooms keep their building.
                        </DialogDescription>
                    </DialogHeader>
                    {deleting && (
                        <Form
                            {...FloorPlanController.destroy.form(deleting.id)}
                            onSuccess={() => setDeleting(null)}
                        >
                            {({ processing }) => (
                                <DialogFooter>
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

FloorPlansIndex.layout = {
    breadcrumbs: [{ title: 'Floor Plans', href: floorPlansIndex() }],
};
