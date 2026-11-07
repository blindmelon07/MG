import { Form, Head } from '@inertiajs/react';
import { MessageSquareWarning, Send, Users } from 'lucide-react';
import { useState } from 'react';
import SuspensionNoticeController from '@/actions/App/Http/Controllers/Admin/SuspensionNoticeController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { mine } from '@/routes/admin/advisories';

type Notice = {
    id: number;
    starts_on: string;
    ends_on: string | null;
    reason: string;
    message: string;
    recipient_count: number;
    created_at: string;
};

type Advisory = {
    id: number;
    education_level: string;
    education_level_label: string | null;
    grade_level: string;
    section: string;
    school_year: string;
    is_current: boolean;
    student_count: number;
    recipient_count: number;
    notices: Notice[];
};

const formatDay = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

function SuspensionForm({
    advisory,
    today,
}: {
    advisory: Advisory;
    today: string;
}) {
    const [confirming, setConfirming] = useState(false);
    // The confirm dialog renders outside the form, so its button submits by id.
    const formId = `suspension-notice-${advisory.id}`;

    return (
        <Form
            {...SuspensionNoticeController.store.form(advisory.id)}
            resetOnSuccess
            onSuccess={() => setConfirming(false)}
            onError={() => setConfirming(false)}
            className="space-y-4"
            id={formId}
        >
            {({ processing, errors }) => (
                <>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor={`starts_on_${advisory.id}`}>
                                No classes on
                            </Label>
                            <Input
                                id={`starts_on_${advisory.id}`}
                                name="starts_on"
                                type="date"
                                min={today}
                                defaultValue={today}
                                required
                            />
                            <InputError message={errors.starts_on} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor={`ends_on_${advisory.id}`}>
                                Until (optional)
                            </Label>
                            <Input
                                id={`ends_on_${advisory.id}`}
                                name="ends_on"
                                type="date"
                                min={today}
                            />
                            <InputError message={errors.ends_on} />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor={`reason_${advisory.id}`}>Reason</Label>
                        <Textarea
                            id={`reason_${advisory.id}`}
                            name="reason"
                            required
                            maxLength={160}
                            rows={2}
                            placeholder="e.g. Typhoon signal no. 2 declared by the LGU."
                        />
                        <InputError message={errors.reason} />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                            Texted to {advisory.recipient_count} student and
                            guardian number
                            {advisory.recipient_count === 1 ? '' : 's'} in this
                            section.
                        </p>
                        <Button
                            type="button"
                            disabled={processing}
                            onClick={() => {
                                const form = document.getElementById(
                                    formId,
                                ) as HTMLFormElement | null;

                                if (form?.reportValidity() ?? true) {
                                    setConfirming(true);
                                }
                            }}
                        >
                            <Send /> Send suspension notice
                        </Button>
                    </div>

                    <Dialog open={confirming} onOpenChange={setConfirming}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>
                                    Send this suspension notice?
                                </DialogTitle>
                                <DialogDescription>
                                    {advisory.grade_level} – {advisory.section}
                                    &apos;s {advisory.recipient_count} student
                                    and guardian number
                                    {advisory.recipient_count === 1
                                        ? ''
                                        : 's'}{' '}
                                    will get a text right away. This can&apos;t
                                    be undone.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="secondary">Cancel</Button>
                                </DialogClose>
                                <Button
                                    type="submit"
                                    form={formId}
                                    disabled={processing}
                                >
                                    <Send /> Send now
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </Form>
    );
}

export default function MyAdvisory({
    advisories,
    today,
}: {
    advisories: Advisory[];
    today: string;
}) {
    return (
        <>
            <Head title="My Advisory Class" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <Heading
                    title="My Advisory Class"
                    description="The sections you advise. You can import grades in every subject for these students, and text them and their guardians class suspension notices."
                />

                {advisories.length === 0 && (
                    <div className="rounded-xl border border-dashed border-sidebar-border/70 px-4 py-10 text-center text-sm text-muted-foreground dark:border-sidebar-border">
                        You aren&apos;t a section adviser yet. Ask the registrar
                        to assign your advisory class.
                    </div>
                )}

                {advisories.map((advisory) => (
                    <section
                        key={advisory.id}
                        className="space-y-4 rounded-xl border border-sidebar-border/70 p-4 dark:border-sidebar-border"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold">
                                    {advisory.grade_level} – {advisory.section}
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    S.Y. {advisory.school_year}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {advisory.education_level_label && (
                                    <Badge variant="secondary">
                                        {advisory.education_level_label}
                                    </Badge>
                                )}
                                <Badge variant="outline">
                                    <Users /> {advisory.student_count} active
                                    student
                                    {advisory.student_count === 1 ? '' : 's'}
                                </Badge>
                            </div>
                        </div>

                        {advisory.is_current ? (
                            <div className="space-y-3 rounded-lg bg-muted/40 p-4">
                                <h3 className="flex items-center gap-2 font-medium">
                                    <MessageSquareWarning className="size-4" />
                                    Class suspension notice
                                </h3>
                                <SuspensionForm
                                    advisory={advisory}
                                    today={today}
                                />
                            </div>
                        ) : (
                            <Alert>
                                <AlertDescription>
                                    Suspension notices can only be sent to this
                                    school year&apos;s advisory class.
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <h3 className="text-sm font-medium text-muted-foreground">
                                Notices sent
                            </h3>
                            {advisory.notices.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    None yet.
                                </p>
                            ) : (
                                <ul className="divide-y divide-sidebar-border/70 rounded-lg border border-sidebar-border/70 text-sm dark:divide-sidebar-border dark:border-sidebar-border">
                                    {advisory.notices.map((notice) => (
                                        <li
                                            key={notice.id}
                                            className="space-y-1 px-4 py-3"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <span className="font-medium">
                                                    {formatDay(
                                                        notice.starts_on,
                                                    )}
                                                    {notice.ends_on &&
                                                        notice.ends_on !==
                                                            notice.starts_on &&
                                                        ` – ${formatDay(notice.ends_on)}`}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    Sent{' '}
                                                    {new Date(
                                                        notice.created_at,
                                                    ).toLocaleString()}{' '}
                                                    to {notice.recipient_count}{' '}
                                                    number
                                                    {notice.recipient_count ===
                                                    1
                                                        ? ''
                                                        : 's'}
                                                </span>
                                            </div>
                                            <p className="text-muted-foreground">
                                                {notice.reason}
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </section>
                ))}
            </div>
        </>
    );
}

MyAdvisory.layout = {
    breadcrumbs: [{ title: 'My Advisory Class', href: mine() }],
};
