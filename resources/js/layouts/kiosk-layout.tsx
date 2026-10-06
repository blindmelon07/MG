import { Link, usePage } from '@inertiajs/react';
import {
    BookOpen,
    Download,
    GraduationCap,
    House,
    Map as MapIcon,
    Megaphone,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import ChatbotWidget from '@/components/chatbot-widget';
import { Button } from '@/components/ui/button';
import { useInstallPrompt } from '@/hooks/use-install-prompt';
import { cn } from '@/lib/utils';
import { home } from '@/routes';
import { index as announcementsIndex } from '@/routes/announcements';
import { index as manualsIndex } from '@/routes/manuals';
import { index as mapsIndex } from '@/routes/maps';
import { login as studentLogin } from '@/routes/student';

const navItems = [
    { title: 'Home', short: 'Home', icon: House, href: home() },
    {
        title: 'School Manual',
        short: 'Manual',
        icon: BookOpen,
        href: manualsIndex(),
    },
    {
        title: 'Announcements & Events',
        short: 'News',
        icon: Megaphone,
        href: announcementsIndex(),
    },
    { title: 'Campus Map', short: 'Map', icon: MapIcon, href: mapsIndex() },
    {
        title: 'My Grades',
        short: 'Grades',
        icon: GraduationCap,
        href: studentLogin({ query: { kiosk: 1 } }),
    },
];

function useClock() {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);

        return () => clearInterval(timer);
    }, []);

    return now;
}

/** Whether a nav item is the current page (Home only matches exactly). */
function isActive(currentUrl: string, href: string) {
    const current = currentUrl.split('?')[0];
    const target = new URL(href, 'http://x').pathname;

    return target === '/' ? current === '/' : current.startsWith(target);
}

function InstallButton({ className }: { className?: string }) {
    const { canInstall, showIosHint, install } = useInstallPrompt();

    if (!canInstall && !showIosHint) {
        return null;
    }

    return (
        <Button
            size="sm"
            variant="outline"
            className={className}
            onClick={() => {
                if (canInstall) {
                    void install();
                } else {
                    toast('Install the ACI Kiosk app', {
                        description:
                            'Tap the Share button in Safari, then "Add to Home Screen".',
                        duration: 8000,
                    });
                }
            }}
        >
            <Download />
            Install app
        </Button>
    );
}

export default function KioskLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const now = useClock();
    const { url } = usePage();

    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            {/* Phones: slim sticky app bar. */}
            <header className="sticky top-0 z-30 border-b border-sidebar-border/70 bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden dark:border-sidebar-border">
                <div className="flex items-center gap-3 px-4 py-2.5">
                    <Link
                        href={home()}
                        className="flex min-w-0 flex-1 items-center gap-2.5"
                    >
                        <img
                            src="/logo.png"
                            alt="Aemilianum College Inc."
                            className="size-9 shrink-0"
                        />
                        <div className="flex min-w-0 flex-col leading-tight">
                            <span className="truncate text-sm font-semibold tracking-tight">
                                Aemilianum College Inc.
                            </span>
                            <span className="truncate text-xs text-muted-foreground tabular-nums">
                                {now.toLocaleDateString(undefined, {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                })}{' '}
                                ·{' '}
                                {now.toLocaleTimeString(undefined, {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                })}
                            </span>
                        </div>
                    </Link>

                    <InstallButton className="shrink-0" />
                </div>
            </header>

            {/* Tablets and kiosks: full header with the nav and clock. */}
            <header className="hidden border-b border-sidebar-border/70 md:block dark:border-sidebar-border">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
                    <Link href={home()} className="flex items-center gap-3">
                        <img
                            src="/logo.png"
                            alt="Aemilianum College Inc."
                            className="size-12"
                        />
                        <div className="flex flex-col">
                            <span className="text-lg font-semibold tracking-tight">
                                Aemilianum College Inc.
                            </span>
                            <span className="text-sm text-muted-foreground">
                                Smart Information Kiosk
                            </span>
                        </div>
                    </Link>

                    <nav className="flex flex-wrap items-center gap-2">
                        {navItems.map((item) => (
                            <Link
                                key={item.title}
                                href={item.href}
                                className={cn(
                                    'rounded-lg px-4 py-3 text-base font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                                    isActive(url, item.href.url) &&
                                        'bg-accent text-accent-foreground',
                                )}
                            >
                                {item.title}
                            </Link>
                        ))}
                    </nav>

                    <div className="flex items-center gap-4">
                        <InstallButton />
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
                </div>
            </header>

            {/* Bottom padding on phones keeps content clear of the tab bar. */}
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-6 md:py-8">
                {children}
            </main>

            <footer className="hidden border-t border-sidebar-border/70 px-6 py-4 text-center text-xs text-muted-foreground md:block dark:border-sidebar-border">
                Aemilianum College Inc. &mdash; AI-Powered Smart Information
                Kiosk
            </footer>

            {/* Phones: app-style tab bar. */}
            <nav
                aria-label="Main"
                className="fixed inset-x-0 bottom-0 z-30 border-t border-sidebar-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-sidebar-border"
            >
                <div className="grid grid-cols-5">
                    {navItems.map((item) => {
                        const active = isActive(url, item.href.url);

                        return (
                            <Link
                                key={item.title}
                                href={item.href}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors',
                                    active
                                        ? 'text-primary'
                                        : 'text-muted-foreground',
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                                        active && 'bg-primary/10',
                                    )}
                                >
                                    <item.icon className="size-5" />
                                </span>
                                {item.short}
                            </Link>
                        );
                    })}
                </div>
            </nav>

            <ChatbotWidget />
        </div>
    );
}
