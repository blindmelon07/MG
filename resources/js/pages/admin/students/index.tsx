import { Form, Head, Link, router, usePage } from '@inertiajs/react';
import {
    Download,
    KeyRound,
    Pencil,
    Plus,
    Printer,
    Trash2,
    Upload,
} from 'lucide-react';
import { useState } from 'react';
import StudentController from '@/actions/App/Http/Controllers/Admin/StudentController';
import StudentImportController from '@/actions/App/Http/Controllers/Admin/StudentImportController';
import type { EducationLevelOption } from '@/components/education-level-fields';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import {
    IssueCredentialsDialog,
    IssuedCredentialsDialog,
    PrintCredentialsDialog,
} from '@/components/student-credentials';
import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { create, edit, index as studentsIndex } from '@/routes/admin/students';
import { template as importTemplate } from '@/routes/admin/students/import';
import type { Paginated } from '@/types/pagination';

type Guardian = {
    id: number;
    name: string;
    relationship: string;
    phone_number: string;
};

type Enrollment = {
    school_year: string;
    education_level: string | null;
    grade_level: string | null;
    section: string | null;
    course: { id: number; code: string; name: string } | null;
};

type Student = {
    id: number;
    name: string;
    student_number: string | null;
    /** Where the student is in the school year being viewed. */
    enrollment: Enrollment | null;
    status: 'active' | 'inactive';
    grading_system: 'k12' | 'college';
    must_change_password: boolean;
    has_password: boolean;
    last_login_at: string | null;
    guardians: Guardian[];
};

function accountStatus(student: Student): string {
    if (!student.student_number) {
        return 'No login (needs student #)';
    }

    if (!student.has_password) {
        return 'No password issued';
    }

    if (student.must_change_password) {
        return 'Temporary password';
    }

    return student.last_login_at
        ? `Last sign-in ${new Date(student.last_login_at).toLocaleDateString()}`
        : 'Active';
}

type EnrollmentFilter = 'enrolled' | 'none';

export default function StudentsIndex({
    students,
    search,
    enrollment,
    counts,
    sections,
    awaitingCredentials,
    educationLevels,
}: {
    students: Paginated<Student>;
    search: string;
    enrollment: EnrollmentFilter;
    counts: Record<EnrollmentFilter, number>;
    sections: string[];
    awaitingCredentials: Record<string, number>;
    educationLevels: EducationLevelOption[];
}) {
    const [deleting, setDeleting] = useState<Student | null>(null);
    const [searchTerm, setSearchTerm] = useState(search);
    const [importing, setImporting] = useState(false);
    const [issuing, setIssuing] = useState<Student | null>(null);
    const [printing, setPrinting] = useState(false);
    const { schoolYear } = usePage().props;
    const year = schoolYear?.selected ?? '';

    const tabs: { value: EnrollmentFilter; label: string }[] = [
        { value: 'enrolled', label: `Enrolled in S.Y. ${year}` },
        { value: 'none', label: 'Not enrolled this year' },
    ];

    return (
        <>
            <Head title="Students" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <div className="flex items-center justify-between">
                    <Heading
                        title="Students & Parents"
                        description={`Manage student records and their parent/guardian contacts for S.Y. ${year}.`}
                    />

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setPrinting(true)}
                        >
                            <Printer /> Login slips
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setImporting(true)}
                        >
                            <Upload /> Import
                        </Button>
                        <Button asChild>
                            <Link href={create()}>
                                <Plus /> New Student
                            </Link>
                        </Button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-1 border-b border-sidebar-border/70 dark:border-sidebar-border">
                    {tabs.map((tab) => (
                        <Link
                            key={tab.value}
                            href={studentsIndex({
                                query: {
                                    enrollment:
                                        tab.value === 'none'
                                            ? 'none'
                                            : undefined,
                                    search: search || undefined,
                                },
                            })}
                            preserveState
                            className={cn(
                                '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
                                enrollment === tab.value
                                    ? 'border-primary text-foreground'
                                    : 'border-transparent text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {tab.label}{' '}
                            <span className="text-muted-foreground">
                                ({counts[tab.value]})
                            </span>
                        </Link>
                    ))}
                </div>

                {enrollment === 'none' && (
                    <p className="text-sm text-muted-foreground">
                        Students on file with no record for S.Y. {year}. Open
                        one with the pencil to enroll them, or re-import them
                        with this year&apos;s levels and sections.
                    </p>
                )}

                <form
                    className="max-w-sm"
                    onSubmit={(e) => {
                        e.preventDefault();
                        router.get(
                            studentsIndex().url,
                            {
                                search: searchTerm,
                                enrollment:
                                    enrollment === 'none' ? 'none' : undefined,
                            },
                            { preserveState: true, replace: true },
                        );
                    }}
                >
                    <Input
                        placeholder="Search by name or student #"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </form>

                <div className="overflow-x-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <table className="w-full text-sm">
                        <thead className="border-b border-sidebar-border/70 bg-muted/50 text-left dark:border-sidebar-border">
                            <tr>
                                <th className="px-4 py-2 font-medium">Name</th>
                                <th className="px-4 py-2 font-medium">
                                    Student #
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    Level, Year &amp; Section
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    Guardians
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    Status
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    Portal account
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-4 py-6 text-center text-muted-foreground"
                                    >
                                        {enrollment === 'none'
                                            ? 'Every student is enrolled this school year.'
                                            : `No students enrolled in S.Y. ${year} yet.`}
                                    </td>
                                </tr>
                            )}
                            {students.data.map((student) => (
                                <tr
                                    key={student.id}
                                    className="border-b border-sidebar-border/70 last:border-0 dark:border-sidebar-border"
                                >
                                    <td className="px-4 py-2 font-medium">
                                        {student.name}
                                    </td>
                                    <td className="px-4 py-2">
                                        {student.student_number ?? '—'}
                                    </td>
                                    <td className="px-4 py-2">
                                        {student.enrollment ? (
                                            <>
                                                <div>
                                                    {[
                                                        student.enrollment
                                                            .course?.code,
                                                        student.enrollment
                                                            .grade_level,
                                                        student.enrollment
                                                            .section,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' — ') || '—'}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {educationLevels.find(
                                                        (level) =>
                                                            level.value ===
                                                            student.enrollment
                                                                ?.education_level,
                                                    )?.label ??
                                                        'No education level'}
                                                </div>
                                            </>
                                        ) : (
                                            <span className="text-muted-foreground">
                                                Not enrolled in S.Y. {year}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2">
                                        {student.guardians.length === 0
                                            ? '—'
                                            : student.guardians
                                                  .map((g) => g.name)
                                                  .join(', ')}
                                    </td>
                                    <td className="px-4 py-2">
                                        <Badge
                                            variant={
                                                student.status === 'active'
                                                    ? 'default'
                                                    : 'secondary'
                                            }
                                        >
                                            {student.status}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-2 text-muted-foreground">
                                        {accountStatus(student)}
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                disabled={
                                                    !student.student_number
                                                }
                                                onClick={() =>
                                                    setIssuing(student)
                                                }
                                            >
                                                <KeyRound />
                                                <span className="sr-only">
                                                    Issue portal password
                                                </span>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                asChild
                                            >
                                                <Link href={edit(student.id)}>
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
                                                    setDeleting(student)
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

                {students.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {students.links.map((link, i) => (
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
                        <DialogTitle>Delete student?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        This will permanently delete &quot;{deleting?.name}
                        &quot; and their guardian contacts.
                    </p>
                    {deleting && (
                        <Form
                            {...StudentController.destroy.form(deleting.id)}
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

            <IssueCredentialsDialog
                student={issuing}
                onClose={() => setIssuing(null)}
            />
            <IssuedCredentialsDialog />
            <PrintCredentialsDialog
                open={printing}
                onOpenChange={setPrinting}
                sections={sections}
                awaiting={awaitingCredentials}
            />

            <Dialog open={importing} onOpenChange={setImporting}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Import students</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Fill in the Excel template (or a CSV with the same
                        columns) with student and guardian info. Every column is
                        required except the student&apos;s phone, the second
                        guardian, and the course (needed for college and
                        graduate school only). Sections must be on the Sections
                        list; the template has a sheet listing them.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Students are enrolled in{' '}
                        <strong className="text-foreground">S.Y. {year}</strong>
                        . A row whose student # is already on file enrolls that
                        student in S.Y. {year} with the row&apos;s level and
                        section, which is how to carry students over to a new
                        school year.
                    </p>
                    <a
                        href={importTemplate().url}
                        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                        <Download className="size-4" /> Download Excel template
                    </a>
                    <Form
                        {...StudentImportController.store.form()}
                        onSuccess={() => setImporting(false)}
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="import-file">
                                        Excel or CSV file
                                    </Label>
                                    <Input
                                        id="import-file"
                                        name="file"
                                        type="file"
                                        accept=".xlsx,.xls,.csv"
                                        required
                                    />
                                    <InputError message={errors.file} />
                                </div>
                                <div className="mt-4 flex items-start gap-3">
                                    <Checkbox
                                        id="import-send-credentials"
                                        name="send_credentials"
                                        value="1"
                                        defaultChecked
                                    />
                                    <Label
                                        htmlFor="import-send-credentials"
                                        className="leading-snug font-normal"
                                    >
                                        Text each new student&apos;s portal
                                        login to the student and their guardians
                                    </Label>
                                </div>
                                <DialogFooter className="mt-4">
                                    <DialogClose asChild>
                                        <Button variant="secondary">
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={processing}>
                                        <Upload /> Import
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </Form>
                </DialogContent>
            </Dialog>
        </>
    );
}

StudentsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Students',
            href: studentsIndex(),
        },
    ],
};
