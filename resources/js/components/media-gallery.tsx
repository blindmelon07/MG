type Media = {
    id: number;
    type: 'image' | 'video';
    caption: string | null;
    url: string;
};

export default function MediaGallery({ media }: { media: Media[] }) {
    if (media.length === 0) {
        return null;
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            {media.map((item) => (
                <figure
                    key={item.id}
                    className="overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border"
                >
                    {item.type === 'image' ? (
                        <a href={item.url} target="_blank" rel="noreferrer">
                            <img
                                src={item.url}
                                alt={item.caption ?? ''}
                                className="aspect-video w-full object-cover"
                            />
                        </a>
                    ) : (
                        <video
                            src={item.url}
                            controls
                            className="aspect-video w-full object-cover"
                        />
                    )}
                    {item.caption && (
                        <figcaption className="p-2 text-sm text-muted-foreground">
                            {item.caption}
                        </figcaption>
                    )}
                </figure>
            ))}
        </div>
    );
}
