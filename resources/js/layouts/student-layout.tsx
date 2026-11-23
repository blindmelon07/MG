import { Link, router, usePage } from '@inertiajs/react';
import { BookOpen, GraduationCap, KeyRound, LogOut } from 'lucide-react';
import { KioskThemeStyle } from '@/components/kiosk-theme-style';
import { Button } from '@/components/ui/button';
import { useKioskLockdown } from '@/hooks/use-kiosk-lockdown';
import { grades, logout } from '@/routes/student';
import { edit as passwordEdit } from '@/routes/student/password';
import { index as subjectsIndex } from '@/routes/student/subjects';

// College and graduate students choose the subjects they take.
const CHOOSES_SUBJECTS = ['college', 'graduate'];

export default function StudentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { auth, kioskMode } = usePage().props;
    const student = auth.student;
    useKioskLockdown(kioskMode);

    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            <KioskThemeStyle />
            <header className="border-b border-sidebar-border/70 dark:border-sidebar-border">
                <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
                    <div className="flex items-center gap-3">
                        <img
                            src="/logo.png"
                            alt="Aemilianum College Inc."
                            className="size-10"
                        />
                        <div className="flex flex-col">
                            <span className="font-semibold tracking-tight">
                                Aemilianum College Inc.
                            </span>
                            <span className="text-sm text-muted-foreground">
                                Student Portal
                            </span>
                        </div>
                    </div>

                    {student && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="hidden text-sm text-muted-foreground sm:inline">
                                {student.name}
                            </span>
                            {CHOOSES_SUBJECTS.includes(
                                student.education_level ?? '',
                            ) && (
                                <>
                                    <Button variant="ghost" size="sm" asChild>
                                        <Link href={grades()}>
                                            <GraduationCap /> Grades
                                        </Link>
                                    </Button>
                                    <Button variant="ghost" size="sm" asChild>
                                        <Link href={subjectsIndex()}>
                                            <BookOpen /> Subjects
                                        </Link>
                                    </Button>
                                </>
                            )}
                            <Button variant="ghost" size="sm" asChild>
                                <Link href={passwordEdit()}>
                                    <KeyRound /> Password
                                </Link>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.post(logout().url)}
                            >
                                <LogOut /> Sign out
                            </Button>
                        </div>
                    )}
                </div>
            </header>

            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
                {children}
            </main>
        </div>
    );
}
