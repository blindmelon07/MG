import { Head } from '@inertiajs/react';
import type { EducationLevelOption } from '@/components/education-level-fields';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { mine } from '@/routes/admin/teaching-assignments';

type Assignment = {
    id: number;
    education_level: string | null;
    grade_level: string | null;
    subject: string;
    section: string;
    school_year: string;
};

export default function MyTeachingAssignments({
    assignments,
    educationLevels,
}: {
    assignments: Assignment[];
    educationLevels: EducationLevelOption[];
}) {
    const levelLabel = (value: string | null) =>
        educationLevels.find((option) => option.value === value)?.label ??
        'Unspecified';

    const schoolYears = [
        ...new Set(assignments.map((assignment) => assignment.school_year)),
    ];

    return (
        <>
            <Head title="My Teaching Assignments" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <Heading
                    title="My Teaching Assignments"
                    description="The classes the registrar has assigned to you. You can import grades for these."
                />

                {assignments.length === 0 && (
                    <div className="rounded-xl border border-dashed border-sidebar-border/70 px-4 py-10 text-center text-sm text-muted-foreground dark:border-sidebar-border">
                        You have no teaching assignments yet. Ask the registrar
                        to assign your classes.
                    </div>
                )}

                {schoolYears.map((schoolYear) => (
                    <section key={schoolYear} className="space-y-3">
                        <h2 className="text-sm font-medium text-muted-foreground">
                            School year {schoolYear}
                        </h2>
                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                            <table className="w-full text-sm">
                                <thead className="border-b border-sidebar-border/70 bg-muted/50 text-left dark:border-sidebar-border">
                                    <tr>
                                        <th className="px-4 py-2 font-medium">
                                            Subject
                                        </th>
                                        <th className="px-4 py-2 font-medium">
                                            Level
                                        </th>
                                        <th className="px-4 py-2 font-medium">
                                            Year level
                                        </th>
                                        <th className="px-4 py-2 font-medium">
                                            Section
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {assignments
                                        .filter(
                                            (assignment) =>
                                                assignment.school_year ===
                                                schoolYear,
                                        )
                                        .map((assignment) => (
                                            <tr
                                                key={assignment.id}
                                                className="border-b border-sidebar-border/70 last:border-0 dark:border-sidebar-border"
                                            >
                                                <td className="px-4 py-2 font-medium">
                                                    {assignment.subject}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <Badge variant="secondary">
                                                        {levelLabel(
                                                            assignment.education_level,
                                                        )}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-2">
                                                    {assignment.grade_level ??
                                                        '—'}
                                                </td>
                                                <td className="px-4 py-2">
                                                    {assignment.section}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                ))}
            </div>
        </>
    );
}

MyTeachingAssignments.layout = {
    breadcrumbs: [{ title: 'My Teaching Assignments', href: mine() }],
};
