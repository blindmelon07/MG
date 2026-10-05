import { Form, Head, Link, router } from '@inertiajs/react';
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
import { create, edit, index as studentsIndex } from '@/routes/admin/students';
import { template as importTemplate } from '@/routes/admin/students/import';
import type { Paginated } from '@/types/pagination';

type Guardian = {
    id: number;
    name: string;
    relationship: string;
    phone_number: string;
};

type Student = {
    id: number;
    name: string;
    student_number: string | null;
    education_level: string | null;
    grade_level: string | null;
    section: string | null;
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

export default function StudentsIndex({
    students,
    search,
    sections,
    awaitingCredentials,
    educationLevels,
}: {
    students: Paginated<Student>;
    search: string;
    sections: string[];
    awaitingCredentials: number;
    educationLevels: EducationLevelOption[];
}) {
    const [deleting, setDeleting] = useState<Student | null>(null);
    const [searchTerm, setSearchTerm] = useState(search);
    const [importing, setImporting] = useState(false);
    const [issuing, setIssuing] = useState<Student | null>(null);
    const [printing, setPrinting] = useState(false);

    return (
        <>
            <Head title="Students" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <div className="flex items-center justify-between">
                    <Heading
                        title="Students & Parents"
                        description="Manage student records and their parent/guardian contacts."
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

                <form
                    className="max-w-sm"
                    onSubmit={(e) => {
                        e.preventDefault();
                        router.get(
                            studentsIndex().url,
                            { search: searchTerm },
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
                                        No students yet.
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
                                        <div>
                                            {[
                                                student.grade_level,
                                                student.section,
                                            ]
                                                .filter(Boolean)
                                                .join(' — ') || '—'}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {educationLevels.find(
                                                (level) =>
                                                    level.value ===
                                                    student.education_level,
                                            )?.label ?? 'No education level'}
                                        </div>
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
                        required except the student&apos;s phone and the second
                        guardian. Rows matching an existing student # are
                        skipped. Use &ldquo;Login slips&rdquo; afterwards to
                        create portal passwords for the new students.
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
