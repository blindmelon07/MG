import { Head } from '@inertiajs/react';
import StudentPasswordForm from '@/components/student/student-password-form';
import { useIdleLogout } from '@/hooks/use-idle-logout';

export default function KioskStudentPassword({
    mustChange,
}: {
    mustChange: boolean;
}) {
    useIdleLogout(120);

    return (
        <>
            <Head title="Password" />
            <StudentPasswordForm mustChange={mustChange} />
        </>
    );
}
