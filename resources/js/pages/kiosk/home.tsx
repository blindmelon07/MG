import { Head, Link } from '@inertiajs/react';
import { BookOpen, CalendarDays, ChevronRight, Megaphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { index as announcementsIndex, show as announcementShow } from '@/routes/announcements';
import { index as manualsIndex } from '@/routes/manuals';

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

export default function KioskHome({
    categories,
    latestAnnouncements,
}: {
    categories: Category[];
    latestAnnouncements: Announcement[];
}) {
    return (
        <>
            <Head title="Welcome" />

            <div className="flex flex-col gap-10">
                <section className="text-center">
                    <h1 className="text-3xl font-semibold tracking-tight">
                        Welcome to Aemilianum College Inc.
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                        Touch a tile below to browse the school manual or see
                        the latest announcements and events.
                    </p>
                </section>

                <section className="grid gap-6 sm:grid-cols-2">
                    <Link href={manualsIndex()}>
                        <Card className="h-full transition-colors hover:border-primary">
                            <CardHeader>
                                <BookOpen className="size-10 text-primary" />
                                <CardTitle className="text-xl">
                                    School Manual
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-muted-foreground">
                                Browse institutional policies, academic
                                guidelines, and student services.
                            </CardContent>
                        </Card>
                    </Link>

                    <Link href={announcementsIndex()}>
                        <Card className="h-full transition-colors hover:border-primary">
                            <CardHeader>
                                <Megaphone className="size-10 text-primary" />
                                <CardTitle className="text-xl">
                                    Announcements & Events
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-muted-foreground">
                                Stay up to date with the latest school news
                                and upcoming events.
                            </CardContent>
                        </Card>
                    </Link>
                </section>

                {categories.length > 0 && (
                    <section>
                        <h2 className="mb-4 text-lg font-semibold">
                            Browse by category
                        </h2>
                        <div className="flex flex-wrap gap-3">
                            {categories.map((category) => (
                                <Link
                                    key={category.id}
                                    href={manualsIndex({
                                        query: { category: category.slug },
                                    })}
                                    className="rounded-full border border-sidebar-border/70 px-4 py-2 text-sm font-medium transition-colors hover:bg-accent dark:border-sidebar-border"
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
                            <h2 className="text-lg font-semibold">
                                Latest announcements
                            </h2>
                            <Link
                                href={announcementsIndex()}
                                className="flex items-center text-sm font-medium text-primary hover:underline"
                            >
                                View all <ChevronRight className="size-4" />
                            </Link>
                        </div>
                        <div className="grid gap-3">
                            {latestAnnouncements.map((announcement) => (
                                <Link
                                    key={announcement.id}
                                    href={announcementShow(
                                        announcement.slug,
                                    )}
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
                                                <span className="font-medium">
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
