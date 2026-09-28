import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatGrade, formatUnits, isFailing } from '@/lib/grades';
import { cn } from '@/lib/utils';
import type { GradingSystem } from '@/types/auth';

export type PortalGrade = {
    id: number;
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
};

export type GradePeriod = {
    key: string;
    school_year: string;
    term: string | null;
    grading_system: GradingSystem;
    average: number | null;
    total_units: number | null;
    grades: PortalGrade[];
};

export type PortalStudent = {
    name: string;
    student_number: string;
    grade_level: string | null;
    section: string | null;
    grading_system: GradingSystem;
};

function periodLabel(period: GradePeriod): string {
    return period.term
        ? `${period.term}, S.Y. ${period.school_year}`
        : `S.Y. ${period.school_year}`;
}

function RemarksBadge({ remarks }: { remarks: string | null }) {
    if (!remarks) {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <Badge variant={isFailing(remarks) ? 'destructive' : 'secondary'}>
            {remarks}
        </Badge>
    );
}

export default function StudentGradesView({
    student,
    periods,
    large = false,
}: {
    student: PortalStudent;
    periods: GradePeriod[];
    large?: boolean;
}) {
    const [selectedKey, setSelectedKey] = useState(periods[0]?.key);
    const period = periods.find((p) => p.key === selectedKey) ?? periods[0];
    const college = period?.grading_system === 'college';
    const cell = cn('px-3 py-2', large && 'px-4 py-3');

    return (
        <div className={cn('flex flex-col gap-6', large && 'text-base')}>
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                    {student.name}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Student # {student.student_number}
                    {[student.grade_level, student.section].some(Boolean) &&
                        ` · ${[student.grade_level, student.section]
                            .filter(Boolean)
                            .join(' — ')}`}
                </p>
            </div>

            {periods.length === 0 || !period ? (
                <div className="rounded-xl border border-dashed border-sidebar-border/70 p-10 text-center text-muted-foreground dark:border-sidebar-border">
                    No grades have been posted yet. Check back after your
                    teachers submit them.
                </div>
            ) : (
                <>
                    {periods.length > 1 && (
                        <div
                            className="flex flex-wrap gap-2"
                            role="tablist"
                            aria-label="Grading period"
                        >
                            {periods.map((p) => (
                                <Button
                                    key={p.key}
                                    role="tab"
                                    aria-selected={p.key === period.key}
                                    variant={
                                        p.key === period.key
                                            ? 'default'
                                            : 'outline'
                                    }
                                    size={large ? 'lg' : 'sm'}
                                    onClick={() => setSelectedKey(p.key)}
                                >
                                    {periodLabel(p)}
                                </Button>
                            ))}
                        </div>
                    )}

                    <section className="flex flex-col gap-3">
                        <h2 className="text-lg font-semibold">
                            {periodLabel(period)}
                        </h2>

                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                            <table className="w-full text-sm">
                                <thead className="border-b border-sidebar-border/70 bg-muted/50 text-left dark:border-sidebar-border">
                                    {college ? (
                                        <tr>
                                            <th
                                                className={cn(
                                                    cell,
                                                    'font-medium',
                                                )}
                                            >
                                                Code
                                            </th>
                                            <th
                                                className={cn(
                                                    cell,
                                                    'font-medium',
                                                )}
                                            >
                                                Subject
                                            </th>
                                            <th
                                                className={cn(
                                                    cell,
                                                    'text-right font-medium',
                                                )}
                                            >
                                                Units
                                            </th>
                                            <th
                                                className={cn(
                                                    cell,
                                                    'text-right font-medium',
                                                )}
                                            >
                                                Midterm
                                            </th>
                                            <th
                                                className={cn(
                                                    cell,
                                                    'text-right font-medium',
                                                )}
                                            >
                                                Final
                                            </th>
                                            <th
                                                className={cn(
                                                    cell,
                                                    'font-medium',
                                                )}
                                            >
                                                Remarks
                                            </th>
                                        </tr>
                                    ) : (
                                        <tr>
                                            <th
                                                className={cn(
                                                    cell,
                                                    'font-medium',
                                                )}
                                            >
                                                Subject
                                            </th>
                                            <th
                                                className={cn(
                                                    cell,
                                                    'text-right font-medium',
                                                )}
                                            >
                                                Q1
                                            </th>
                                            <th
                                                className={cn(
                                                    cell,
                                                    'text-right font-medium',
                                                )}
                                            >
                                                Q2
                                            </th>
                                            <th
                                                className={cn(
                                                    cell,
                                                    'text-right font-medium',
                                                )}
                                            >
                                                Q3
                                            </th>
                                            <th
                                                className={cn(
                                                    cell,
                                                    'text-right font-medium',
                                                )}
                                            >
                                                Q4
                                            </th>
                                            <th
                                                className={cn(
                                                    cell,
                                                    'text-right font-medium',
                                                )}
                                            >
                                                Final
                                            </th>
                                            <th
                                                className={cn(
                                                    cell,
                                                    'font-medium',
                                                )}
                                            >
                                                Remarks
                                            </th>
                                        </tr>
                                    )}
                                </thead>
                                <tbody className="tabular-nums">
                                    {period.grades.map((grade) =>
                                        college ? (
                                            <tr
                                                key={grade.id}
                                                className="border-b border-sidebar-border/70 last:border-0 dark:border-sidebar-border"
                                            >
                                                <td
                                                    className={cn(
                                                        cell,
                                                        'text-muted-foreground',
                                                    )}
                                                >
                                                    {grade.subject_code ?? '—'}
                                                </td>
                                                <td
                                                    className={cn(
                                                        cell,
                                                        'font-medium',
                                                    )}
                                                >
                                                    {grade.subject}
                                                </td>
                                                <td
                                                    className={cn(
                                                        cell,
                                                        'text-right',
                                                    )}
                                                >
                                                    {formatUnits(grade.units)}
                                                </td>
                                                <td
                                                    className={cn(
                                                        cell,
                                                        'text-right',
                                                    )}
                                                >
                                                    {formatGrade(
                                                        grade.midterm,
                                                        'college',
                                                    )}
                                                </td>
                                                <td
                                                    className={cn(
                                                        cell,
                                                        'text-right font-semibold',
                                                    )}
                                                >
                                                    {formatGrade(
                                                        grade.final_grade,
                                                        'college',
                                                    )}
                                                </td>
                                                <td className={cell}>
                                                    <RemarksBadge
                                                        remarks={grade.remarks}
                                                    />
                                                </td>
                                            </tr>
                                        ) : (
                                            <tr
                                                key={grade.id}
                                                className="border-b border-sidebar-border/70 last:border-0 dark:border-sidebar-border"
                                            >
                                                <td
                                                    className={cn(
                                                        cell,
                                                        'font-medium',
                                                    )}
                                                >
                                                    {grade.subject}
                                                </td>
                                                {(
                                                    [
                                                        'q1',
                                                        'q2',
                                                        'q3',
                                                        'q4',
                                                    ] as const
                                                ).map((q) => (
                                                    <td
                                                        key={q}
                                                        className={cn(
                                                            cell,
                                                            'text-right',
                                                        )}
                                                    >
                                                        {formatGrade(
                                                            grade[q],
                                                            'k12',
                                                        )}
                                                    </td>
                                                ))}
                                                <td
                                                    className={cn(
                                                        cell,
                                                        'text-right font-semibold',
                                                    )}
                                                >
                                                    {formatGrade(
                                                        grade.final_grade,
                                                        'k12',
                                                    )}
                                                </td>
                                                <td className={cell}>
                                                    <RemarksBadge
                                                        remarks={grade.remarks}
                                                    />
                                                </td>
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                            <div className="flex gap-2">
                                <dt className="text-muted-foreground">
                                    {college ? 'GWA' : 'General average'}
                                </dt>
                                <dd className="font-semibold tabular-nums">
                                    {period.average === null
                                        ? '—'
                                        : college
                                          ? period.average.toFixed(2)
                                          : period.average}
                                </dd>
                            </div>
                            {college && period.total_units !== null && (
                                <div className="flex gap-2">
                                    <dt className="text-muted-foreground">
                                        Total units
                                    </dt>
                                    <dd className="font-semibold tabular-nums">
                                        {period.total_units}
                                    </dd>
                                </div>
                            )}
                        </dl>
                        <p className="text-xs text-muted-foreground">
                            {college
                                ? 'Grades use the 1.00–5.00 scale; 3.00 is passing. GWA is weighted by units.'
                                : 'Final grade is the average of the four quarters; 75 is passing.'}{' '}
                            For corrections, contact your teacher or the
                            Registrar&apos;s Office.
                        </p>
                    </section>
                </>
            )}
        </div>
    );
}
