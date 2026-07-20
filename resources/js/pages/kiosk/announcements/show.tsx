import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, CalendarDays, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { index as announcementsIndex } from '@/routes/announcements';

type Announcement = {
    id: number;
    title: string;
    content: string;
    type: 'announcement' | 'event';
    event_start_at: string | null;
    event_end_at: string | null;
    location: string | null;
};

function formatDateTime(value: string): string {
    return new Date(value).toLocaleString(undefined, {
        dateStyle: 'full',
        timeStyle: 'short',
    });
}

export default function KioskAnnouncementsShow({
    announcement,
}: {
    announcement: Announcement;
}) {
    return (
        <>
            <Head title={announcement.title} />

            <div className="mx-auto flex max-w-3xl flex-col gap-6">
                <Link
                    href={announcementsIndex()}
                    className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="size-4" /> Back to Announcements
                </Link>

                <div>
                    <Badge
                        variant={
                            announcement.type === 'event'
                                ? 'default'
                                : 'outline'
                        }
                    >
                        {announcement.type}
                    </Badge>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                        {announcement.title}
                    </h1>
                </div>

                {announcement.type === 'event' &&
                    announcement.event_start_at && (
                        <div className="flex flex-col gap-2 rounded-xl border border-sidebar-border/70 p-4 text-sm dark:border-sidebar-border">
                            <div className="flex items-center gap-2">
                                <CalendarDays className="size-4 text-primary" />
                                <span>
                                    {formatDateTime(
                                        announcement.event_start_at,
                                    )}
                                    {announcement.event_end_at &&
                                        ` – ${formatDateTime(announcement.event_end_at)}`}
                                </span>
                            </div>
                            {announcement.location && (
                                <div className="flex items-center gap-2">
                                    <MapPin className="size-4 text-primary" />
                                    <span>{announcement.location}</span>
                                </div>
                            )}
                        </div>
                    )}

                <div className="rounded-xl border border-sidebar-border/70 p-6 whitespace-pre-wrap dark:border-sidebar-border">
                    {announcement.content}
                </div>
            </div>
        </>
    );
}
