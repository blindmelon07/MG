import { Form } from '@inertiajs/react';
import { Trash2, Upload } from 'lucide-react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RouteFormDefinition } from '@/wayfinder';

type Media = {
    id: number;
    type: 'image' | 'video';
    path: string;
    caption: string | null;
    url: string;
};

export default function MediaManager({
    media,
    uploadForm,
    deleteForm,
}: {
    media: Media[];
    uploadForm: RouteFormDefinition<'post'>;
    deleteForm: (mediaId: number) => RouteFormDefinition<'post'>;
}) {
    return (
        <div className="space-y-4">
            {media.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                    {media.map((item) => (
                        <div
                            key={item.id}
                            className="overflow-hidden rounded-lg border border-sidebar-border/70 dark:border-sidebar-border"
                        >
                            {item.type === 'image' ? (
                                <img
                                    src={item.url}
                                    alt={item.caption ?? ''}
                                    className="aspect-video w-full object-cover"
                                />
                            ) : (
                                <video
                                    src={item.url}
                                    controls
                                    className="aspect-video w-full object-cover"
                                />
                            )}
                            <div className="flex items-center justify-between gap-2 p-2">
                                <span className="truncate text-xs text-muted-foreground">
                                    {item.caption || '—'}
                                </span>
                                <Form
                                    {...deleteForm(item.id)}
                                    className="shrink-0"
                                >
                                    {({ processing }) => (
                                        <Button
                                            type="submit"
                                            variant="ghost"
                                            size="icon"
                                            disabled={processing}
                                            onClick={(e) => {
                                                if (
                                                    !confirm(
                                                        'Remove this media file?',
                                                    )
                                                ) {
                                                    e.preventDefault();
                                                }
                                            }}
                                        >
                                            <Trash2 />
                                            <span className="sr-only">
                                                Remove
                                            </span>
                                        </Button>
                                    )}
                                </Form>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Form
                {...uploadForm}
                resetOnSuccess
                className="flex flex-wrap items-end gap-3"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-2">
                            <Label htmlFor="file">Image or video</Label>
                            <Input
                                id="file"
                                name="file"
                                type="file"
                                accept="image/*,video/*"
                                required
                            />
                            <InputError message={errors.file} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="caption">Caption</Label>
                            <Input
                                id="caption"
                                name="caption"
                                placeholder="Optional"
                            />
                            <InputError message={errors.caption} />
                        </div>

                        <Button type="submit" disabled={processing}>
                            <Upload /> Upload
                        </Button>
                    </>
                )}
            </Form>
        </div>
    );
}
