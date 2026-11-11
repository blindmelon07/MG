import { Form, Head, Link, router, usePage } from '@inertiajs/react';
import {
    Check,
    Download,
    Eye,
    History,
    Trash2,
    Undo2,
    Upload,
} from 'lucide-react';
import { useState } from 'react';
import GradeController from '@/actions/App/Http/Controllers/Admin/GradeController';
import GradeImportController from '@/actions/App/Http/Controllers/Admin/GradeImportController';
import { GradeTemplatePicker } from '@/components/grade-template-picker';
import type { TemplateOptions } from '@/components/grade-template-picker';
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
import { Textarea } from '@/components/ui/textarea';
import { formatGrade, gradingSystemLabels, isFailing } from '@/lib/grades';
import {
    approve as approveGrades,
    returnMethod as returnGrades,
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
    prelim: string | null;
    midterm: string | null;
    finals: string | null;
    final_grade: string | null;
    remarks: string | null;
    /** Null while a teacher's college grade waits for the registrar. */
    approved_at: string | null;
    /** Set when the registrar sent the grade back to the teacher. */
    returned_at: string | null;
    return_reason: string | null;
    /** The student's section in that school year. */
    section: string | null;
    student: {
        id: number;
        name: string;
        student_number: string | null;
    };
};

type Assignment = {
    id: number;
    subject: string;
    section: string;
    school_year: string;
    grading_system: GradingSystem | null;
};

type AdvisoryOption = {
    id: number;
    grade_level: string;
    section: string;
    school_year: string;
    grading_system: GradingSystem;
};

/** One subject's pending grades, approved or returned together. */
type PendingSubject = {
    school_year: string;
    term: string | null;
    subject: string;
    subject_code: string | null;
    /** The teacher who uploaded them. */
    encoded_by: number | null;
    teacher: string | null;
    count: number;
    sections: string[];
};

function subjectPayload(subject: PendingSubject) {
    return {
        school_year: subject.school_year,
        term: subject.term,
        subject: subject.subject,
        encoded_by: subject.encoded_by,
    };
}

function subjectLabel(subject: PendingSubject) {
    return subject.subject_code
        ? `${subject.subject_code} ${subject.subject}`
        : subject.subject;
}

type Filters = {
    search: string;
    school_year: string;
    section: string;
    subject: string;
    status: '' | 'pending' | 'returned' | 'posted';
};

const ALL = '__all__';

function breakdown(grade: GradeRow): string {
    if (grade.grading_system === 'college') {
        return [grade.prelim, grade.midterm, grade.finals]
            .map(
                (period, index) =>
                    `${['P', 'M', 'F'][index]} ${formatGrade(period, 'college')}`,
            )
            .join(' · ');
    }

    // Three terms; a fourth value only on grades from the old quarterly system.
    return [grade.q1, grade.q2, grade.q3, ...(grade.q4 ? [grade.q4] : [])]
        .map((term) => formatGrade(term, 'k12'))
        .join(' · ');
}

export default function GradesIndex({
    grades,
    filters,
    options,
    canManageAll,
    assignments,
    advisories,
    templateOptions,
    pendingCount,
    returnedCount,
    canApprove,
    pendingSubjects,
}: {
    grades: Paginated<GradeRow>;
    filters: Filters;
    options: { schoolYears: string[]; subjects: string[] };
    canManageAll: boolean;
    assignments: Assignment[];
    advisories: AdvisoryOption[];
    templateOptions: TemplateOptions | null;
    pendingCount: number;
    returnedCount: number;
    canApprove: boolean;
    pendingSubjects: PendingSubject[];
}) {
    const { schoolYear } = usePage().props;
    const viewingYear = schoolYear?.selected ?? '';
    const [importing, setImporting] = useState(false);
    const [system, setSystem] = useState<GradingSystem>(
        advisories[0]?.grading_system ??
            assignments.find((assignment) => assignment.grading_system)
                ?.grading_system ??
            'k12',
    );
    // A class-list template only has rows for students on the matching grading system.
    const classTemplates = assignments.filter(
        (assignment) =>
            assignment.grading_system === null ||
            assignment.grading_system === system,
    );
    const advisoryTemplates = advisories.filter(
        (advisory) => advisory.grading_system === system,
    );
    const [deleting, setDeleting] = useState<GradeRow | null>(null);
    const [searchTerm, setSearchTerm] = useState(filters.search);
    const [approving, setApproving] = useState(false);
    // The subject being approved or returned, as a whole.
    const [confirmingApproval, setConfirmingApproval] =
        useState<PendingSubject | null>(null);
    const [returning, setReturning] = useState<PendingSubject | null>(null);
    const [returnReason, setReturnReason] = useState('');
    const [returnError, setReturnError] = useState<string | undefined>();

    const submitReturn = () =>
        returning &&
        router.post(
            returnGrades().url,
            { ...subjectPayload(returning), reason: returnReason },
            {
                preserveScroll: true,
                onStart: () => setApproving(true),
                onFinish: () => setApproving(false),
                onError: (errors) => setReturnError(errors.reason),
                onSuccess: () => {
                    setReturning(null);
                    setReturnReason('');
                    setReturnError(undefined);
                },
            },
        );

    const submitApproval = () =>
        confirmingApproval &&
        router.post(approveGrades().url, subjectPayload(confirmingApproval), {
            preserveScroll: true,
            onStart: () => setApproving(true),
            onFinish: () => setApproving(false),
            onSuccess: () => setConfirmingApproval(null),
        });

    const reviewSubject = (subject: PendingSubject) => {
        setSearchTerm('');
        applyFilters({
            subject: subject.subject,
            school_year: subject.school_year,
            section: '',
            search: '',
            status: 'pending',
        });
    };

    // Teachers can't delete a college grade once the registrar has posted it.
    const canDelete = (grade: GradeRow) =>
        canManageAll ||
        grade.grading_system !== 'college' ||
        grade.approved_at === null;

    const pendingMessage = `${pendingCount} of your college grade${pendingCount === 1 ? ' is' : 's are'} waiting for the registrar\u2019s approval. Students see grades once they are posted.`;

    const applyFilters = (changes: Partial<Filters>) => {
        const next = { ...filters, search: searchTerm, ...changes };

        router.get(
            gradesIndex().url,
            {
                ...Object.fromEntries(
                    Object.entries(next).filter(([, value]) => value !== ''),
                ),
                // Without a school year the list opens on the one being viewed.
                school_year: next.school_year || 'all',
            },
            { preserveState: true, replace: true },
        );
    };

    const noAssignments =
        !canManageAll && assignments.length === 0 && advisories.length === 0;

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
                                : advisories.length > 0
                                  ? 'Import and review grades for the classes assigned to you and every subject of your advisory class.'
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
                            You don&apos;t have any teaching assignments or an
                            advisory class yet. Ask the Registrar&apos;s Office
                            to assign your subjects and sections before
                            importing grades.
                        </AlertDescription>
                    </Alert>
                )}

                {!canApprove && returnedCount > 0 && (
                    <Alert variant="destructive">
                        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                            <span>
                                {returnedCount} college grade
                                {returnedCount === 1 ? ' was' : 's were'}{' '}
                                returned by the registrar. Check the reason on
                                each one, then correct and upload{' '}
                                {returnedCount === 1 ? 'it' : 'them'} again.
                            </span>
                            {filters.status !== 'returned' && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        applyFilters({ status: 'returned' })
                                    }
                                >
                                    Show returned grades
                                </Button>
                            )}
                        </AlertDescription>
                    </Alert>
                )}

                {canApprove && pendingSubjects.length > 0 && (
                    <section className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
                        <div>
                            <h2 className="font-semibold">
                                Waiting for approval
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {pendingSubjects.length} subject
                                {pendingSubjects.length === 1 ? '' : 's'} (
                                {pendingCount} grade
                                {pendingCount === 1 ? '' : 's'}). Each subject
                                is approved or returned as a whole; approved
                                grades are posted to students right away.
                            </p>
                        </div>
                        <ul className="divide-y divide-sidebar-border/70 overflow-hidden rounded-lg border border-sidebar-border/70 bg-background dark:divide-sidebar-border dark:border-sidebar-border">
                            {pendingSubjects.map((subject) => (
                                <li
                                    key={[
                                        subject.school_year,
                                        subject.term,
                                        subject.subject,
                                        subject.encoded_by,
                                    ].join('|')}
                                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                                >
                                    <div className="min-w-0">
                                        <div className="font-medium">
                                            {subjectLabel(subject)}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {[
                                                subject.term,
                                                `S.Y. ${subject.school_year}`,
                                                subject.sections.join(', '),
                                                subject.teacher
                                                    ? `by ${subject.teacher}`
                                                    : null,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="secondary">
                                            {subject.count} student
                                            {subject.count === 1 ? '' : 's'}
                                        </Badge>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() =>
                                                reviewSubject(subject)
                                            }
                                        >
                                            <Eye /> Review
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={approving}
                                            onClick={() =>
                                                setReturning(subject)
                                            }
                                        >
                                            <Undo2 /> Return
                                        </Button>
                                        <Button
                                            size="sm"
                                            disabled={approving}
                                            onClick={() =>
                                                setConfirmingApproval(subject)
                                            }
                                        >
                                            <Check /> Approve subject
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {!canApprove && pendingCount > 0 && (
                    <Alert>
                        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                            <span>{pendingMessage}</span>
                            {filters.status !== 'pending' && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        applyFilters({ status: 'pending' })
                                    }
                                >
                                    Show pending grades
                                </Button>
                            )}
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

                    <Select
                        value={filters.status || ALL}
                        onValueChange={(value) =>
                            applyFilters({
                                status:
                                    value === ALL
                                        ? ''
                                        : (value as Filters['status']),
                            })
                        }
                    >
                        <SelectTrigger className="w-48" aria-label="Status">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>All statuses</SelectItem>
                            <SelectItem value="pending">
                                Waiting for approval
                            </SelectItem>
                            <SelectItem value="returned">
                                Returned to teacher
                            </SelectItem>
                            <SelectItem value="posted">Posted</SelectItem>
                        </SelectContent>
                    </Select>

                    {(filters.search ||
                        filters.section ||
                        filters.subject ||
                        filters.status ||
                        filters.school_year !== viewingYear) && (
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
                                        grades&rdquo; to upload the Excel
                                        template.
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
                                        {grade.section ?? '—'}
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
                                        {grade.approved_at === null &&
                                            grade.returned_at === null && (
                                                <Badge
                                                    variant="outline"
                                                    className="ml-1 border-amber-500/50 text-amber-700 dark:text-amber-400"
                                                >
                                                    Pending approval
                                                </Badge>
                                            )}
                                        {grade.approved_at === null &&
                                            grade.returned_at !== null && (
                                                <>
                                                    <Badge
                                                        variant="outline"
                                                        className="ml-1 border-red-500/50 text-red-700 dark:text-red-400"
                                                    >
                                                        Returned
                                                    </Badge>
                                                    {grade.return_reason && (
                                                        <div className="mt-1 max-w-56 text-xs text-muted-foreground">
                                                            {
                                                                grade.return_reason
                                                            }
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex justify-end">
                                            {canDelete(grade) && (
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
                                            )}
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
                open={returning !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setReturning(null);
                        setReturnError(undefined);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Return {returning ? subjectLabel(returning) : ''} to
                            the teacher?
                        </DialogTitle>
                    </DialogHeader>
                    <form
                        className="space-y-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            submitReturn();
                        }}
                    >
                        <p className="text-sm text-muted-foreground">
                            All {returning?.count ?? 0} grade
                            {returning?.count === 1 ? '' : 's'} in this subject
                            stay hidden from students.{' '}
                            {returning?.teacher ?? 'The teacher'} is emailed the
                            reason and can upload a correction, which comes back
                            to you for approval.
                        </p>
                        <div className="grid gap-2">
                            <Label htmlFor="return_reason">
                                What should the teacher correct?
                            </Label>
                            <Textarea
                                id="return_reason"
                                value={returnReason}
                                onChange={(e) =>
                                    setReturnReason(e.target.value)
                                }
                                maxLength={255}
                                rows={3}
                                required
                                placeholder="e.g. Finals grades are missing for two students."
                            />
                            <InputError message={returnError} />
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="secondary">Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={approving}>
                                <Undo2 /> Return to teacher
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={confirmingApproval !== null}
                onOpenChange={(open) => !open && setConfirmingApproval(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Approve{' '}
                            {confirmingApproval
                                ? subjectLabel(confirmingApproval)
                                : ''}
                            ?
                        </DialogTitle>
                    </DialogHeader>
                    {confirmingApproval && (
                        <p className="text-sm text-muted-foreground">
                            All {confirmingApproval.count} grade
                            {confirmingApproval.count === 1 ? '' : 's'} for{' '}
                            {[
                                confirmingApproval.term,
                                `S.Y. ${confirmingApproval.school_year}`,
                            ]
                                .filter(Boolean)
                                .join(', ')}
                            {confirmingApproval.teacher &&
                                `, uploaded by ${confirmingApproval.teacher},`}{' '}
                            are posted to students right away.
                        </p>
                    )}
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="secondary">Cancel</Button>
                        </DialogClose>
                        <Button disabled={approving} onClick={submitApproval}>
                            <Check /> Approve subject
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                        Upload the Excel template (or a CSV) with one row per
                        student per subject. Students are matched by student #.
                        Re-importing the same subject and period updates the
                        existing grade.
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
                                            ? 'Columns: term, subject code, units, prelim, midterm and finals (1.00–5.00). Leave grade blank to average the three, or put INC or DRP in it.'
                                            : 'Columns: term 1 to term 3 (0–100). Leave final_grade blank to average the three terms.'}
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
                                    {templateOptions && (
                                        <GradeTemplatePicker
                                            key={system}
                                            system={system}
                                            schoolYear={viewingYear}
                                            options={templateOptions}
                                        />
                                    )}
                                    {classTemplates.length > 0 && (
                                        <div className="grid gap-1">
                                            <span className="text-xs text-muted-foreground">
                                                Or download a template with your
                                                class list filled in:
                                            </span>
                                            {classTemplates.map(
                                                (assignment) => (
                                                    <a
                                                        key={assignment.id}
                                                        href={
                                                            importTemplate(
                                                                system,
                                                                {
                                                                    query: {
                                                                        assignment:
                                                                            assignment.id,
                                                                    },
                                                                },
                                                            ).url
                                                        }
                                                        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                                                    >
                                                        <Download className="size-4" />
                                                        {assignment.subject} —{' '}
                                                        {assignment.section} (
                                                        {assignment.school_year}
                                                        )
                                                    </a>
                                                ),
                                            )}
                                        </div>
                                    )}
                                    {advisoryTemplates.length > 0 && (
                                        <div className="grid gap-1">
                                            <span className="text-xs text-muted-foreground">
                                                Your advisory class (fill in the
                                                subject column for any subject):
                                            </span>
                                            {advisoryTemplates.map(
                                                (advisory) => (
                                                    <a
                                                        key={advisory.id}
                                                        href={
                                                            importTemplate(
                                                                system,
                                                                {
                                                                    query: {
                                                                        advisory:
                                                                            advisory.id,
                                                                    },
                                                                },
                                                            ).url
                                                        }
                                                        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                                                    >
                                                        <Download className="size-4" />
                                                        {advisory.grade_level} —{' '}
                                                        {advisory.section} (
                                                        {advisory.school_year})
                                                    </a>
                                                ),
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="grades-file">
                                        Excel or CSV file
                                    </Label>
                                    <Input
                                        id="grades-file"
                                        name="file"
                                        type="file"
                                        accept=".xlsx,.xls,.csv"
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
