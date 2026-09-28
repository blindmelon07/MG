import { Head } from '@inertiajs/react';
import StudentGradesView from '@/components/student/student-grades-view';
import type {
    GradePeriod,
    PortalStudent,
} from '@/components/student/student-grades-view';
import { useVerifyOnHistoryRestore } from '@/hooks/use-verify-on-history-restore';

export default function StudentGrades({
    student,
    periods,
}: {
    student: PortalStudent;
    periods: GradePeriod[];
}) {
    const verified = useVerifyOnHistoryRestore();

    return (
        <>
            <Head title="My grades" />
            {verified && (
                <StudentGradesView student={student} periods={periods} />
            )}
        </>
    );
}
