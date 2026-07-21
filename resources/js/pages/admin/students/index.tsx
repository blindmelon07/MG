import { Form, Head, Link, router } from '@inertiajs/react';
import { Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import StudentController from '@/actions/App/Http/Controllers/Admin/StudentController';
import StudentImportController from '@/actions/App/Http/Controllers/Admin/StudentImportController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
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
    grade_level: string | null;
    section: string | null;
    status: 'active' | 'inactive';
    guardians: Guardian[];
};

export default function StudentsIndex({
    students,
    search,
}: {
    students: Paginated<Student>;
    search: string;
}) {
    const [deleting, setDeleting] = useState<Student | null>(null);
    const [searchTerm, setSearchTerm] = useState(search);
    const [importing, setImporting] = useState(false);

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
                                    Grade &amp; Section
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    Guardians
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    Status
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
                                        colSpan={6}
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
                                        {[student.grade_level, student.section]
                                            .filter(Boolean)
                                            .join(' — ') || '—'}
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
                                    <td className="px-4 py-2">
                                        <div className="flex justify-end gap-2">
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

            <Dialog open={importing} onOpenChange={setImporting}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Import students</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Upload a CSV file with student and guardian info.
                        Rows matching an existing student # are skipped.
                    </p>
                    <a
                        href={importTemplate().url}
                        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                        <Download className="size-4" /> Download CSV template
                    </a>
                    <Form
                        {...StudentImportController.store.form()}
                        onSuccess={() => setImporting(false)}
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="import-file">
                                        CSV file
                                    </Label>
                                    <Input
                                        id="import-file"
                                        name="file"
                                        type="file"
                                        accept=".csv,text/csv"
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
                                    <Button
                                        type="submit"
                                        disabled={processing}
                                    >
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
