import { Head, Link } from '@inertiajs/react';
import {
    Building2,
    Clock,
    DoorOpen,
    Mail,
    MapPin,
    Navigation,
    Phone,
    PhoneCall,
    Search,
} from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { home } from '@/routes';

type Entry = {
    id: number;
    category: 'office' | 'hotline';
    name: string;
    description: string | null;
    phone: string | null;
    email: string | null;
    office_hours: string | null;
    room: string | null;
    campus_location_id: number | null;
    campus_location: { id: number; name: string } | null;
};

type Building = { id: number; name: string; description: string | null };

const TABS = [
    { value: 'office', label: 'Offices', icon: DoorOpen },
    { value: 'hotline', label: 'Hotlines', icon: PhoneCall },
    { value: 'building', label: 'Major Buildings', icon: Building2 },
] as const;

type Tab = (typeof TABS)[number]['value'];

/**
 * The home screen map draws the walk from the kiosk (and sends phones on to
 * GPS navigation).
 */
function directionsHref(target: { office: number } | { location: number }) {
    return home({ query: target });
}

export default function KioskDirectory({
    entries,
    buildings,
}: {
    entries: Entry[];
    buildings: Building[];
}) {
    const [tab, setTab] = useState<Tab>('office');
    const [query, setQuery] = useState('');

    const q = query.trim().toLowerCase();
    const matches = (...fields: (string | null | undefined)[]) =>
        q === '' || fields.some((f) => f?.toLowerCase().includes(q));

    const offices = entries.filter(
        (e) =>
            e.category === 'office' &&
            matches(e.name, e.description, e.room, e.campus_location?.name),
    );
    const hotlines = entries.filter(
        (e) =>
            e.category === 'hotline' && matches(e.name, e.description, e.phone),
    );
    const shownBuildings = buildings.filter((b) =>
        matches(b.name, b.description),
    );
    const counts: Record<Tab, number> = {
        office: offices.length,
        hotline: hotlines.length,
        building: shownBuildings.length,
    };

    return (
        <>
            <Head title="School Directory" />

            <div className="flex flex-col gap-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                        School Directory
                    </h1>
                    <p className="mt-1 text-muted-foreground md:text-lg">
                        Find an office, call a hotline, or see what&apos;s in
                        each building.
                    </p>
                </div>

                <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search, e.g. Registrar, Clinic, Library"
                        className="h-12 pl-10 text-base"
                    />
                </div>

                <div
                    role="tablist"
                    className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
                >
                    {TABS.map((t) => (
                        <button
                            key={t.value}
                            type="button"
                            role="tab"
                            aria-selected={tab === t.value}
                            onClick={() => setTab(t.value)}
                            className={cn(
                                'flex items-center justify-center gap-2 rounded-lg px-2 py-3 text-sm font-semibold transition-colors md:text-base',
                                tab === t.value
                                    ? 'bg-background shadow-sm'
                                    : 'text-muted-foreground',
                            )}
                        >
                            <t.icon className="hidden size-5 sm:block" />
                            {t.label}
                            <span className="text-muted-foreground">
                                {counts[t.value]}
                            </span>
                        </button>
                    ))}
                </div>

                {tab === 'office' && (
                    <div className="grid gap-3 md:grid-cols-2">
                        {offices.map((office) => (
                            <div
                                key={office.id}
                                className="flex flex-col gap-2 rounded-2xl border border-sidebar-border/70 bg-card p-4 dark:border-sidebar-border"
                            >
                                <div className="flex items-start gap-3">
                                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        <DoorOpen className="size-5" />
                                    </span>
                                    <div className="min-w-0">
                                        <h2 className="text-lg leading-tight font-bold">
                                            {office.name}
                                        </h2>
                                        {office.campus_location && (
                                            <p className="flex items-center gap-1 text-sm font-medium text-primary">
                                                <MapPin className="size-3.5" />
                                                {office.campus_location.name}
                                                {office.room &&
                                                    ` · ${office.room}`}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {office.description && (
                                    <p className="text-sm text-muted-foreground">
                                        {office.description}
                                    </p>
                                )}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                    {office.office_hours && (
                                        <span className="flex items-center gap-1.5">
                                            <Clock className="size-4 text-muted-foreground" />
                                            {office.office_hours}
                                        </span>
                                    )}
                                    {office.phone && (
                                        <a
                                            href={`tel:${office.phone}`}
                                            className="flex items-center gap-1.5 tabular-nums"
                                        >
                                            <Phone className="size-4 text-muted-foreground" />
                                            {office.phone}
                                        </a>
                                    )}
                                    {office.email && (
                                        <a
                                            href={`mailto:${office.email}`}
                                            className="flex items-center gap-1.5"
                                        >
                                            <Mail className="size-4 text-muted-foreground" />
                                            {office.email}
                                        </a>
                                    )}
                                </div>
                                {office.campus_location_id && (
                                    <Link
                                        href={directionsHref({
                                            office: office.id,
                                        })}
                                        className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
                                    >
                                        <Navigation className="size-5" />
                                        Show me the way
                                    </Link>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'hotline' && (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {hotlines.map((hotline) => (
                            <a
                                key={hotline.id}
                                href={`tel:${hotline.phone}`}
                                className="flex items-center gap-3 rounded-2xl border border-sidebar-border/70 bg-card p-4 transition-colors hover:border-primary dark:border-sidebar-border"
                            >
                                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                                    <PhoneCall className="size-6" />
                                </span>
                                <span className="min-w-0">
                                    <span className="block font-semibold">
                                        {hotline.name}
                                    </span>
                                    <span className="block text-xl font-bold tracking-tight tabular-nums">
                                        {hotline.phone}
                                    </span>
                                    {hotline.description && (
                                        <span className="block text-sm text-muted-foreground">
                                            {hotline.description}
                                        </span>
                                    )}
                                </span>
                            </a>
                        ))}
                    </div>
                )}

                {tab === 'building' && (
                    <div className="grid gap-3 md:grid-cols-2">
                        {shownBuildings.map((building) => {
                            const inside = entries.filter(
                                (e) => e.campus_location_id === building.id,
                            );

                            return (
                                <div
                                    key={building.id}
                                    className="flex flex-col gap-2 rounded-2xl border border-sidebar-border/70 bg-card p-4 dark:border-sidebar-border"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                            <Building2 className="size-5" />
                                        </span>
                                        <h2 className="text-lg font-bold">
                                            {building.name}
                                        </h2>
                                    </div>
                                    {building.description && (
                                        <p className="text-sm text-muted-foreground">
                                            {building.description}
                                        </p>
                                    )}
                                    {inside.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {inside.map((e) => (
                                                <span
                                                    key={e.id}
                                                    className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium"
                                                >
                                                    {e.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <Link
                                        href={directionsHref({
                                            location: building.id,
                                        })}
                                        className="mt-1 flex items-center justify-center gap-2 rounded-xl border-2 border-primary px-4 py-2.5 font-semibold text-primary transition-transform active:scale-[0.98]"
                                    >
                                        <Navigation className="size-5" />
                                        Show me the way
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                )}

                {counts[tab] === 0 && (
                    <p className="py-10 text-center text-muted-foreground">
                        {q ? (
                            <>Nothing matches &ldquo;{query.trim()}&rdquo;.</>
                        ) : (
                            'Nothing has been added here yet.'
                        )}
                    </p>
                )}

                <p className="text-center text-sm text-muted-foreground">
                    Tip: the{' '}
                    <Link href={home()} className="font-semibold underline">
                        home screen map
                    </Link>{' '}
                    draws the walk from this kiosk.
                </p>
            </div>
        </>
    );
}
