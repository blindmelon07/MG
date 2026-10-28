import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import MediaGallery from '@/components/media-gallery';
import { Badge } from '@/components/ui/badge';
import { index as manualsIndex, show } from '@/routes/manuals';

type Media = {
    id: number;
    type: 'image' | 'video';
    caption: string | null;
    url: string;
};

type Manual = {
    id: number;
    title: string;
    content: string;
    published_at: string | null;
    category: { id: number; name: string; slug: string };
    media: Media[];
};

type Neighbor = { title: string; slug: string } | null;

export default function KioskManualsShow({
    manual,
    previous,
    next,
}: {
    manual: Manual;
    previous: Neighbor;
    next: Neighbor;
}) {
    return (
        <>
            <Head title={manual.title} />

            <div className="mx-auto flex max-w-3xl flex-col gap-6">
                <Link
                    href={manualsIndex({
                        query: { category: manual.category.slug },
                    })}
                    className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="size-4" /> Back to School Manual
                </Link>

                <div>
                    <Badge variant="secondary">{manual.category.name}</Badge>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                        {manual.title}
                    </h1>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 p-6 whitespace-pre-wrap dark:border-sidebar-border">
                    {manual.content}
                </div>

                <MediaGallery media={manual.media} />

                {(previous || next) && (
                    <nav
                        aria-label="Manual pages"
                        className="grid gap-3 sm:grid-cols-2"
                    >
                        {previous ? (
                            <Link
                                href={show(previous.slug)}
                                className="flex items-center gap-3 rounded-xl border border-sidebar-border/70 p-4 hover:bg-muted/50 dark:border-sidebar-border"
                            >
                                <ChevronLeft className="size-5 shrink-0 text-muted-foreground" />
                                <span className="min-w-0">
                                    <span className="block text-xs text-muted-foreground">
                                        Previous
                                    </span>
                                    <span className="block truncate font-medium">
                                        {previous.title}
                                    </span>
                                </span>
                            </Link>
                        ) : (
                            <span className="hidden sm:block" />
                        )}
                        {next && (
                            <Link
                                href={show(next.slug)}
                                className="flex items-center justify-end gap-3 rounded-xl border border-sidebar-border/70 p-4 text-right hover:bg-muted/50 dark:border-sidebar-border"
                            >
                                <span className="min-w-0">
                                    <span className="block text-xs text-muted-foreground">
                                        Next
                                    </span>
                                    <span className="block truncate font-medium">
                                        {next.title}
                                    </span>
                                </span>
                                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                            </Link>
                        )}
                    </nav>
                )}
            </div>
        </>
    );
}
