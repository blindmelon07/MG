import { Form, router } from '@inertiajs/react';
import { Copy, FileDown, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import StudentCredentialController from '@/actions/App/Http/Controllers/Admin/StudentCredentialController';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { batch } from '@/routes/admin/students/credentials';

export type CredentialTarget = {
    id: number;
    name: string;
    student_number: string | null;
    has_password: boolean;
    guardians: { name: string; phone_number: string }[];
};

type IssuedCredentials = {
    name: string;
    student_number: string;
    password: string;
    sms_sent: boolean | null;
    slip_url: string;
};

const ALL_SECTIONS = '__all__';

function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);

    return match ? decodeURIComponent(match[1]) : '';
}

/** Confirms issuing a new temporary password for one student. */
export function IssueCredentialsDialog({
    student,
    onClose,
}: {
    student: CredentialTarget | null;
    onClose: () => void;
}) {
    const guardian = student?.guardians[0];

    return (
        <Dialog
            open={student !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {student?.has_password
                            ? 'Reset portal password?'
                            : 'Issue portal password?'}
                    </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                    A new random temporary password will be created for{' '}
                    {student?.name}. It is shown once, so give it to the student
                    in person or text it to their guardian.
                    {student?.has_password &&
                        ' Their current password stops working and any signed-in sessions end.'}
                </p>
                {student && (
                    <Form
                        {...StudentCredentialController.store.form(student.id)}
                        options={{ preserveScroll: true }}
                        onSuccess={onClose}
                        className="space-y-4"
                    >
                        {({ processing }) => (
                            <>
                                {guardian ? (
                                    <div className="flex items-center gap-3">
                                        <Checkbox
                                            id="send_sms"
                                            name="send_sms"
                                            value="1"
                                        />
                                        <Label htmlFor="send_sms">
                                            Also text it to {guardian.name} (
                                            {guardian.phone_number})
                                        </Label>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No guardian phone on file, so it can
                                        only be shown on screen.
                                    </p>
                                )}
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="secondary">
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={processing}>
                                        {processing && <Spinner />}
                                        Create password
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
}

/**
 * Shows a newly issued password exactly once. The server sends it as flash
 * data, which Inertia keeps out of browser history.
 */
export function IssuedCredentialsDialog() {
    const [issued, setIssued] = useState<IssuedCredentials | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        return router.on('flash', (event) => {
            const data = (event as CustomEvent).detail?.flash?.credentials as
                IssuedCredentials | undefined;

            if (data) {
                setCopied(false);
                setIssued(data);
            }
        });
    }, []);

    return (
        <Dialog
            open={issued !== null}
            onOpenChange={(open) => !open && setIssued(null)}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Temporary password created</DialogTitle>
                </DialogHeader>
                {issued && (
                    <div className="space-y-4">
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                            <dt className="text-muted-foreground">Student</dt>
                            <dd className="font-medium">{issued.name}</dd>
                            <dt className="text-muted-foreground">Student #</dt>
                            <dd className="font-mono">
                                {issued.student_number}
                            </dd>
                            <dt className="text-muted-foreground">Password</dt>
                            <dd className="font-mono text-lg font-semibold tracking-wider">
                                {issued.password}
                            </dd>
                        </dl>
                        {issued.sms_sent === true && (
                            <Alert>
                                <AlertDescription>
                                    Sent to the guardian by SMS.
                                </AlertDescription>
                            </Alert>
                        )}
                        {issued.sms_sent === false && (
                            <Alert variant="destructive">
                                <AlertDescription>
                                    The SMS could not be sent. Give the password
                                    to the student directly.
                                </AlertDescription>
                            </Alert>
                        )}
                        <p className="text-xs text-muted-foreground">
                            This password won&apos;t be shown again. The student
                            must change it the first time they sign in.
                        </p>
                    </div>
                )}
                <DialogFooter>
                    {issued && (
                        <Button variant="outline" asChild>
                            <a href={issued.slip_url}>
                                <FileDown /> Print slip (PDF)
                            </a>
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        onClick={() => {
                            if (issued) {
                                void navigator.clipboard
                                    ?.writeText(issued.password)
                                    .then(() => setCopied(true));
                            }
                        }}
                    >
                        <Copy /> {copied ? 'Copied' : 'Copy password'}
                    </Button>
                    <DialogClose asChild>
                        <Button>Done</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Issues passwords for a whole section and downloads them as a PDF of printable slips. */
export function PrintCredentialsDialog({
    open,
    onOpenChange,
    sections,
    awaiting,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sections: string[];
    awaiting: number;
}) {
    const [section, setSection] = useState(ALL_SECTIONS);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const download = async () => {
        setProcessing(true);
        setError(null);

        try {
            const response = await fetch(batch().url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/pdf',
                    'X-XSRF-TOKEN': xsrfToken(),
                },
                body: JSON.stringify({
                    section: section === ALL_SECTIONS ? null : section,
                }),
            });

            if (!response.ok) {
                throw new Error(String(response.status));
            }

            const filename =
                response.headers
                    .get('Content-Disposition')
                    ?.match(/filename="?([^"]+)"?/)?.[1] ?? 'login-slips.pdf';
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);

            onOpenChange(false);
            router.reload({ only: ['students', 'awaitingCredentials'] });
        } catch {
            setError(
                'Could not create the credentials. Refresh the page and try again.',
            );
        } finally {
            setProcessing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Print login slips</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                    Creates a random temporary password for each active student
                    who hasn&apos;t set their own password yet ({awaiting} right
                    now), and downloads them as a PDF to print and hand out:
                    four slips per short bond page, with cut lines. Students who
                    already chose a password aren&apos;t affected. Running this
                    again replaces the earlier temporary passwords.
                </p>
                <div className="grid gap-2">
                    <Label htmlFor="credentials-section">Section</Label>
                    <Select value={section} onValueChange={setSection}>
                        <SelectTrigger
                            id="credentials-section"
                            className="w-full"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_SECTIONS}>
                                All sections
                            </SelectItem>
                            {sections.map((s) => (
                                <SelectItem key={s} value={s}>
                                    {s}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <p className="text-xs text-muted-foreground">
                    The PDF contains passwords. Delete it once the slips are
                    printed.
                </p>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="secondary">Cancel</Button>
                    </DialogClose>
                    <Button
                        onClick={download}
                        disabled={processing || awaiting === 0}
                    >
                        {processing ? <Spinner /> : <Printer />}
                        Create &amp; download
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
