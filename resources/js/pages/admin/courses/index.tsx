import { Form, Head } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import CourseController from '@/actions/App/Http/Controllers/Admin/CourseController';
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
import { formatUnits } from '@/lib/grades';
import { index as coursesIndex } from '@/routes/admin/courses';

type Course = {
    id: number;
    code: string;
    name: string;
    education_level: string;
    units: string | null;
    students_count: number;
};

function CourseFields({
    course,
    educationLevels,
    errors,
}: {
    course?: Course;
    educationLevels: EducationLevelOption[];
    errors: Partial<Record<string, string>>;
}) {
    return (
        <>
            <div className="grid grid-cols-[8rem_1fr] gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="code">Code</Label>
                    <Input
                        id="code"
                        name="code"
                        required
                        defaultValue={course?.code}
                        placeholder="BSIT"
                    />
                    <InputError message={errors.code} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="name">Course name</Label>
                    <Input
                        id="name"
                        name="name"
                        required
                        defaultValue={course?.name}
                        placeholder="BS Information Technology"
                    />
                    <InputError message={errors.name} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="education_level">Education level</Label>
                    <Select
                        name="education_level"
                        defaultValue={course?.education_level}
                        required
                    >
                        <SelectTrigger id="education_level" className="w-full">
                            <SelectValue placeholder="Choose a level" />
                        </SelectTrigger>
                        <SelectContent>
                            {educationLevels.map((level) => (
                                <SelectItem
                                    key={level.value}
                                    value={level.value}
                                >
                                    {level.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <InputError message={errors.education_level} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="units">Total units</Label>
                    <Input
                        id="units"
                        name="units"
                        type="number"
                        min="0"
                        step="0.5"
                        defaultValue={course?.units ?? ''}
                        placeholder="e.g. 162"
                    />
                    <InputError message={errors.units} />
                </div>
            </div>
        </>
    );
}

export default function CoursesIndex({
    courses,
    educationLevels,
}: {
    courses: Course[];
    educationLevels: EducationLevelOption[];
}) {
    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<Course | null>(null);
    const [deleting, setDeleting] = useState<Course | null>(null);

    return (
        <>
            <Head title="Courses" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <Heading
                        title="Courses"
                        description="Degree programs offered in college and graduate school. College and graduate students are enrolled in one of these."
                    />
                    <Button onClick={() => setCreateOpen(true)}>
                        <Plus /> Add Course
                    </Button>
                </div>

                {educationLevels.map((level) => {
                    const rows = courses.filter(
                        (course) => course.education_level === level.value,
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
                                                Course
                                            </th>
                                            <th className="w-24 px-4 py-2 text-right font-medium">
                                                Units
                                            </th>
                                            <th className="w-28 px-4 py-2 text-right font-medium">
                                                Students
                                            </th>
                                            <th className="w-28 px-4 py-2 font-medium">
                                                <span className="sr-only">
                                                    Actions
                                                </span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="tabular-nums">
                                        {rows.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={5}
                                                    className="px-4 py-4 text-center text-muted-foreground"
                                                >
                                                    No courses yet.
                                                </td>
                                            </tr>
                                        )}
                                        {rows.map((course) => (
                                            <tr
                                                key={course.id}
                                                className="border-b border-sidebar-border/70 last:border-0 dark:border-sidebar-border"
                                            >
                                                <td className="px-4 py-2 font-mono text-xs">
                                                    {course.code}
                                                </td>
                                                <td className="px-4 py-2 font-medium">
                                                    {course.name}
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    {formatUnits(course.units)}
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    {course.students_count}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() =>
                                                                setEditing(
                                                                    course,
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
                                                            disabled={
                                                                course.students_count >
                                                                0
                                                            }
                                                            onClick={() =>
                                                                setDeleting(
                                                                    course,
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
                        <DialogTitle>Add course</DialogTitle>
                    </DialogHeader>
                    <Form
                        {...CourseController.store.form()}
                        resetOnSuccess
                        onSuccess={() => setCreateOpen(false)}
                        className="space-y-4"
                    >
                        {({ processing, errors }) => (
                            <>
                                <CourseFields
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
                        <DialogTitle>Edit course</DialogTitle>
                    </DialogHeader>
                    {editing && (
                        <Form
                            {...CourseController.update.form(editing.id)}
                            onSuccess={() => setEditing(null)}
                            className="space-y-4"
                        >
                            {({ processing, errors }) => (
                                <>
                                    <CourseFields
                                        course={editing}
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
                        <DialogTitle>Remove course?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        &quot;{deleting?.code} — {deleting?.name}&quot; will be
                        removed from the list.
                    </p>
                    {deleting && (
                        <Form
                            {...CourseController.destroy.form(deleting.id)}
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

CoursesIndex.layout = {
    breadcrumbs: [{ title: 'Courses', href: coursesIndex() }],
};
