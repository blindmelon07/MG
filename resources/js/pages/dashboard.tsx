import { Head, Link, router } from '@inertiajs/react';
import { Bot, BookOpen, Megaphone, Tags, Users } from 'lucide-react';
import { useEffect } from 'react';
import { CampusMap } from '@/components/campus-map';
import type { CampusMapPerson } from '@/components/campus-map';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

type ActiveUser = CampusMapPerson & { last_seen_at: string };

// How often the live map asks the server who's on campus.
const ACTIVE_USERS_POLL_MS = 15_000;

const KIND_LABELS: Record<CampusMapPerson['kind'], string> = {
    student: 'Students',
    personnel: 'Personnel',
    visitor: 'Visitors',
};

const KIND_DOTS: Record<CampusMapPerson['kind'], string> = {
    student: 'bg-emerald-500',
    personnel: 'bg-violet-500',
    visitor: 'bg-amber-500',
};

function ActiveUsersMap({ users }: { users: ActiveUser[] }) {
    useEffect(() => {
        const timer = window.setInterval(() => {
            router.reload({ only: ['activeUsers'] });
        }, ACTIVE_USERS_POLL_MS);

        return () => window.clearInterval(timer);
    }, []);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                    <CardTitle>Live Campus Map</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Phones sharing their location on the kiosk campus map.
                        Updates every 15 seconds.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-2xl font-bold">
                    <Users className="size-5 text-muted-foreground" />
                    {users.length}
                    <span className="text-sm font-normal text-muted-foreground">
                        active
                    </span>
                </div>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-3">
                <CampusMap
                    className="lg:col-span-2"
                    points={[]}
                    people={users}
                />
                <div className="flex flex-col gap-3 text-sm">
                    <div className="flex flex-wrap gap-3">
                        {(
                            Object.keys(
                                KIND_LABELS,
                            ) as CampusMapPerson['kind'][]
                        ).map((kind) => (
                            <span
                                key={kind}
                                className="flex items-center gap-1.5 text-muted-foreground"
                            >
                                <span
                                    className={`size-2.5 rounded-full ${KIND_DOTS[kind]}`}
                                />
                                {KIND_LABELS[kind]} (
                                {users.filter((u) => u.kind === kind).length})
                            </span>
                        ))}
                    </div>
                    {users.length === 0 ? (
                        <p className="text-muted-foreground">
                            No one is sharing their location right now.
                        </p>
                    ) : (
                        <ul className="max-h-80 divide-y divide-sidebar-border/70 overflow-y-auto dark:divide-sidebar-border">
                            {users.map((user) => (
                                <li
                                    key={user.id}
                                    className="flex items-center justify-between gap-2 py-2"
                                >
                                    <span className="flex items-center gap-2 font-medium">
                                        <span
                                            className={`size-2.5 rounded-full ${KIND_DOTS[user.kind]}`}
                                        />
                                        {user.label}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(
                                            user.last_seen_at,
                                        ).toLocaleTimeString(undefined, {
                                            timeStyle: 'short',
                                        })}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

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
    activeUsers,
}: {
    stats: Stats;
    recentAnnouncements: RecentAnnouncement[];
    activeUsers: ActiveUser[];
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
                                    {stats.announcements.published} published ·{' '}
                                    {stats.announcements.upcomingEvents}{' '}
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

                <ActiveUsersMap users={activeUsers} />

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
                                                {announcement.creator.name} ·{' '}
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
