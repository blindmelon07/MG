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
    create,
    index as announcementsIndex,
} from '@/routes/admin/announcements';

export default function AnnouncementsCreate() {
    const [type, setType] = useState<'announcement' | 'event'>('announcement');

    return (
        <>
            <Head title="New Announcement" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <Heading
                    title="New Announcement"
                    description="Publish a new announcement or event to the kiosk."
                />

                <Form
                    {...AnnouncementController.store.form()}
                    className="max-w-2xl space-y-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="title">Title</Label>
                                <Input id="title" name="title" required />
                                <InputError message={errors.title} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="type">Type</Label>
                                <Select
                                    name="type"
                                    defaultValue="announcement"
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
                                        <Input id="location" name="location" />
                                        <InputError message={errors.location} />
                                    </div>
                                </>
                            )}

                            <div className="grid gap-2">
                                <Label htmlFor="status">Status</Label>
                                <Select name="status" defaultValue="draft">
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
                                    Create Announcement
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}

AnnouncementsCreate.layout = {
    breadcrumbs: [
        { title: 'Announcements', href: announcementsIndex() },
        { title: 'New', href: create() },
    ],
};
