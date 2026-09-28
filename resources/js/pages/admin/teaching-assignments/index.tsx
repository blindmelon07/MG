import { Form, Head } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import TeachingAssignmentController from '@/actions/App/Http/Controllers/Admin/TeachingAssignmentController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { index as teachingAssignmentsIndex } from '@/routes/admin/teaching-assignments';

type Assignment = {
    id: number;
    subject: string;
    section: string;
    school_year: string;
    teacher: { id: number; name: string };
};

type Teacher = { id: number; name: string };

function currentSchoolYear(): string {
    // Philippine school years start around June.
    const now = new Date();
    const start =
        now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;

    return `${start}-${start + 1}`;
}

export default function TeachingAssignmentsIndex({
    assignments,
    teachers,
    sections,
}: {
    assignments: Assignment[];
    teachers: Teacher[];
    sections: string[];
}) {
    const [createOpen, setCreateOpen] = useState(false);
    const [deleting, setDeleting] = useState<Assignment | null>(null);

    return (
        <>
            <Head title="Teaching Assignments" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <Heading
                        title="Teaching Assignments"
                        description="Teachers can only import grades for the subjects and sections assigned here."
                    />

                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button disabled={teachers.length === 0}>
                                <Plus /> Assign Teacher
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Assign a teacher</DialogTitle>
                            </DialogHeader>
                            <Form
                                {...TeachingAssignmentController.store.form()}
                                resetOnSuccess
                                onSuccess={() => setCreateOpen(false)}
                                className="space-y-4"
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <div className="grid gap-2">
                                            <Label htmlFor="user_id">
                                                Teacher
                                            </Label>
                                            <Select name="user_id" required>
                                                <SelectTrigger
                                                    id="user_id"
                                                    className="w-full"
                                                >
                                                    <SelectValue placeholder="Choose a teacher" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {teachers.map((teacher) => (
                                                        <SelectItem
                                                            key={teacher.id}
                                                            value={String(
                                                                teacher.id,
                                                            )}
                                                        >
                                                            {teacher.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <InputError
                                                message={errors.user_id}
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="subject">
                                                Subject
                                            </Label>
                                            <Input
                                                id="subject"
                                                name="subject"
                                                required
                                                placeholder="e.g. Mathematics"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Must match the subject name used
                                                in the grades CSV.
                                            </p>
                                            <InputError
                                                message={errors.subject}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="grid gap-2">
                                                <Label htmlFor="section">
                                                    Section
                                                </Label>
                                                <Input
                                                    id="section"
                                                    name="section"
                                                    required
                                                    list="known-sections"
                                                    placeholder="e.g. St. Thomas"
                                                />
                                                <datalist id="known-sections">
                                                    {sections.map((section) => (
                                                        <option
                                                            key={section}
                                                            value={section}
                                                        />
                                                    ))}
                                                </datalist>
                                                <InputError
                                                    message={errors.section}
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="school_year">
                                                    School year
                                                </Label>
                                                <Input
                                                    id="school_year"
                                                    name="school_year"
                                                    required
                                                    defaultValue={currentSchoolYear()}
                                                    placeholder="2026-2027"
                                                />
                                                <InputError
                                                    message={errors.school_year}
                                                />
                                            </div>
                                        </div>

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
                                                Assign
                                            </Button>
                                        </DialogFooter>
                                    </>
                                )}
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>

                {teachers.length === 0 && (
                    <Alert>
                        <AlertDescription>
                            No teacher accounts yet. A super admin can create
                            one under Users with the Teacher role.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="overflow-x-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <table className="w-full text-sm">
                        <thead className="border-b border-sidebar-border/70 bg-muted/50 text-left dark:border-sidebar-border">
                            <tr>
                                <th className="px-4 py-2 font-medium">
                                    Teacher
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    Subject
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    Section
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    School year
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {assignments.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-4 py-6 text-center text-muted-foreground"
                                    >
                                        No teaching assignments yet.
                                    </td>
                                </tr>
                            )}
                            {assignments.map((assignment) => (
                                <tr
                                    key={assignment.id}
                                    className="border-b border-sidebar-border/70 last:border-0 dark:border-sidebar-border"
                                >
                                    <td className="px-4 py-2 font-medium">
                                        {assignment.teacher.name}
                                    </td>
                                    <td className="px-4 py-2">
                                        {assignment.subject}
                                    </td>
                                    <td className="px-4 py-2">
                                        {assignment.section}
                                    </td>
                                    <td className="px-4 py-2">
                                        {assignment.school_year}
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex justify-end">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    setDeleting(assignment)
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
            </div>

            <Dialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove assignment?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        {deleting?.teacher.name} will no longer be able to
                        import or see grades for {deleting?.subject} in{' '}
                        {deleting?.section}. Grades already imported are kept.
                    </p>
                    {deleting && (
                        <Form
                            {...TeachingAssignmentController.destroy.form(
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

TeachingAssignmentsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Teaching Assignments',
            href: teachingAssignmentsIndex(),
        },
    ],
};
