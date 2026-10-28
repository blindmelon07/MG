import type { FormDataConvertible } from '@inertiajs/core';
import { Form, Head } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import SectionController from '@/actions/App/Http/Controllers/Admin/SectionController';
import { EducationLevelFields } from '@/components/education-level-fields';
import type { EducationLevelOption } from '@/components/education-level-fields';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { COURSE_LEVELS } from '@/components/student-placement-fields';
import type { CourseOption } from '@/components/student-placement-fields';
import { Badge } from '@/components/ui/badge';
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
import { index as sectionsIndex } from '@/routes/admin/sections';

type Section = {
    id: number;
    education_level: string;
    grade_level: string;
    course_id: number | null;
    name: string;
    course: { id: number; code: string } | null;
};

const NO_COURSE = '__none__';

function SectionFields({
    section,
    defaults,
    educationLevels,
    courses,
    errors,
}: {
    section?: Section;
    defaults?: { education_level: string; grade_level: string };
    educationLevels: EducationLevelOption[];
    courses: CourseOption[];
    errors: Partial<Record<string, string>>;
}) {
    const [level, setLevel] = useState(
        section?.education_level ?? defaults?.education_level ?? '',
    );
    const levelCourses = courses.filter(
        (course) => course.education_level === level,
    );

    return (
        <>
            <EducationLevelFields
                levels={educationLevels}
                defaultEducationLevel={
                    section?.education_level ?? defaults?.education_level
                }
                defaultGradeLevel={
                    section?.grade_level ?? defaults?.grade_level
                }
                errors={errors}
                onChange={(educationLevel) => setLevel(educationLevel)}
            />

            <div className="grid gap-2">
                <Label htmlFor="name">Section name</Label>
                <Input
                    id="name"
                    name="name"
                    required
                    defaultValue={section?.name}
                    placeholder="e.g. St. Thomas or BSIT 1-A"
                />
                <InputError message={errors.name} />
            </div>

            {COURSE_LEVELS.includes(level) && levelCourses.length > 0 && (
                <div className="grid gap-2">
                    <Label htmlFor="course_id">Course (optional)</Label>
                    <Select
                        key={level}
                        name="course_id"
                        defaultValue={
                            section?.course_id
                                ? String(section.course_id)
                                : NO_COURSE
                        }
                    >
                        <SelectTrigger id="course_id" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NO_COURSE}>
                                Any course
                            </SelectItem>
                            {levelCourses.map((course) => (
                                <SelectItem
                                    key={course.id}
                                    value={String(course.id)}
                                >
                                    {course.code} — {course.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        When set, only students in this course can be put in the
                        section.
                    </p>
                    <InputError message={errors.course_id} />
                </div>
            )}
        </>
    );
}

export default function SectionsIndex({
    sections,
    educationLevels,
    courses,
}: {
    sections: Section[];
    educationLevels: EducationLevelOption[];
    courses: CourseOption[];
}) {
    const [creating, setCreating] = useState<{
        education_level: string;
        grade_level: string;
    } | null>(null);
    const [editing, setEditing] = useState<Section | null>(null);
    const [deleting, setDeleting] = useState<Section | null>(null);

    // "Any course" is sent as an empty course.
    const withoutPlaceholder = (data: Record<string, FormDataConvertible>) => ({
        ...data,
        course_id: data.course_id === NO_COURSE ? null : data.course_id,
    });

    return (
        <>
            <Head title="Sections" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <Heading
                        title="Sections"
                        description="The sections offered for each year level, from Junior High School to Graduate School. Students and teaching assignments pick from this list."
                    />
                    <Button
                        onClick={() =>
                            setCreating({
                                education_level: '',
                                grade_level: '',
                            })
                        }
                    >
                        <Plus /> Add Section
                    </Button>
                </div>

                {educationLevels.map((level) => (
                    <section key={level.value} className="space-y-3">
                        <h2 className="text-base font-semibold">
                            {level.label}
                        </h2>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {level.grade_levels.map((grade) => {
                                const rows = sections.filter(
                                    (section) =>
                                        section.education_level ===
                                            level.value &&
                                        section.grade_level === grade,
                                );

                                return (
                                    <div
                                        key={grade}
                                        className="rounded-xl border border-sidebar-border/70 p-3 dark:border-sidebar-border"
                                    >
                                        <div className="mb-2 flex items-center justify-between">
                                            <h3 className="text-sm font-medium">
                                                {grade}{' '}
                                                <span className="font-normal text-muted-foreground">
                                                    ({rows.length})
                                                </span>
                                            </h3>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    setCreating({
                                                        education_level:
                                                            level.value,
                                                        grade_level: grade,
                                                    })
                                                }
                                            >
                                                <Plus /> Add
                                            </Button>
                                        </div>
                                        {rows.length === 0 ? (
                                            <p className="py-2 text-sm text-muted-foreground">
                                                No sections yet.
                                            </p>
                                        ) : (
                                            <ul className="divide-y divide-sidebar-border/70 dark:divide-sidebar-border">
                                                {rows.map((section) => (
                                                    <li
                                                        key={section.id}
                                                        className="flex items-center justify-between gap-2 py-1"
                                                    >
                                                        <span className="text-sm">
                                                            {section.name}
                                                            {section.course && (
                                                                <Badge
                                                                    variant="secondary"
                                                                    className="ml-2"
                                                                >
                                                                    {
                                                                        section
                                                                            .course
                                                                            .code
                                                                    }
                                                                </Badge>
                                                            )}
                                                        </span>
                                                        <span className="flex">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() =>
                                                                    setEditing(
                                                                        section,
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
                                                                        section,
                                                                    )
                                                                }
                                                            >
                                                                <Trash2 />
                                                                <span className="sr-only">
                                                                    Remove
                                                                </span>
                                                            </Button>
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>

            <Dialog
                open={creating !== null}
                onOpenChange={(open) => !open && setCreating(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add section</DialogTitle>
                    </DialogHeader>
                    {creating && (
                        <Form
                            {...SectionController.store.form()}
                            transform={withoutPlaceholder}
                            onSuccess={() => setCreating(null)}
                            className="space-y-4"
                        >
                            {({ processing, errors }) => (
                                <>
                                    <SectionFields
                                        defaults={creating}
                                        educationLevels={educationLevels}
                                        courses={courses}
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit section</DialogTitle>
                    </DialogHeader>
                    {editing && (
                        <Form
                            {...SectionController.update.form(editing.id)}
                            transform={withoutPlaceholder}
                            onSuccess={() => setEditing(null)}
                            className="space-y-4"
                        >
                            {({ processing, errors }) => (
                                <>
                                    <SectionFields
                                        section={editing}
                                        educationLevels={educationLevels}
                                        courses={courses}
                                        errors={errors}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Renaming a section also renames it for
                                        the students and teaching assignments
                                        already in it.
                                    </p>
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
                        <DialogTitle>Remove section?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        &quot;{deleting?.name}&quot; ({deleting?.grade_level})
                        will no longer be offered. Students already in it keep
                        it on their records.
                    </p>
                    {deleting && (
                        <Form
                            {...SectionController.destroy.form(deleting.id)}
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

SectionsIndex.layout = {
    breadcrumbs: [{ title: 'Sections', href: sectionsIndex() }],
};
