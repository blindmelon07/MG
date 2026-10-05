import { Form, Head } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import SubjectController from '@/actions/App/Http/Controllers/Admin/SubjectController';
import type { EducationLevelOption } from '@/components/education-level-fields';
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
import { index as subjectsIndex } from '@/routes/admin/subjects';

type Subject = {
    id: number;
    code: string | null;
    name: string;
    education_level: string;
    units: string | null;
};

function SubjectFields({
    subject,
    educationLevels,
    errors,
}: {
    subject?: Subject;
    educationLevels: EducationLevelOption[];
    errors: Partial<Record<string, string>>;
}) {
    return (
        <>
            <div className="grid gap-2">
                <Label htmlFor="name">Subject name</Label>
                <Input
                    id="name"
                    name="name"
                    required
                    defaultValue={subject?.name}
                    placeholder="e.g. Mathematics"
                />
                <InputError message={errors.name} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="education_level">Education level</Label>
                <Select
                    name="education_level"
                    defaultValue={subject?.education_level}
                    required
                >
                    <SelectTrigger id="education_level" className="w-full">
                        <SelectValue placeholder="Choose a level" />
                    </SelectTrigger>
                    <SelectContent>
                        {educationLevels.map((level) => (
                            <SelectItem key={level.value} value={level.value}>
                                {level.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <InputError message={errors.education_level} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="code">Code (optional)</Label>
                    <Input
                        id="code"
                        name="code"
                        defaultValue={subject?.code ?? ''}
                        placeholder="e.g. MATH101"
                    />
                    <InputError message={errors.code} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="units">Units (optional)</Label>
                    <Input
                        id="units"
                        name="units"
                        type="number"
                        min="0"
                        step="0.5"
                        defaultValue={subject?.units ?? ''}
                        placeholder="College only"
                    />
                    <InputError message={errors.units} />
                </div>
            </div>
        </>
    );
}

export default function SubjectsIndex({
    subjects,
    educationLevels,
}: {
    subjects: Subject[];
    educationLevels: EducationLevelOption[];
}) {
    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<Subject | null>(null);
    const [deleting, setDeleting] = useState<Subject | null>(null);

    return (
        <>
            <Head title="Subjects" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <Heading
                        title="Subjects"
                        description="The subjects offered at each education level. Teaching assignments pick from this list."
                    />
                    <Button onClick={() => setCreateOpen(true)}>
                        <Plus /> Add Subject
                    </Button>
                </div>

                {educationLevels.map((level) => {
                    const rows = subjects.filter(
                        (subject) => subject.education_level === level.value,
                    );

                    return (
                        <section key={level.value} className="space-y-2">
                            <h2 className="text-sm font-semibold">
                                {level.label}{' '}
                                <span className="font-normal text-muted-foreground">
                                    ({rows.length})
                                </span>
                            </h2>
                            <div className="overflow-x-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-sidebar-border/70 bg-muted/50 text-left dark:border-sidebar-border">
                                        <tr>
                                            <th className="w-32 px-4 py-2 font-medium">
                                                Code
                                            </th>
                                            <th className="px-4 py-2 font-medium">
                                                Subject
                                            </th>
                                            <th className="w-24 px-4 py-2 font-medium">
                                                Units
                                            </th>
                                            <th className="w-28 px-4 py-2 font-medium">
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
                                                    No subjects yet.
                                                </td>
                                            </tr>
                                        )}
                                        {rows.map((subject) => (
                                            <tr
                                                key={subject.id}
                                                className="border-b border-sidebar-border/70 last:border-0 dark:border-sidebar-border"
                                            >
                                                <td className="px-4 py-2 font-mono text-xs">
                                                    {subject.code ?? '—'}
                                                </td>
                                                <td className="px-4 py-2 font-medium">
                                                    {subject.name}
                                                </td>
                                                <td className="px-4 py-2">
                                                    {subject.units
                                                        ? Number(subject.units)
                                                        : '—'}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() =>
                                                                setEditing(
                                                                    subject,
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
                                                                    subject,
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

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add subject</DialogTitle>
                    </DialogHeader>
                    <Form
                        {...SubjectController.store.form()}
                        resetOnSuccess
                        onSuccess={() => setCreateOpen(false)}
                        className="space-y-4"
                    >
                        {({ processing, errors }) => (
                            <>
                                <SubjectFields
                                    educationLevels={educationLevels}
                                    errors={errors}
                                />
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="secondary">
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={processing}>
                                        Add
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={editing !== null}
                onOpenChange={(open) => !open && setEditing(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit subject</DialogTitle>
                    </DialogHeader>
                    {editing && (
                        <Form
                            {...SubjectController.update.form(editing.id)}
                            onSuccess={() => setEditing(null)}
                            className="space-y-4"
                        >
                            {({ processing, errors }) => (
                                <>
                                    <SubjectFields
                                        subject={editing}
                                        educationLevels={educationLevels}
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
                        <DialogTitle>Remove subject?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        &quot;{deleting?.name}&quot; will be removed from the
                        list. Grades and teaching assignments that already use
                        it are kept.
                    </p>
                    {deleting && (
                        <Form
                            {...SubjectController.destroy.form(deleting.id)}
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

SubjectsIndex.layout = {
    breadcrumbs: [{ title: 'Subjects', href: subjectsIndex() }],
};
