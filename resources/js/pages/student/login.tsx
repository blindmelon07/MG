import { Head } from '@inertiajs/react';
import StudentLoginForm from '@/components/student/student-login-form';

export default function StudentLogin() {
    return (
        <>
            <Head title="Student sign in" />

            <div className="mx-auto flex w-full max-w-sm flex-col gap-6 py-8">
                <div className="text-center">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Student sign in
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Sign in with your student number to view your grades.
                    </p>
                </div>

                <StudentLoginForm kiosk={false} />
            </div>
        </>
    );
}
