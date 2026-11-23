import { Link } from '@inertiajs/react';
import { CalendarDays, Megaphone } from 'lucide-react';
import { show as announcementShow } from '@/routes/announcements';

export type MarqueeItem = {
    id: number;
    title: string;
    slug: string;
    type: 'announcement' | 'event';
    event_start_at: string | null;
    location: string | null;
};

const whenOf = (value: string) =>
    new Date(value).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });

/**
 * The scrolling strip of the latest events and announcements on the kiosk
 * home screen. The list is drawn twice so the loop never shows a gap; tap an
 * item to read it.
 */
export function KioskMarquee({ items }: { items: MarqueeItem[] }) {
    if (items.length === 0) {
        return null;
    }

    // Slow enough to read on a kiosk: about 6 s per item, never under 30 s.
    const duration = Math.max(30, items.length * 6);

    return (
        <div className="flex items-stretch overflow-hidden rounded-xl border-2 border-gold-400 bg-brand-950/80 shadow-lg">
            <span className="flex shrink-0 items-center gap-2 bg-gradient-to-r from-gold-300 to-gold-500 px-4 py-2 text-sm font-bold tracking-wide text-brand-950 uppercase">
                <Megaphone className="size-5" />
                Latest
            </span>
            <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_2rem,black_calc(100%-2rem),transparent)]">
                <div
                    className="kiosk-ticker flex h-full w-max items-center"
                    style={{ animationDuration: `${duration}s` }}
                >
                    {[0, 1].map((copy) => (
                        <ul
                            key={copy}
                            aria-hidden={copy === 1 || undefined}
                            className="flex items-center"
                        >
                            {items.map((item) => (
                                <li key={item.id} className="flex items-center">
                                    <Link
                                        href={announcementShow(item.slug)}
                                        tabIndex={copy === 1 ? -1 : undefined}
                                        className="flex items-center gap-2 px-6 py-2 text-base whitespace-nowrap text-white"
                                    >
                                        {item.type === 'event' ? (
                                            <CalendarDays className="size-5 shrink-0 text-gold-400" />
                                        ) : (
                                            <Megaphone className="size-5 shrink-0 text-gold-400" />
                                        )}
                                        <span className="font-bold">
                                            {item.title}
                                        </span>
                                        {item.type === 'event' &&
                                            item.event_start_at && (
                                                <span className="text-white/75">
                                                    ·{' '}
                                                    {whenOf(
                                                        item.event_start_at,
                                                    )}
                                                    {item.location &&
                                                        ` · ${item.location}`}
                                                </span>
                                            )}
                                    </Link>
                                    <span
                                        aria-hidden
                                        className="size-1.5 rounded-full bg-gold-400"
                                    />
                                </li>
                            ))}
                        </ul>
                    ))}
                </div>
            </div>
        </div>
    );
}
