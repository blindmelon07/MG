import { Form, Head } from '@inertiajs/react';
import { useState } from 'react';
import AnnouncementController from '@/actions/App/Http/Controllers/Admin/AnnouncementController';
import AnnouncementMediaController from '@/actions/App/Http/Controllers/Admin/AnnouncementMediaController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import MediaManager from '@/components/media-manager';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { cn } from '@/lib/utils';
import {
    edit,
    index as announcementsIndex,
} from '@/routes/admin/announcements';

type Media = {
    id: number;
    type: 'image' | 'video';
    path: string;
    caption: string | null;
    url: string;
};

type StudentOption = {
    id: number;
    name: string;
    grade_level: string | null;
    section: string | null;
};

type Announcement = {
    id: number;
    title: string;
    content: string;
    type: 'announcement' | 'event';
    status: 'draft' | 'published';
    audience: 'all' | 'targeted';
    event_start_at: string | null;
    event_end_at: string | null;
    location: string | null;
    media: Media[];
    students: { id: number }[];
};

function toDatetimeLocal(value: string | null): string {
    if (!value) {
        return '';
    }

    return value.slice(0, 16);
}

export default function AnnouncementsEdit({
    announcement,
    students,
}: {
    announcement: Announcement;
    students: StudentOption[];
}) {
    const [type, setType] = useState<'announcement' | 'event'>(
        announcement.type,
    );
    const [audience, setAudience] = useState<'all' | 'targeted'>(
        announcement.audience,
    );
    const [studentSearch, setStudentSearch] = useState('');
    const selectedStudentIds = announcement.students.map((s) => s.id);

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

                            <div className="grid gap-2">
                                <Label htmlFor="audience">Audience</Label>
                                <Select
                                    name="audience"
                                    defaultValue={announcement.audience}
                                    onValueChange={(value) =>
                                        setAudience(
                                            value as 'all' | 'targeted',
                                        )
                                    }
                                >
                                    <SelectTrigger
                                        id="audience"
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            All students &amp; parents
                                        </SelectItem>
                                        <SelectItem value="targeted">
                                            Specific students
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.audience} />
                                <p className="text-sm text-muted-foreground">
                                    Publishing texts an SMS to the selected
                                    students and their guardians (only on the
                                    first publish).
                                </p>
                            </div>

                            <label className="flex items-center gap-2">
                                <Checkbox
                                    id="skip_sms"
                                    name="skip_sms"
                                    value="1"
                                />
                                <span className="text-sm">
                                    Don&apos;t send SMS to students/guardians
                                </span>
                            </label>

                            {audience === 'targeted' && (
                                <div className="grid gap-2">
                                    <Label>Students</Label>
                                    <Input
                                        placeholder="Search by name, grade, or section"
                                        value={studentSearch}
                                        onChange={(e) =>
                                            setStudentSearch(e.target.value)
                                        }
                                    />
                                    <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-sidebar-border/70 p-2 dark:border-sidebar-border">
                                        {students.length === 0 && (
                                            <p className="p-2 text-sm text-muted-foreground">
                                                No active students yet.
                                            </p>
                                        )}
                                        {students.map((student) => {
                                            const label = [
                                                student.name,
                                                student.grade_level,
                                                student.section,
                                            ]
                                                .filter(Boolean)
                                                .join(' ')
                                                .toLowerCase();
                                            const visible =
                                                label.includes(
                                                    studentSearch.toLowerCase(),
                                                );

                                            return (
                                                <label
                                                    key={student.id}
                                                    className={cn(
                                                        'flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50',
                                                        !visible && 'hidden',
                                                    )}
                                                >
                                                    <Checkbox
                                                        name="student_ids[]"
                                                        value={String(
                                                            student.id,
                                                        )}
                                                        defaultChecked={selectedStudentIds.includes(
                                                            student.id,
                                                        )}
                                                    />
                                                    <span className="text-sm">
                                                        {student.name}
                                                        {(student.grade_level ||
                                                            student.section) && (
                                                            <span className="text-muted-foreground">
                                                                {' '}
                                                                —{' '}
                                                                {[
                                                                    student.grade_level,
                                                                    student.section,
                                                                ]
                                                                    .filter(
                                                                        Boolean,
                                                                    )
                                                                    .join(' ')}
                                                            </span>
                                                        )}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    <InputError message={errors.student_ids} />
                                </div>
                            )}

                            <div className="flex items-center gap-4">
                                <Button type="submit" disabled={processing}>
                                    Save Changes
                                </Button>
                            </div>
                        </>
                    )}
                </Form>

                <div className="max-w-2xl space-y-3">
                    <Heading variant="small" title="Media" />
                    <MediaManager
                        media={announcement.media}
                        uploadForm={AnnouncementMediaController.store.form(
                            announcement.id,
                        )}
                        deleteForm={(mediaId) =>
                            AnnouncementMediaController.destroy.form([
                                announcement.id,
                                mediaId,
                            ])
                        }
                    />
                </div>
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
