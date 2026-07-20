import { Form, Head, Link } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import AnnouncementController from '@/actions/App/Http/Controllers/Admin/AnnouncementController';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    create,
    edit,
    index as announcementsIndex,
} from '@/routes/admin/announcements';
import type { Paginated } from '@/types/pagination';

type Announcement = {
    id: number;
    title: string;
    type: 'announcement' | 'event';
    status: 'draft' | 'published';
    event_start_at: string | null;
    creator: { id: number; name: string };
};

export default function AnnouncementsIndex({
    announcements,
}: {
    announcements: Paginated<Announcement>;
}) {
    const [deleting, setDeleting] = useState<Announcement | null>(null);

    return (
        <>
            <Head title="Announcements" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <div className="flex items-center justify-between">
                    <Heading
                        title="Announcements & Events"
                        description="Manage what's shown on the kiosk announcements board."
                    />

                    <Button asChild>
                        <Link href={create()}>
                            <Plus /> New Announcement
                        </Link>
                    </Button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <table className="w-full text-sm">
                        <thead className="border-b border-sidebar-border/70 bg-muted/50 text-left dark:border-sidebar-border">
                            <tr>
                                <th className="px-4 py-2 font-medium">Title</th>
                                <th className="px-4 py-2 font-medium">Type</th>
                                <th className="px-4 py-2 font-medium">
                                    Status
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    Created by
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {announcements.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-4 py-6 text-center text-muted-foreground"
                                    >
                                        No announcements yet.
                                    </td>
                                </tr>
                            )}
                            {announcements.data.map((announcement) => (
                                <tr
                                    key={announcement.id}
                                    className="border-b border-sidebar-border/70 last:border-0 dark:border-sidebar-border"
                                >
                                    <td className="px-4 py-2 font-medium">
                                        {announcement.title}
                                    </td>
                                    <td className="px-4 py-2 capitalize">
                                        {announcement.type}
                                    </td>
                                    <td className="px-4 py-2">
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
                                    </td>
                                    <td className="px-4 py-2">
                                        {announcement.creator.name}
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                asChild
                                            >
                                                <Link
                                                    href={edit(announcement.id)}
                                                >
                                                    <Pencil />
                                                    <span className="sr-only">
                                                        Edit
                                                    </span>
                                                </Link>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    setDeleting(announcement)
                                                }
                                            >
                                                <Trash2 />
                                                <span className="sr-only">
                                                    Delete
                                                </span>
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {announcements.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {announcements.links.map((link, i) => (
                            <Button
                                key={i}
                                variant={link.active ? 'default' : 'outline'}
                                size="sm"
                                disabled={!link.url}
                                asChild={!!link.url}
                            >
                                {link.url ? (
                                    <Link
                                        href={link.url}
                                        dangerouslySetInnerHTML={{
                                            __html: link.label,
                                        }}
                                    />
                                ) : (
                                    <span
                                        dangerouslySetInnerHTML={{
                                            __html: link.label,
                                        }}
                                    />
                                )}
                            </Button>
                        ))}
                    </div>
                )}
            </div>

            <Dialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete announcement?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        This will permanently delete &quot;{deleting?.title}
                        &quot;.
                    </p>
                    {deleting && (
                        <Form
                            {...AnnouncementController.destroy.form(
                                deleting.id,
                            )}
                            onSuccess={() => setDeleting(null)}
                        >
                            {({ processing }) => (
                                <DialogFooter className="mt-4">
                                    <DialogClose asChild>
                                        <Button variant="secondary">
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                    <Button
                                        type="submit"
                                        variant="destructive"
                                        disabled={processing}
                                    >
                                        Delete
                                    </Button>
                                </DialogFooter>
                            )}
                        </Form>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

AnnouncementsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Announcements',
            href: announcementsIndex(),
        },
    ],
};
