import { Head, Link } from '@inertiajs/react';
import {
    BookOpen,
    CalendarDays,
    ChevronRight,
    GraduationCap,
    MapPin,
    Megaphone,
    Star,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    index as announcementsIndex,
    show as announcementShow,
} from '@/routes/announcements';
import { index as manualsIndex } from '@/routes/manuals';
import { index as mapsIndex } from '@/routes/maps';
import { login as studentLogin } from '@/routes/student';

type Category = {
    id: number;
    name: string;
    slug: string;
    manuals_count: number;
};

type Announcement = {
    id: number;
    title: string;
    slug: string;
    type: 'announcement' | 'event';
    event_start_at: string | null;
};

type FeaturedEvent = {
    id: number;
    title: string;
    slug: string;
    summary: string;
    event_start_at: string;
    event_end_at: string | null;
    location: string | null;
    cover_url: string | null;
};

function formatEventDate(value: string): string {
    return new Date(value).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

export default function KioskHome({
    featuredEvents,
    categories,
    latestAnnouncements,
}: {
    featuredEvents: FeaturedEvent[];
    categories: Category[];
    latestAnnouncements: Announcement[];
}) {
    return (
        <>
            <Head title="Welcome" />

            <div className="flex flex-col gap-10">
                <section className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                        Welcome to Aemilianum College Inc.
                    </h1>
                    <p className="mt-2 text-lg text-muted-foreground">
                        Touch a tile below to browse the school manual, see the
                        latest announcements, or check your grades.
                    </p>
                </section>

                {featuredEvents.length > 0 && (
                    <section>
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="flex items-center gap-2 text-xl font-bold">
                                <Star className="size-5 fill-current text-amber-500" />
                                Featured events
                            </h2>
                            <Link
                                href={announcementsIndex({
                                    query: { type: 'event' },
                                })}
                                className="flex items-center text-base font-semibold text-primary hover:underline"
                            >
                                All events <ChevronRight className="size-4" />
                            </Link>
                        </div>
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {featuredEvents.map((event) => (
                                <Link
                                    key={event.id}
                                    href={announcementShow(event.slug)}
                                    className="group"
                                >
                                    <Card className="h-full gap-0 overflow-hidden py-0 transition-colors group-hover:border-primary">
                                        {event.cover_url ? (
                                            <img
                                                src={event.cover_url}
                                                alt=""
                                                className="aspect-video w-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex aspect-video w-full items-center justify-center bg-primary/10">
                                                <CalendarDays className="size-12 text-primary" />
                                            </div>
                                        )}
                                        <CardContent className="flex flex-col gap-2 py-4">
                                            <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
                                                <CalendarDays className="size-4" />
                                                {formatEventDate(
                                                    event.event_start_at,
                                                )}
                                            </span>
                                            <h3 className="text-xl leading-snug font-bold">
                                                {event.title}
                                            </h3>
                                            {event.location && (
                                                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                    <MapPin className="size-4" />
                                                    {event.location}
                                                </span>
                                            )}
                                            <p className="text-base text-muted-foreground">
                                                {event.summary}
                                            </p>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <Link href={manualsIndex()}>
                        <Card className="h-full border-2 transition-colors hover:border-primary">
                            <CardHeader>
                                <BookOpen className="size-12 text-primary" />
                                <CardTitle className="text-2xl font-bold">
                                    School Manual
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-base text-muted-foreground">
                                Browse institutional policies, academic
                                guidelines, and student services.
                            </CardContent>
                        </Card>
                    </Link>

                    <Link href={announcementsIndex()}>
                        <Card className="h-full border-2 transition-colors hover:border-primary">
                            <CardHeader>
                                <Megaphone className="size-12 text-primary" />
                                <CardTitle className="text-2xl font-bold">
                                    Announcements & Events
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-base text-muted-foreground">
                                Stay up to date with the latest school news and
                                upcoming events.
                            </CardContent>
                        </Card>
                    </Link>

                    <Link href={mapsIndex()}>
                        <Card className="h-full border-2 transition-colors hover:border-primary">
                            <CardHeader>
                                <MapPin className="size-12 text-primary" />
                                <CardTitle className="text-2xl font-bold">
                                    Campus Map
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-base text-muted-foreground">
                                Find your way around the campus and locate key
                                buildings and offices.
                            </CardContent>
                        </Card>
                    </Link>

                    <Link href={studentLogin({ query: { kiosk: 1 } })}>
                        <Card className="h-full border-2 transition-colors hover:border-primary">
                            <CardHeader>
                                <GraduationCap className="size-12 text-primary" />
                                <CardTitle className="text-2xl font-bold">
                                    My Grades
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-base text-muted-foreground">
                                Sign in with your student number to check your
                                grades.
                            </CardContent>
                        </Card>
                    </Link>
                </section>

                {categories.length > 0 && (
                    <section>
                        <h2 className="mb-4 text-xl font-bold">
                            Browse by category
                        </h2>
                        <div className="flex flex-wrap gap-3">
                            {categories.map((category) => (
                                <Link
                                    key={category.id}
                                    href={manualsIndex({
                                        query: { category: category.slug },
                                    })}
                                    className="rounded-full border border-2 border-sidebar-border/70 px-5 py-2.5 text-base font-semibold transition-colors hover:bg-accent dark:border-sidebar-border"
                                >
                                    {category.name}
                                    <span className="ml-2 text-muted-foreground">
                                        {category.manuals_count}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {latestAnnouncements.length > 0 && (
                    <section>
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold">
                                Latest announcements
                            </h2>
                            <Link
                                href={announcementsIndex()}
                                className="flex items-center text-base font-semibold text-primary hover:underline"
                            >
                                View all <ChevronRight className="size-4" />
                            </Link>
                        </div>
                        <div className="grid gap-3">
                            {latestAnnouncements.map((announcement) => (
                                <Link
                                    key={announcement.id}
                                    href={announcementShow(announcement.slug)}
                                >
                                    <Card className="transition-colors hover:border-primary">
                                        <CardContent className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                {announcement.type ===
                                                'event' ? (
                                                    <CalendarDays className="size-5 text-primary" />
                                                ) : (
                                                    <Megaphone className="size-5 text-primary" />
                                                )}
                                                <span className="text-lg font-semibold">
                                                    {announcement.title}
                                                </span>
                                            </div>
                                            <Badge variant="outline">
                                                {announcement.type}
                                            </Badge>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </>
    );
}
