import { Link, usePage } from '@inertiajs/react';
import {
    BookOpen,
    Building2,
    Download,
    GraduationCap,
    House,
    Map as MapIcon,
    Megaphone,
    Moon,
    Sun,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import ChatbotWidget from '@/components/chatbot-widget';
import { KioskBrandHeader } from '@/components/kiosk-brand-header';
import { KioskThemeStyle } from '@/components/kiosk-theme-style';
import { Button } from '@/components/ui/button';
import { useAppearance } from '@/hooks/use-appearance';
import { useInstallPrompt } from '@/hooks/use-install-prompt';
import { useKioskLockdown } from '@/hooks/use-kiosk-lockdown';
import { cn } from '@/lib/utils';
import { home } from '@/routes';
import { index as announcementsIndex } from '@/routes/announcements';
import { index as directoryIndex } from '@/routes/directory';
import { index as manualsIndex } from '@/routes/manuals';
import { index as mapsIndex } from '@/routes/maps';
import { login as studentLogin } from '@/routes/student';

const navItems = [
    { title: 'Home', short: 'Home', icon: House, href: home() },
    {
        title: 'Directory',
        short: 'Directory',
        icon: Building2,
        href: directoryIndex(),
    },
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
        title: 'My Acads',
        short: 'Acads',
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

function ThemeToggle({ className }: { className?: string }) {
    const { resolvedAppearance, updateAppearance } = useAppearance();
    const isDark = resolvedAppearance === 'dark';

    return (
        <Button
            size="icon"
            variant="outline"
            className={className}
            onClick={() => updateAppearance(isDark ? 'light' : 'dark')}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            {isDark ? <Sun /> : <Moon />}
        </Button>
    );
}

export default function KioskLayout({
    children,
    immersive = false,
}: {
    children: React.ReactNode;
    /**
     * Kiosk-screen pages (the 3D map home): on tablets and kiosks the page
     * fills the screen under a slim top bar, with no nav row or footer.
     */
    immersive?: boolean;
}) {
    const now = useClock();
    const { url, props } = usePage();
    const kioskMode = props.kioskMode;
    useKioskLockdown(kioskMode);

    return (
        <div
            className={cn(
                'kiosk-root flex min-h-screen flex-col bg-background text-foreground',
                immersive && 'lg:h-dvh lg:min-h-0 lg:overflow-hidden',
            )}
        >
            <KioskThemeStyle />

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
                            {/* The server renders its own time; let the browser's clock win without a hydration error. */}
                            <span
                                className="truncate text-xs text-muted-foreground tabular-nums"
                                suppressHydrationWarning
                            >
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

                    {!kioskMode && <InstallButton className="shrink-0" />}
                    <ThemeToggle className="shrink-0" />
                </div>
            </header>

            {/* Tablets and kiosks: the branded header with the nav and clock. */}
            <KioskBrandHeader
                navItems={navItems.map((item) => ({
                    title: item.title,
                    icon: item.icon,
                    href: item.href,
                    active: isActive(url, item.href.url),
                }))}
                actions={
                    <>
                        {!kioskMode && (
                            <InstallButton className="rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white" />
                        )}
                        <ThemeToggle className="rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white" />
                    </>
                }
            />

            {/* Bottom padding on phones keeps content clear of the tab bar. */}
            <main
                className={cn(
                    'mx-auto w-full flex-1',
                    immersive
                        ? 'pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0 lg:min-h-0'
                        : 'max-w-6xl px-4 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-6 md:py-8',
                )}
            >
                {children}
            </main>

            <footer
                className={cn(
                    'hidden border-t border-sidebar-border/70 px-6 py-4 text-center text-sm text-muted-foreground dark:border-sidebar-border',
                    !immersive && 'md:block',
                )}
            >
                Aemilianum College Inc. &mdash; Smart Information Kiosk
            </footer>

            {/* Phones: app-style tab bar. */}
            <nav
                aria-label="Main"
                className="fixed inset-x-0 bottom-0 z-30 border-t border-sidebar-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-sidebar-border"
            >
                <div className="grid grid-cols-6">
                    {navItems.map((item) => {
                        const active = isActive(url, item.href.url);

                        return (
                            <Link
                                key={item.title}
                                href={item.href}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'flex flex-col items-center gap-1 py-2 text-[11px] font-semibold transition-colors',
                                    active
                                        ? 'text-primary'
                                        : 'text-muted-foreground',
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                                        active &&
                                            'bg-primary text-primary-foreground',
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
