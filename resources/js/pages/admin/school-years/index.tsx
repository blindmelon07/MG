import { Form, Head, router } from '@inertiajs/react';
import { CalendarCheck, Eye, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import SchoolYearController from '@/actions/App/Http/Controllers/Admin/SchoolYearController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
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
import { select } from '@/routes/admin/school-year';
import {
    current as makeCurrent,
    index as schoolYearsIndex,
} from '@/routes/admin/school-years';

type SchoolYearRow = {
    id: number;
    name: string;
    is_current: boolean;
    enrollments: number;
    grades: number;
};

export default function SchoolYearsIndex({
    schoolYears,
    suggested,
}: {
    schoolYears: SchoolYearRow[];
    suggested: string;
}) {
    const [createOpen, setCreateOpen] = useState(false);
    const [promoting, setPromoting] = useState<SchoolYearRow | null>(null);
    const [deleting, setDeleting] = useState<SchoolYearRow | null>(null);

    return (
        <>
            <Head title="School Years" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <Heading
                        title="School Years"
                        description="The current school year is where new students are enrolled. Use the school year picker at the top of any page to look back at an earlier year's students, grades and teaching assignments."
                    />
                    <Button onClick={() => setCreateOpen(true)}>
                        <Plus /> Add School Year
                    </Button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <table className="w-full text-sm">
                        <thead className="border-b border-sidebar-border/70 bg-muted/50 text-left dark:border-sidebar-border">
                            <tr>
                                <th className="px-4 py-2 font-medium">
                                    School year
                                </th>
                                <th className="px-4 py-2 text-right font-medium">
                                    Students enrolled
                                </th>
                                <th className="px-4 py-2 text-right font-medium">
                                    Grades
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="tabular-nums">
                            {schoolYears.map((year) => (
                                <tr
                                    key={year.id}
                                    className="border-b border-sidebar-border/70 last:border-0 dark:border-sidebar-border"
                                >
                                    <td className="px-4 py-2 font-medium">
                                        S.Y. {year.name}{' '}
                                        {year.is_current && (
                                            <Badge className="ml-2">
                                                Current
                                            </Badge>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        {year.enrollments}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        {year.grades}
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    router.post(select().url, {
                                                        school_year: year.name,
                                                    })
                                                }
                                            >
                                                <Eye /> View
                                            </Button>
                                            {!year.is_current && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        setPromoting(year)
                                                    }
                                                >
                                                    <CalendarCheck /> Make
                                                    current
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                disabled={
                                                    year.is_current ||
                                                    year.enrollments > 0 ||
                                                    year.grades > 0
                                                }
                                                onClick={() =>
                                                    setDeleting(year)
                                                }
                                            >
                                                <Trash2 />
                                                <span className="sr-only">
                                                    Remove
                                                </span>
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add school year</DialogTitle>
                    </DialogHeader>
                    <Form
                        {...SchoolYearController.store.form()}
                        resetOnSuccess
                        onSuccess={() => setCreateOpen(false)}
                        className="space-y-4"
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="name">School year</Label>
                                    <Input
                                        id="name"
                                        name="name"
                                        required
                                        defaultValue={suggested}
                                        placeholder="2027-2028"
                                    />
                                    <InputError message={errors.name} />
                                </div>
                                <div className="flex items-center gap-3">
                                    <Checkbox
                                        id="make_current"
                                        name="make_current"
                                        value="1"
                                    />
                                    <Label htmlFor="make_current">
                                        Make it the current school year
                                    </Label>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="secondary">
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={processing}>
                                        Add
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={promoting !== null}
                onOpenChange={(open) => !open && setPromoting(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Make S.Y. {promoting?.name} current?
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        New students are enrolled in the current school year,
                        and everyone opens pages on it. Students carry over from
                        last year only once you enroll them: re-import them with
                        their new levels and sections, or edit them one at a
                        time.
                    </p>
                    {promoting && (
                        <Form
                            {...makeCurrent.form(promoting.id)}
                            onSuccess={() => setPromoting(null)}
                        >
                            {({ processing }) => (
                                <DialogFooter className="mt-4">
                                    <DialogClose asChild>
                                        <Button variant="secondary">
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={processing}>
                                        Make current
                                    </Button>
                                </DialogFooter>
                            )}
                        </Form>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove S.Y. {deleting?.name}?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        It has no students or grades, so nothing else changes.
                    </p>
                    {deleting && (
                        <Form
                            {...SchoolYearController.destroy.form(deleting.id)}
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
                                        Remove
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

SchoolYearsIndex.layout = {
    breadcrumbs: [{ title: 'School Years', href: schoolYearsIndex() }],
};
