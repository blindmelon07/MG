import type { UrlMethodPair } from '@inertiajs/core';
import { Link } from '@inertiajs/react';
import { CalendarDays, MapPin } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { home } from '@/routes';

export type KioskNavItem = {
    title: string;
    icon: LucideIcon;
    href: UrlMethodPair;
    active: boolean;
};

function useClock() {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);

        return () => clearInterval(timer);
    }, []);

    return now;
}

/**
 * The kiosk's branded header on tablets and kiosk screens: school seal and
 * name, the "Campus Information Kiosk" title, date and time, and the main
 * navigation as gold pills.
 */
export function KioskBrandHeader({
    navItems,
    actions,
}: {
    navItems: KioskNavItem[];
    /** Small round buttons in the top-right corner (theme, install). */
    actions?: React.ReactNode;
}) {
    const now = useClock();

    return (
        <header className="relative hidden overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 text-white md:block">
            {/* Gold sweep behind the title, like the printed tarpaulins. */}
            <svg
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full"
                preserveAspectRatio="none"
                viewBox="0 0 1200 260"
            >
                <defs>
                    <linearGradient id="kiosk-gold" x1="0" x2="1">
                        <stop offset="0" stopColor="#f9cf4d" stopOpacity="0" />
                        <stop offset="0.35" stopColor="#f9cf4d" />
                        <stop
                            offset="1"
                            stopColor="#f0b62a"
                            stopOpacity="0.15"
                        />
                    </linearGradient>
                    <radialGradient id="kiosk-glow" cx="0.78" cy="0.2" r="0.6">
                        <stop
                            offset="0"
                            stopColor="#3b6fe0"
                            stopOpacity="0.45"
                        />
                        <stop offset="1" stopColor="#3b6fe0" stopOpacity="0" />
                    </radialGradient>
                </defs>
                <rect width="1200" height="260" fill="url(#kiosk-glow)" />
                <path
                    d="M0 118 C 300 70, 620 70, 1200 30"
                    stroke="url(#kiosk-gold)"
                    strokeWidth="3"
                    fill="none"
                />
                <path
                    d="M0 128 C 320 86, 640 86, 1200 46"
                    stroke="url(#kiosk-gold)"
                    strokeWidth="1"
                    fill="none"
                    opacity="0.6"
                />
            </svg>

            <div className="relative flex flex-col gap-2 px-6 pt-3 pb-3 xl:px-8">
                {/* School */}
                <div className="flex items-center justify-between gap-6">
                    <Link
                        href={home()}
                        className="flex min-w-0 items-center gap-4"
                    >
                        <img
                            src="/logo.png"
                            alt="Aemilianum College Inc. seal"
                            className="size-16 shrink-0 rounded-full bg-white p-0.5 shadow-lg ring-2 ring-gold-400 xl:size-20"
                        />
                        <div className="min-w-0">
                            <div className="font-brand text-2xl leading-none font-bold tracking-wide drop-shadow lg:text-3xl xl:text-4xl">
                                AEMILIANUM COLLEGE INC.
                            </div>
                            <div className="mt-1.5 flex items-center gap-3 text-xs tracking-[0.55em] text-white/80 xl:text-sm">
                                SORSOGON CITY
                                <span className="h-px w-24 bg-gradient-to-r from-gold-400 to-transparent" />
                            </div>
                        </div>
                    </Link>

                    <div className="flex shrink-0 items-start gap-4">
                        <p className="hidden text-right font-script text-2xl leading-tight text-gold-200 drop-shadow lg:block xl:text-3xl">
                            A Catholic Institution
                            <br />
                            in the Tradition of St. Jerome Emiliani
                        </p>
                        {actions && <div className="flex gap-2">{actions}</div>}
                    </div>
                </div>

                {/* Kiosk title and clock */}
                <div className="flex items-center justify-between gap-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="relative flex size-12 shrink-0 items-center justify-center xl:size-14">
                            <span className="absolute bottom-0 h-3 w-10 rounded-[50%] bg-sky-300/40 blur-[2px]" />
                            <MapPin className="relative size-11 fill-gold-400 text-brand-950 drop-shadow-lg xl:size-12" />
                        </span>
                        <div className="min-w-0">
                            <h1 className="font-display text-2xl leading-none font-extrabold tracking-tight lg:text-3xl xl:text-[2.6rem]">
                                CAMPUS INFORMATION{' '}
                                <span className="text-gold-400">KIOSK</span>
                            </h1>
                            <p className="mt-1 truncate text-sm text-white/85 xl:text-lg">
                                with 3D Wayfinding and Real-Time Announcement
                                System
                            </p>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-gold-400/50 bg-brand-950/60 px-4 py-2 shadow-lg backdrop-blur">
                        <CalendarDays className="size-8 text-gold-300" />
                        <div
                            className="text-sm leading-tight"
                            suppressHydrationWarning
                        >
                            {now.toLocaleDateString(undefined, {
                                weekday: 'long',
                            })}
                            <br />
                            {now.toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                            })}
                        </div>
                        <span className="h-10 w-px bg-white/25" />
                        <div
                            className="font-display text-3xl font-bold tabular-nums xl:text-4xl"
                            suppressHydrationWarning
                        >
                            {now.toLocaleTimeString(undefined, {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav aria-label="Main" className="overflow-x-auto">
                    <div className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-brand-950/50 p-1 shadow-inner">
                        {navItems.map((item, i) => (
                            <div key={item.title} className="flex items-center">
                                {i > 0 &&
                                    !item.active &&
                                    !navItems[i - 1].active && (
                                        <span className="h-6 w-px bg-white/20" />
                                    )}
                                <Link
                                    href={item.href}
                                    aria-current={
                                        item.active ? 'page' : undefined
                                    }
                                    className={cn(
                                        'flex shrink-0 items-center gap-2 rounded-full px-5 py-2 text-base font-semibold whitespace-nowrap transition-colors xl:text-lg',
                                        item.active
                                            ? 'bg-gradient-to-b from-gold-300 to-gold-500 text-brand-950 shadow-md'
                                            : 'text-white hover:bg-white/10',
                                    )}
                                >
                                    <item.icon className="size-5 xl:size-6" />
                                    {item.title}
                                </Link>
                            </div>
                        ))}
                    </div>
                </nav>
            </div>
            <div className="h-1 bg-gradient-to-r from-gold-600 via-gold-300 to-gold-600" />
        </header>
    );
}
