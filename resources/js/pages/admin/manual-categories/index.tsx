import { Form, Head } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import ManualCategoryController from '@/actions/App/Http/Controllers/Admin/ManualCategoryController';
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
import { index as manualCategoriesIndex } from '@/routes/admin/manual-categories';

type ManualCategory = {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    sort_order: number;
    manuals_count: number;
};

export default function ManualCategoriesIndex({
    categories,
}: {
    categories: ManualCategory[];
}) {
    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<ManualCategory | null>(null);
    const [deleting, setDeleting] = useState<ManualCategory | null>(null);

    return (
        <>
            <Head title="Manual Categories" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <div className="flex items-center justify-between">
                    <Heading
                        title="Manual Categories"
                        description="Organize the digital school manual into browsable sections."
                    />

                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus /> New Category
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>New Category</DialogTitle>
                            </DialogHeader>
                            <Form
                                {...ManualCategoryController.store.form()}
                                resetOnSuccess
                                onSuccess={() => setCreateOpen(false)}
                                className="space-y-4"
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <div className="grid gap-2">
                                            <Label htmlFor="name">Name</Label>
                                            <Input
                                                id="name"
                                                name="name"
                                                required
                                                placeholder="e.g. Student Handbook"
                                            />
                                            <InputError message={errors.name} />
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

                                        <DialogFooter>
                                            <Button
                                                type="submit"
                                                disabled={processing}
                                            >
                                                Create
                                            </Button>
                                        </DialogFooter>
                                    </>
                                )}
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="overflow-x-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <table className="w-full text-sm">
                        <thead className="border-b border-sidebar-border/70 bg-muted/50 text-left dark:border-sidebar-border">
                            <tr>
                                <th className="px-4 py-2 font-medium">Name</th>
                                <th className="px-4 py-2 font-medium">
                                    Manuals
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
                            {categories.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="px-4 py-6 text-center text-muted-foreground"
                                    >
                                        No categories yet.
                                    </td>
                                </tr>
                            )}
                            {categories.map((category) => (
                                <tr
                                    key={category.id}
                                    className="border-b border-sidebar-border/70 last:border-0 dark:border-sidebar-border"
                                >
                                    <td className="px-4 py-2">
                                        <div className="font-medium">
                                            {category.name}
                                        </div>
                                        {category.description && (
                                            <div className="text-xs text-muted-foreground">
                                                {category.description}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-2">
                                        {category.manuals_count}
                                    </td>
                                    <td className="px-4 py-2">
                                        {category.sort_order}
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    setEditing(category)
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
                                                    setDeleting(category)
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
                onOpenChange={(open) => !open && setEditing(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Category</DialogTitle>
                    </DialogHeader>
                    {editing && (
                        <Form
                            {...ManualCategoryController.update.form(
                                editing.id,
                            )}
                            onSuccess={() => setEditing(null)}
                            className="space-y-4"
                        >
                            {({ processing, errors }) => (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="edit_name">Name</Label>
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
                                            defaultValue={editing.sort_order}
                                        />
                                        <InputError
                                            message={errors.sort_order}
                                        />
                                    </div>

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
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete category?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        {deleting?.manuals_count
                            ? `"${deleting.name}" still has ${deleting.manuals_count} manual(s). Move or delete them first.`
                            : `This will permanently delete "${deleting?.name}".`}
                    </p>
                    {deleting && (
                        <Form
                            {...ManualCategoryController.destroy.form(
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
                                        disabled={
                                            processing ||
                                            deleting.manuals_count > 0
                                        }
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

ManualCategoriesIndex.layout = {
    breadcrumbs: [
        {
            title: 'Manual Categories',
            href: manualCategoriesIndex(),
        },
    ],
};
