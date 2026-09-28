import { Head, router } from '@inertiajs/react';
import { LogOut } from 'lucide-react';
import StudentGradesView from '@/components/student/student-grades-view';
import type {
    GradePeriod,
    PortalStudent,
} from '@/components/student/student-grades-view';
import { Button } from '@/components/ui/button';
import { useIdleLogout } from '@/hooks/use-idle-logout';
import { useVerifyOnHistoryRestore } from '@/hooks/use-verify-on-history-restore';
import { logout } from '@/routes/student';

const IDLE_SECONDS = 60;

export default function KioskStudentGrades({
    student,
    periods,
}: {
    student: PortalStudent;
    periods: GradePeriod[];
}) {
    const remaining = useIdleLogout(IDLE_SECONDS);
    const verified = useVerifyOnHistoryRestore();

    return (
        <>
            <Head title="My Grades" />

            <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-sidebar-border/70 bg-muted/40 px-4 py-3 dark:border-sidebar-border">
                    <p
                        className="text-sm text-muted-foreground"
                        aria-live="polite"
                    >
                        {remaining <= 15
                            ? `Signing you out in ${remaining} seconds. Touch the screen to stay.`
                            : 'You’ll be signed out automatically after a minute of inactivity.'}
                    </p>
                    <Button size="lg" onClick={() => router.post(logout().url)}>
                        <LogOut /> Sign out
                    </Button>
                </div>

                {verified && (
                    <StudentGradesView
                        student={student}
                        periods={periods}
                        large
                    />
                )}
            </div>
        </>
    );
}
