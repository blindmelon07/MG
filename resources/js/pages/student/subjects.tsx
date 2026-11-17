import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { formatUnits } from '@/lib/grades';
import { cn } from '@/lib/utils';
import { update } from '@/routes/student/subjects';

type OfferedSubject = {
    id: number;
    code: string | null;
    name: string;
    course_id: number | null;
    year_level: string | null;
    semester: string | null;
    units: string | null;
    course: { id: number; code: string } | null;
};

export default function StudentSubjects({
    schoolYear,
    yearLevel,
    semesters,
    subjects,
    chosen,
}: {
    schoolYear: string;
    yearLevel: string | null;
    semesters: string[];
    subjects: OfferedSubject[];
    /** Subject id => the semester it was chosen for. */
    chosen: Record<string, string>;
}) {
    const { errors } = usePage().props as {
        errors: Record<string, string>;
    };
    const [semester, setSemester] = useState(semesters[0]);
    const [selected, setSelected] = useState<number[]>(() =>
        idsChosenFor(chosen, semesters[0]),
    );
    const [processing, setProcessing] = useState(false);
    // Irregular students can also take subjects from other year levels.
    const [allYears, setAllYears] = useState(false);

    const inSemester = subjects.filter(
        (subject) => subject.semester === null || subject.semester === semester,
    );
    // Chosen subjects stay listed even when they're from another year level.
    const offered = inSemester.filter(
        (subject) =>
            allYears ||
            subject.year_level === null ||
            subject.year_level === yearLevel ||
            selected.includes(subject.id) ||
            chosen[subject.id] !== undefined,
    );
    const hiddenCount = inSemester.length - offered.length;
    const savedIds = idsChosenFor(chosen, semester);
    const dirty =
        savedIds.length !== selected.length ||
        savedIds.some((id) => !selected.includes(id));
    const totalUnits = inSemester
        .filter((subject) => selected.includes(subject.id))
        .reduce((sum, subject) => sum + Number(subject.units ?? 0), 0);
    const firstError = Object.entries(errors).find(([key]) =>
        key.startsWith('subject_ids'),
    )?.[1];

    const switchSemester = (next: string) => {
        setSemester(next);
        setSelected(idsChosenFor(chosen, next));
    };

    const toggle = (id: number, checked: boolean) =>
        setSelected((ids) =>
            checked ? [...ids, id] : ids.filter((other) => other !== id),
        );

    const save = () =>
        router.put(
            update().url,
            { semester, subject_ids: selected },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
            },
        );

    return (
        <>
            <Head title="My subjects" />

            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        My subjects
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Choose the subjects you&apos;ll take each semester of
                        S.Y. {schoolYear}
                        {yearLevel && ` · ${yearLevel}`}.
                    </p>
                </div>

                <div
                    className="flex flex-wrap gap-2"
                    role="tablist"
                    aria-label="Semester"
                >
                    {semesters.map((option) => {
                        const count = idsChosenFor(chosen, option).length;

                        return (
                            <Button
                                key={option}
                                role="tab"
                                aria-selected={option === semester}
                                variant={
                                    option === semester ? 'default' : 'outline'
                                }
                                size="sm"
                                onClick={() => switchSemester(option)}
                            >
                                {option}
                                {count > 0 && ` (${count})`}
                            </Button>
                        );
                    })}
                </div>

                {(hiddenCount > 0 || allYears) && yearLevel && (
                    <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                            checked={allYears}
                            onCheckedChange={(checked) =>
                                setAllYears(checked === true)
                            }
                        />
                        Show subjects from other year levels
                        {hiddenCount > 0 && ` (${hiddenCount} more)`}
                    </label>
                )}

                {offered.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-sidebar-border/70 p-10 text-center text-muted-foreground dark:border-sidebar-border">
                        No subjects are offered to you in the {semester}.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                        <table className="w-full text-sm">
                            <thead className="border-b border-sidebar-border/70 bg-muted/50 text-left dark:border-sidebar-border">
                                <tr>
                                    <th className="w-12 px-3 py-2">
                                        <span className="sr-only">Take</span>
                                    </th>
                                    <th className="px-3 py-2 font-medium">
                                        Code
                                    </th>
                                    <th className="px-3 py-2 font-medium">
                                        Subject
                                    </th>
                                    <th className="px-3 py-2 font-medium">
                                        Year level
                                    </th>
                                    <th className="px-3 py-2 font-medium">
                                        Type
                                    </th>
                                    <th className="px-3 py-2 text-right font-medium">
                                        Units
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="tabular-nums">
                                {offered.map((subject) => {
                                    const elsewhere =
                                        chosen[subject.id] !== undefined &&
                                        chosen[subject.id] !== semester
                                            ? chosen[subject.id]
                                            : null;
                                    const inputId = `subject-${subject.id}`;

                                    return (
                                        <tr
                                            key={subject.id}
                                            className={cn(
                                                'border-b border-sidebar-border/70 last:border-0 dark:border-sidebar-border',
                                                elsewhere && 'opacity-60',
                                            )}
                                        >
                                            <td className="px-3 py-2">
                                                <Checkbox
                                                    id={inputId}
                                                    checked={selected.includes(
                                                        subject.id,
                                                    )}
                                                    disabled={
                                                        elsewhere !== null
                                                    }
                                                    onCheckedChange={(
                                                        checked,
                                                    ) =>
                                                        toggle(
                                                            subject.id,
                                                            checked === true,
                                                        )
                                                    }
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-muted-foreground">
                                                {subject.code ?? '—'}
                                            </td>
                                            <td className="px-3 py-2">
                                                <label
                                                    htmlFor={inputId}
                                                    className="font-medium"
                                                >
                                                    {subject.name}
                                                </label>
                                                {elsewhere && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Already chosen for{' '}
                                                        {elsewhere}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-muted-foreground">
                                                {subject.year_level ?? 'Any'}
                                            </td>
                                            <td className="px-3 py-2 text-muted-foreground">
                                                {subject.course?.code ??
                                                    'General education'}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                {formatUnits(subject.units)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <InputError message={firstError} />

                <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground">
                        {selected.length} subject
                        {selected.length === 1 ? '' : 's'} ·{' '}
                        <span className="font-semibold text-foreground tabular-nums">
                            {totalUnits}
                        </span>{' '}
                        units
                    </p>
                    <Button onClick={save} disabled={processing || !dirty}>
                        Save {semester}
                    </Button>
                </div>
            </div>
        </>
    );
}

function idsChosenFor(chosen: Record<string, string>, semester: string) {
    return Object.entries(chosen)
        .filter(([, chosenSemester]) => chosenSemester === semester)
        .map(([id]) => Number(id));
}
