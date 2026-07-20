import { Head, Link, router } from '@inertiajs/react';
import { CalendarDays, MapPin, Search } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    index as announcementsIndex,
    show as announcementShow,
} from '@/routes/announcements';

type Announcement = {
    id: number;
    title: string;
    slug: string;
    content: string;
    type: 'announcement' | 'event';
    event_start_at: string | null;
    location: string | null;
    published_at: string | null;
};

const typeTabs: { label: string; value?: 'announcement' | 'event' }[] = [
    { label: 'All' },
    { label: 'Announcements', value: 'announcement' },
    { label: 'Events', value: 'event' },
];

export default function KioskAnnouncementsIndex({
    announcements,
    filters,
}: {
    announcements: Announcement[];
    filters: { type?: string; q?: string };
}) {
    const [query, setQuery] = useState(filters.q ?? '');

    function search(e: React.FormEvent) {
        e.preventDefault();
        router.get(
            announcementsIndex().url,
            { q: query || undefined, type: filters.type },
            { preserveState: true, replace: true },
        );
    }

    return (
        <>
            <Head title="Announcements & Events" />

            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Announcements & Events
                    </h1>
                    <p className="text-muted-foreground">
                        Stay up to date with the latest school news.
                    </p>
                </div>

                <form
                    onSubmit={search}
                    className="flex max-w-lg items-center gap-2"
                >
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search announcements..."
                        aria-label="Search announcements"
                    />
                    <Button type="submit" size="icon" variant="secondary">
                        <Search />
                        <span className="sr-only">Search</span>
                    </Button>
                </form>

                <div className="flex flex-wrap gap-2">
                    {typeTabs.map((tab) => (
                        <Link
                            key={tab.label}
                            href={announcementsIndex({
                                query: {
                                    type: tab.value,
                                    q: filters.q || undefined,
                                },
                            })}
                            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                                (filters.type ?? undefined) === tab.value
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-sidebar-border/70 hover:bg-accent dark:border-sidebar-border'
                            }`}
                        >
                            {tab.label}
                        </Link>
                    ))}
                </div>

                {announcements.length === 0 ? (
                    <p className="text-muted-foreground">
                        No announcements found. Try a different search or
                        filter.
                    </p>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {announcements.map((announcement) => (
                            <Link
                                key={announcement.id}
                                href={announcementShow(announcement.slug)}
                            >
                                <Card className="h-full transition-colors hover:border-primary">
                                    <CardHeader className="flex flex-row items-start justify-between gap-2">
                                        <CardTitle>
                                            {announcement.title}
                                        </CardTitle>
                                        <Badge
                                            variant={
                                                announcement.type === 'event'
                                                    ? 'default'
                                                    : 'outline'
                                            }
                                        >
                                            {announcement.type}
                                        </Badge>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <p className="line-clamp-3 text-sm text-muted-foreground">
                                            {announcement.content}
                                        </p>
                                        {announcement.type === 'event' &&
                                            announcement.event_start_at && (
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <CalendarDays className="size-3.5" />
                                                    {new Date(
                                                        announcement.event_start_at,
                                                    ).toLocaleString(
                                                        undefined,
                                                        {
                                                            dateStyle:
                                                                'medium',
                                                            timeStyle:
                                                                'short',
                                                        },
                                                    )}
                                                </div>
                                            )}
                                        {announcement.location && (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <MapPin className="size-3.5" />
                                                {announcement.location}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
