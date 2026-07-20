import { Head, Link } from '@inertiajs/react';
import { Bot, BookOpen, Megaphone, Tags } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { dashboard } from '@/routes';
import { index as announcementsIndex } from '@/routes/admin/announcements';
import { index as manualCategoriesIndex } from '@/routes/admin/manual-categories';
import { index as manualsIndex } from '@/routes/admin/manuals';

type Stats = {
    manuals: { total: number; published: number; draft: number };
    categories: { total: number };
    announcements: {
        total: number;
        published: number;
        upcomingEvents: number;
    };
    chatbot: { total: number; helpful: number; notHelpful: number };
};

type RecentAnnouncement = {
    id: number;
    title: string;
    type: 'announcement' | 'event';
    status: 'draft' | 'published';
    created_at: string;
    creator: { id: number; name: string };
};

export default function Dashboard({
    stats,
    recentAnnouncements,
}: {
    stats: Stats;
    recentAnnouncements: RecentAnnouncement[];
}) {
    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="grid auto-rows-min gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Link href={manualsIndex()}>
                        <Card className="h-full transition-colors hover:border-primary">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    Manuals
                                </CardTitle>
                                <BookOpen className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {stats.manuals.total}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {stats.manuals.published} published ·{' '}
                                    {stats.manuals.draft} draft
                                </p>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link href={manualCategoriesIndex()}>
                        <Card className="h-full transition-colors hover:border-primary">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    Manual Categories
                                </CardTitle>
                                <Tags className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {stats.categories.total}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Organizing the school manual
                                </p>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link href={announcementsIndex()}>
                        <Card className="h-full transition-colors hover:border-primary">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    Announcements & Events
                                </CardTitle>
                                <Megaphone className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {stats.announcements.total}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {stats.announcements.published} published
                                    · {stats.announcements.upcomingEvents}{' '}
                                    upcoming events
                                </p>
                            </CardContent>
                        </Card>
                    </Link>

                    <Card className="h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Chatbot Conversations
                            </CardTitle>
                            <Bot className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {stats.chatbot.total}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {stats.chatbot.helpful} helpful ·{' '}
                                {stats.chatbot.notHelpful} not helpful
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <Card className="flex-1">
                    <CardHeader>
                        <CardTitle>Recent Announcements</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {recentAnnouncements.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No announcements yet.
                            </p>
                        ) : (
                            <ul className="divide-y divide-sidebar-border/70 dark:divide-sidebar-border">
                                {recentAnnouncements.map((announcement) => (
                                    <li
                                        key={announcement.id}
                                        className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                                    >
                                        <div>
                                            <div className="font-medium">
                                                {announcement.title}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {announcement.creator.name}{' '}
                                                ·{' '}
                                                {new Date(
                                                    announcement.created_at,
                                                ).toLocaleDateString(
                                                    undefined,
                                                    {
                                                        dateStyle: 'medium',
                                                    },
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant={
                                                    announcement.type ===
                                                    'event'
                                                        ? 'default'
                                                        : 'outline'
                                                }
                                            >
                                                {announcement.type}
                                            </Badge>
                                            <Badge
                                                variant={
                                                    announcement.status ===
                                                    'published'
                                                        ? 'default'
                                                        : 'secondary'
                                                }
                                            >
                                                {announcement.status}
                                            </Badge>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
