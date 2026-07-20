import { Link } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { home } from '@/routes';
import { index as announcementsIndex } from '@/routes/announcements';
import { index as manualsIndex } from '@/routes/manuals';

const navItems = [
    { title: 'Home', href: home() },
    { title: 'School Manual', href: manualsIndex() },
    { title: 'Announcements & Events', href: announcementsIndex() },
];

function useClock() {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);

        return () => clearInterval(timer);
    }, []);

    return now;
}

export default function KioskLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const now = useClock();

    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            <header className="border-b border-sidebar-border/70 dark:border-sidebar-border">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
                    <Link href={home()} className="flex flex-col">
                        <span className="text-lg font-semibold tracking-tight">
                            Aemilianum College Inc.
                        </span>
                        <span className="text-sm text-muted-foreground">
                            Smart Information Kiosk
                        </span>
                    </Link>

                    <nav className="flex flex-wrap items-center gap-2">
                        {navItems.map((item) => (
                            <Link
                                key={item.title}
                                href={item.href}
                                className="rounded-lg px-4 py-3 text-base font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                            >
                                {item.title}
                            </Link>
                        ))}
                    </nav>

                    <div className="text-right text-sm text-muted-foreground tabular-nums">
                        <div>
                            {now.toLocaleDateString(undefined, {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                            })}
                        </div>
                        <div>
                            {now.toLocaleTimeString(undefined, {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                            })}
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
                {children}
            </main>

            <footer className="border-t border-sidebar-border/70 px-6 py-4 text-center text-xs text-muted-foreground dark:border-sidebar-border">
                Aemilianum College Inc. &mdash; AI-Powered Smart Information
                Kiosk
            </footer>
        </div>
    );
}
