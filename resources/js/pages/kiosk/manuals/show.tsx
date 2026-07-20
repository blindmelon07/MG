import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import MediaGallery from '@/components/media-gallery';
import { Badge } from '@/components/ui/badge';
import { index as manualsIndex } from '@/routes/manuals';

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

export default function KioskManualsShow({ manual }: { manual: Manual }) {
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
            </div>
        </>
    );
}
