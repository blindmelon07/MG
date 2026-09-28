import { Head } from '@inertiajs/react';
import { GraduationCap } from 'lucide-react';
import StudentLoginForm from '@/components/student/student-login-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function KioskStudentLogin() {
    return (
        <>
            <Head title="My Grades" />

            <div className="mx-auto w-full max-w-md">
                <Card>
                    <CardHeader className="items-center text-center">
                        <GraduationCap className="size-10 text-primary" />
                        <CardTitle className="text-2xl">My Grades</CardTitle>
                        <p className="text-muted-foreground">
                            Sign in with your student number. You&apos;ll be
                            signed out automatically when you step away.
                        </p>
                    </CardHeader>
                    <CardContent>
                        <StudentLoginForm kiosk />
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
