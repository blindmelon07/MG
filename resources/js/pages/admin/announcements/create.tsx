import { Form, Head } from '@inertiajs/react';
import { useState } from 'react';
import AnnouncementController from '@/actions/App/Http/Controllers/Admin/AnnouncementController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
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
    create,
    index as announcementsIndex,
} from '@/routes/admin/announcements';

type StudentOption = {
    id: number;
    name: string;
    grade_level: string | null;
    section: string | null;
};

export default function AnnouncementsCreate({
    students,
}: {
    students: StudentOption[];
}) {
    const [type, setType] = useState<'announcement' | 'event'>('announcement');
    const [audience, setAudience] = useState<'all' | 'targeted'>('all');
    const [studentSearch, setStudentSearch] = useState('');

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

                            <div className="grid gap-2">
                                <Label htmlFor="audience">Audience</Label>
                                <Select
                                    name="audience"
                                    defaultValue="all"
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
                                    students and their guardians.
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
