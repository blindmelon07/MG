import { Form, Head, Link } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import TeachingAssignmentController from '@/actions/App/Http/Controllers/Admin/TeachingAssignmentController';
import { EducationLevelFields } from '@/components/education-level-fields';
import type { EducationLevelOption } from '@/components/education-level-fields';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';
import { index as teachingAssignmentsIndex } from '@/routes/admin/teaching-assignments';

type Assignment = {
    id: number;
    education_level: string | null;
    grade_level: string | null;
    subject: string;
    section: string;
    school_year: string;
    teacher: { id: number; name: string };
};

type Teacher = { id: number; name: string };

type SubjectOption = {
    id: number;
    code: string | null;
    name: string;
    education_level: string;
};

type SectionOption = {
    education_level: string;
    grade_level: string | null;
    section: string;
};

function currentSchoolYear(): string {
    // Philippine school years start around June.
    const now = new Date();
    const start =
        now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;

    return `${start}-${start + 1}`;
}

export default function TeachingAssignmentsIndex({
    assignments,
    level,
    levelCounts,
    educationLevels,
    teachers,
    sections,
    subjects,
}: {
    assignments: Assignment[];
    level: string;
    levelCounts: Record<string, number>;
    educationLevels: EducationLevelOption[];
    teachers: Teacher[];
    sections: SectionOption[];
    subjects: SubjectOption[];
}) {
    const [createOpen, setCreateOpen] = useState(false);
    const [deleting, setDeleting] = useState<Assignment | null>(null);
    const [formLevel, setFormLevel] = useState(level);
    const [formGrade, setFormGrade] = useState('');

    const levelLabel = (value: string | null) =>
        educationLevels.find((option) => option.value === value)?.label ??
        'Unspecified';

    const levelSubjects = subjects.filter(
        (subject) => subject.education_level === formLevel,
    );
    const levelSections = [
        ...new Set(
            sections
                .filter(
                    (option) =>
                        option.education_level === formLevel &&
                        (formGrade === '' || option.grade_level === formGrade),
                )
                .map((option) => option.section),
        ),
    ];

    const tabs = [
        {
            value: '',
            label: 'All levels',
            count: Object.values(levelCounts).reduce(
                (sum, count) => sum + Number(count),
                0,
            ),
        },
        ...educationLevels.map((option) => ({
            value: option.value,
            label: option.label,
            count: Number(levelCounts[option.value] ?? 0),
        })),
    ];

    return (
        <>
            <Head title="Teaching Assignments" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <Heading
                        title="Teaching Assignments"
                        description="Teachers can only import grades for the subjects and sections assigned here."
                    />

                    <Dialog
                        open={createOpen}
                        onOpenChange={(open) => {
                            setCreateOpen(open);

                            if (open) {
                                setFormLevel(level);
                                setFormGrade('');
                            }
                        }}
                    >
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

                                        <EducationLevelFields
                                            levels={educationLevels}
                                            defaultEducationLevel={level}
                                            errors={errors}
                                            onChange={(
                                                educationLevel,
                                                gradeLevel,
                                            ) => {
                                                setFormLevel(educationLevel);
                                                setFormGrade(gradeLevel);
                                            }}
                                        />

                                        <div className="grid gap-2">
                                            <Label htmlFor="subject">
                                                Subject
                                            </Label>
                                            <Select
                                                key={formLevel}
                                                name="subject"
                                                required
                                                disabled={
                                                    levelSubjects.length === 0
                                                }
                                            >
                                                <SelectTrigger
                                                    id="subject"
                                                    className="w-full"
                                                >
                                                    <SelectValue
                                                        placeholder={
                                                            formLevel === ''
                                                                ? 'Choose a level first'
                                                                : levelSubjects.length ===
                                                                    0
                                                                  ? 'No subjects for this level yet'
                                                                  : 'Choose a subject'
                                                        }
                                                    />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {levelSubjects.map(
                                                        (subject) => (
                                                            <SelectItem
                                                                key={subject.id}
                                                                value={
                                                                    subject.name
                                                                }
                                                            >
                                                                {subject.code
                                                                    ? `${subject.code} — ${subject.name}`
                                                                    : subject.name}
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-xs text-muted-foreground">
                                                Subjects come from the Subjects
                                                page. Add one there if it&apos;s
                                                missing.
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
                                                    {levelSections.map(
                                                        (section) => (
                                                            <option
                                                                key={section}
                                                                value={section}
                                                            />
                                                        ),
                                                    )}
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

                <nav
                    aria-label="Filter by education level"
                    className="flex flex-wrap gap-2"
                >
                    {tabs.map((tab) => (
                        <Link
                            key={tab.value}
                            href={teachingAssignmentsIndex({
                                query: tab.value ? { level: tab.value } : {},
                            })}
                            preserveScroll
                            aria-current={
                                level === tab.value ? 'page' : undefined
                            }
                            className={cn(
                                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors',
                                level === tab.value
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'hover:bg-muted',
                            )}
                        >
                            {tab.label}
                            <span
                                className={cn(
                                    'text-xs tabular-nums',
                                    level === tab.value
                                        ? 'text-primary-foreground/80'
                                        : 'text-muted-foreground',
                                )}
                            >
                                {tab.count}
                            </span>
                        </Link>
                    ))}
                </nav>

                <div className="overflow-x-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <table className="w-full text-sm">
                        <thead className="border-b border-sidebar-border/70 bg-muted/50 text-left dark:border-sidebar-border">
                            <tr>
                                <th className="px-4 py-2 font-medium">
                                    Teacher
                                </th>
                                <th className="px-4 py-2 font-medium">Level</th>
                                <th className="px-4 py-2 font-medium">
                                    Year level
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
                                        colSpan={7}
                                        className="px-4 py-6 text-center text-muted-foreground"
                                    >
                                        {level
                                            ? `No ${levelLabel(level)} teaching assignments yet.`
                                            : 'No teaching assignments yet.'}
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
                                        <Badge variant="secondary">
                                            {levelLabel(
                                                assignment.education_level,
                                            )}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-2">
                                        {assignment.grade_level ?? '—'}
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
