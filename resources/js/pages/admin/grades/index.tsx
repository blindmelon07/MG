import { Form, Head, Link, router } from '@inertiajs/react';
import { Download, History, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import GradeController from '@/actions/App/Http/Controllers/Admin/GradeController';
import GradeImportController from '@/actions/App/Http/Controllers/Admin/GradeImportController';
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
import { formatGrade, gradingSystemLabels, isFailing } from '@/lib/grades';
import {
    history as gradesHistory,
    index as gradesIndex,
} from '@/routes/admin/grades';
import { template as importTemplate } from '@/routes/admin/grades/import';
import type { GradingSystem } from '@/types/auth';
import type { Paginated } from '@/types/pagination';

type GradeRow = {
    id: number;
    grading_system: GradingSystem;
    school_year: string;
    term: string | null;
    subject_code: string | null;
    subject: string;
    units: string | null;
    q1: string | null;
    q2: string | null;
    q3: string | null;
    q4: string | null;
    midterm: string | null;
    final_grade: string | null;
    remarks: string | null;
    student: {
        id: number;
        name: string;
        student_number: string | null;
        grade_level: string | null;
        section: string | null;
    };
};

type Assignment = {
    id: number;
    subject: string;
    section: string;
    school_year: string;
};

type Filters = {
    search: string;
    school_year: string;
    section: string;
    subject: string;
};

const ALL = '__all__';

function breakdown(grade: GradeRow): string {
    if (grade.grading_system === 'college') {
        return `Midterm ${formatGrade(grade.midterm, 'college')}`;
    }

    return [grade.q1, grade.q2, grade.q3, grade.q4]
        .map((q) => formatGrade(q, 'k12'))
        .join(' · ');
}

export default function GradesIndex({
    grades,
    filters,
    options,
    canManageAll,
    assignments,
}: {
    grades: Paginated<GradeRow>;
    filters: Filters;
    options: { schoolYears: string[]; subjects: string[] };
    canManageAll: boolean;
    assignments: Assignment[];
}) {
    const [importing, setImporting] = useState(false);
    const [system, setSystem] = useState<GradingSystem>('k12');
    const [deleting, setDeleting] = useState<GradeRow | null>(null);
    const [searchTerm, setSearchTerm] = useState(filters.search);

    const applyFilters = (changes: Partial<Filters>) => {
        const next = { ...filters, search: searchTerm, ...changes };

        router.get(
            gradesIndex().url,
            Object.fromEntries(
                Object.entries(next).filter(([, value]) => value !== ''),
            ),
            { preserveState: true, replace: true },
        );
    };

    const noAssignments = !canManageAll && assignments.length === 0;

    return (
        <>
            <Head title="Grades" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <Heading
                        title="Grades"
                        description={
                            canManageAll
                                ? 'Import and review grades for all students.'
                                : 'Import and review grades for the classes assigned to you.'
                        }
                    />

                    <div className="flex items-center gap-2">
                        {canManageAll && (
                            <Button variant="outline" asChild>
                                <Link href={gradesHistory()}>
                                    <History /> Change history
                                </Link>
                            </Button>
                        )}
                        <Button
                            onClick={() => setImporting(true)}
                            disabled={noAssignments}
                        >
                            <Upload /> Import grades
                        </Button>
                    </div>
                </div>

                {noAssignments && (
                    <Alert>
                        <AlertDescription>
                            You don&apos;t have any teaching assignments yet.
                            Ask the Registrar&apos;s Office to assign your
                            subjects and sections before importing grades.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="flex flex-wrap items-end gap-3">
                    <form
                        className="w-full max-w-xs"
                        onSubmit={(e) => {
                            e.preventDefault();
                            applyFilters({});
                        }}
                    >
                        <Input
                            placeholder="Search by name or student #"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </form>

                    <Select
                        value={filters.school_year || ALL}
                        onValueChange={(value) =>
                            applyFilters({
                                school_year: value === ALL ? '' : value,
                            })
                        }
                    >
                        <SelectTrigger
                            className="w-44"
                            aria-label="School year"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>
                                All school years
                            </SelectItem>
                            {options.schoolYears.map((year) => (
                                <SelectItem key={year} value={year}>
                                    S.Y. {year}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={filters.subject || ALL}
                        onValueChange={(value) =>
                            applyFilters({
                                subject: value === ALL ? '' : value,
                            })
                        }
                    >
                        <SelectTrigger className="w-52" aria-label="Subject">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>All subjects</SelectItem>
                            {options.subjects.map((subject) => (
                                <SelectItem key={subject} value={subject}>
                                    {subject}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {Object.values(filters).some(Boolean) && (
                        <Button variant="ghost" asChild>
                            <Link href={gradesIndex()}>Clear filters</Link>
                        </Button>
                    )}
                </div>

                <div className="overflow-x-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <table className="w-full text-sm">
                        <thead className="border-b border-sidebar-border/70 bg-muted/50 text-left dark:border-sidebar-border">
                            <tr>
                                <th className="px-4 py-2 font-medium">
                                    Student
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    Section
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    Period
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    Subject
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    Breakdown
                                </th>
                                <th className="px-4 py-2 text-right font-medium">
                                    Final
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    Remarks
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="tabular-nums">
                            {grades.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="px-4 py-6 text-center text-muted-foreground"
                                    >
                                        No grades yet. Use &ldquo;Import
                                        grades&rdquo; to upload a CSV.
                                    </td>
                                </tr>
                            )}
                            {grades.data.map((grade) => (
                                <tr
                                    key={grade.id}
                                    className="border-b border-sidebar-border/70 last:border-0 dark:border-sidebar-border"
                                >
                                    <td className="px-4 py-2">
                                        <div className="font-medium">
                                            {grade.student.name}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {grade.student.student_number ??
                                                '—'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2">
                                        {grade.student.section ?? '—'}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap">
                                        {grade.school_year}
                                        {grade.term && (
                                            <div className="text-xs text-muted-foreground">
                                                {grade.term}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-2">
                                        {grade.subject_code && (
                                            <span className="mr-1 text-muted-foreground">
                                                {grade.subject_code}
                                            </span>
                                        )}
                                        {grade.subject}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                                        {breakdown(grade)}
                                    </td>
                                    <td className="px-4 py-2 text-right font-semibold">
                                        {formatGrade(
                                            grade.final_grade,
                                            grade.grading_system,
                                        )}
                                    </td>
                                    <td className="px-4 py-2">
                                        {grade.remarks ? (
                                            <Badge
                                                variant={
                                                    isFailing(grade.remarks)
                                                        ? 'destructive'
                                                        : 'secondary'
                                                }
                                            >
                                                {grade.remarks}
                                            </Badge>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex justify-end">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    setDeleting(grade)
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

                {grades.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {grades.links.map((link, i) => (
                            <Button
                                key={i}
                                variant={link.active ? 'default' : 'outline'}
                                size="sm"
                                disabled={!link.url}
                                asChild={!!link.url}
                            >
                                {link.url ? (
                                    <Link
                                        href={link.url}
                                        dangerouslySetInnerHTML={{
                                            __html: link.label,
                                        }}
                                    />
                                ) : (
                                    <span
                                        dangerouslySetInnerHTML={{
                                            __html: link.label,
                                        }}
                                    />
                                )}
                            </Button>
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
                        <DialogTitle>Delete grade?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        This removes {deleting?.student.name}&apos;s grade in{' '}
                        {deleting?.subject} ({deleting?.school_year}
                        {deleting?.term ? `, ${deleting.term}` : ''}). The
                        student will no longer see it.
                    </p>
                    {deleting && (
                        <Form
                            {...GradeController.destroy.form(deleting.id)}
                            options={{ preserveScroll: true }}
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

            <Dialog open={importing} onOpenChange={setImporting}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Import grades</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Upload a CSV with one row per student per subject.
                        Students are matched by student #. Re-importing the same
                        subject and period updates the existing grade.
                    </p>
                    <Form
                        {...GradeImportController.store.form()}
                        onSuccess={() => setImporting(false)}
                        className="space-y-4"
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="grading_system">
                                        Grading system
                                    </Label>
                                    <Select
                                        name="grading_system"
                                        value={system}
                                        onValueChange={(value) =>
                                            setSystem(value as GradingSystem)
                                        }
                                    >
                                        <SelectTrigger
                                            id="grading_system"
                                            className="w-full"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="k12">
                                                {gradingSystemLabels.k12}
                                            </SelectItem>
                                            <SelectItem value="college">
                                                {gradingSystemLabels.college}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        {system === 'college'
                                            ? 'Columns: term, subject code, units, midterm and final (1.00–5.00). Put INC or DRP in final_grade when needed.'
                                            : 'Columns: Q1–Q4 (0–100). Leave final_grade blank to average the four quarters.'}
                                    </p>
                                    <InputError
                                        message={errors.grading_system}
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <a
                                        href={importTemplate(system).url}
                                        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                                    >
                                        <Download className="size-4" /> Blank{' '}
                                        {system === 'college'
                                            ? 'college'
                                            : 'K-12'}{' '}
                                        template
                                    </a>
                                    {assignments.length > 0 && (
                                        <div className="grid gap-1">
                                            <span className="text-xs text-muted-foreground">
                                                Or download a template with your
                                                class list filled in:
                                            </span>
                                            {assignments.map((assignment) => (
                                                <a
                                                    key={assignment.id}
                                                    href={
                                                        importTemplate(system, {
                                                            query: {
                                                                assignment:
                                                                    assignment.id,
                                                            },
                                                        }).url
                                                    }
                                                    className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                                                >
                                                    <Download className="size-4" />
                                                    {assignment.subject} —{' '}
                                                    {assignment.section} (
                                                    {assignment.school_year})
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="grades-file">
                                        CSV file
                                    </Label>
                                    <Input
                                        id="grades-file"
                                        name="file"
                                        type="file"
                                        accept=".csv,text/csv"
                                        required
                                    />
                                    <InputError message={errors.file} />
                                </div>

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="secondary">
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={processing}>
                                        <Upload /> Import
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </Form>
                </DialogContent>
            </Dialog>
        </>
    );
}

GradesIndex.layout = {
    breadcrumbs: [
        {
            title: 'Grades',
            href: gradesIndex(),
        },
    ],
};
