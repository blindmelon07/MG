import { Link, router, usePage } from '@inertiajs/react';
import { KeyRound, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logout } from '@/routes/student';
import { edit as passwordEdit } from '@/routes/student/password';

export default function StudentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { auth } = usePage().props;
    const student = auth.student;

    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
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
                        <div className="flex items-center gap-2">
                            <span className="hidden text-sm text-muted-foreground sm:inline">
                                {student.name}
                            </span>
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
