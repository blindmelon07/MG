import { Head } from '@inertiajs/react';
import StudentPasswordForm from '@/components/student/student-password-form';

export default function StudentPassword({
    mustChange,
}: {
    mustChange: boolean;
}) {
    return (
        <>
            <Head title="Password" />
            <StudentPasswordForm mustChange={mustChange} />
        </>
    );
}
