import { Form, Head } from '@inertiajs/react';
import { useState } from 'react';
import AnnouncementController from '@/actions/App/Http/Controllers/Admin/AnnouncementController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    edit,
    index as announcementsIndex,
} from '@/routes/admin/announcements';

type Announcement = {
    id: number;
    title: string;
    content: string;
    type: 'announcement' | 'event';
    status: 'draft' | 'published';
    event_start_at: string | null;
    event_end_at: string | null;
    location: string | null;
};

function toDatetimeLocal(value: string | null): string {
    if (!value) {
        return '';
    }

    return value.slice(0, 16);
}

export default function AnnouncementsEdit({
    announcement,
}: {
    announcement: Announcement;
}) {
    const [type, setType] = useState<'announcement' | 'event'>(
        announcement.type,
    );

    return (
        <>
            <Head title={`Edit ${announcement.title}`} />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <Heading
                    title="Edit Announcement"
                    description="Update this announcement or event."
                />

                <Form
                    {...AnnouncementController.update.form(announcement.id)}
                    className="max-w-2xl space-y-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="title">Title</Label>
                                <Input
                                    id="title"
                                    name="title"
                                    required
                                    defaultValue={announcement.title}
                                />
                                <InputError message={errors.title} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="type">Type</Label>
                                <Select
                                    name="type"
                                    defaultValue={announcement.type}
                                    onValueChange={(value) =>
                                        setType(
                                            value as 'announcement' | 'event',
                                        )
                                    }
                                >
                                    <SelectTrigger id="type" className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="announcement">
                                            Announcement
                                        </SelectItem>
                                        <SelectItem value="event">
                                            Event
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.type} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="content">Content</Label>
                                <Textarea
                                    id="content"
                                    name="content"
                                    required
                                    className="min-h-40"
                                    defaultValue={announcement.content}
                                />
                                <InputError message={errors.content} />
                            </div>

                            {type === 'event' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="event_start_at">
                                                Starts at
                                            </Label>
                                            <Input
                                                id="event_start_at"
                                                name="event_start_at"
                                                type="datetime-local"
                                                required
                                                defaultValue={toDatetimeLocal(
                                                    announcement.event_start_at,
                                                )}
                                            />
                                            <InputError
                                                message={errors.event_start_at}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="event_end_at">
                                                Ends at
                                            </Label>
                                            <Input
                                                id="event_end_at"
                                                name="event_end_at"
                                                type="datetime-local"
                                                defaultValue={toDatetimeLocal(
                                                    announcement.event_end_at,
                                                )}
                                            />
                                            <InputError
                                                message={errors.event_end_at}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="location">
                                            Location
                                        </Label>
                                        <Input
                                            id="location"
                                            name="location"
                                            defaultValue={
                                                announcement.location ?? ''
                                            }
                                        />
                                        <InputError message={errors.location} />
                                    </div>
                                </>
                            )}

                            <div className="grid gap-2">
                                <Label htmlFor="status">Status</Label>
                                <Select
                                    name="status"
                                    defaultValue={announcement.status}
                                >
                                    <SelectTrigger
                                        id="status"
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="draft">
                                            Draft
                                        </SelectItem>
                                        <SelectItem value="published">
                                            Published
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.status} />
                            </div>

                            <div className="flex items-center gap-4">
                                <Button type="submit" disabled={processing}>
                                    Save Changes
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}

AnnouncementsEdit.layout = (page: { announcement: Announcement }) => ({
    breadcrumbs: [
        { title: 'Announcements', href: announcementsIndex() },
        { title: 'Edit', href: edit(page.announcement.id) },
    ],
});
