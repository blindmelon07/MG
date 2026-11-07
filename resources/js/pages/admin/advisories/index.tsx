import { Form, Head, usePage } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import AdvisoryController from '@/actions/App/Http/Controllers/Admin/AdvisoryController';
import { EducationLevelFields } from '@/components/education-level-fields';
import type { EducationLevelOption } from '@/components/education-level-fields';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { index as advisoriesIndex } from '@/routes/admin/advisories';

type Advisory = {
    id: number;
    education_level: string;
    grade_level: string;
    section: string;
    school_year: string;
    suspension_notices_count: number;
    adviser: { id: number; name: string };
};

type Teacher = { id: number; name: string };

type SectionOption = {
    education_level: string;
    grade_level: string;
    name: string;
};

export default function AdvisoriesIndex({
    advisories,
    educationLevels,
    teachers,
    sections,
}: {
    advisories: Advisory[];
    educationLevels: EducationLevelOption[];
    teachers: Teacher[];
    sections: SectionOption[];
}) {
    const { schoolYear } = usePage().props;
    const [createOpen, setCreateOpen] = useState(false);
    const [deleting, setDeleting] = useState<Advisory | null>(null);
    const defaultLevel = educationLevels[0]?.value ?? '';
    const [formLevel, setFormLevel] = useState(defaultLevel);
    const [formGrade, setFormGrade] = useState('');

    const levelSections = sections.filter(
        (option) =>
            option.education_level === formLevel &&
            option.grade_level === formGrade,
    );

    return (
        <>
            <Head title="Advisers" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <Heading
                        title="Advisers"
                        description={`S.Y. ${schoolYear?.selected ?? ''}. A section's adviser can import grades in every subject for its students and text them class suspension notices.`}
                    />

                    <Dialog
                        open={createOpen}
                        onOpenChange={(open) => {
                            setCreateOpen(open);

                            if (open) {
                                setFormLevel(defaultLevel);
                                setFormGrade('');
                            }
                        }}
                    >
                        <DialogTrigger asChild>
                            <Button disabled={teachers.length === 0}>
                                <Plus /> Assign Adviser
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>
                                    Assign a section adviser
                                </DialogTitle>
                            </DialogHeader>
                            <Form
                                {...AdvisoryController.store.form()}
                                resetOnSuccess
                                onSuccess={() => setCreateOpen(false)}
                                className="space-y-4"
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <div className="grid gap-2">
                                            <Label htmlFor="user_id">
                                                Teacher
                                            </Label>
                                            <Select name="user_id" required>
                                                <SelectTrigger
                                                    id="user_id"
                                                    className="w-full"
                                                >
                                                    <SelectValue placeholder="Choose a teacher" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {teachers.map((teacher) => (
                                                        <SelectItem
                                                            key={teacher.id}
                                                            value={String(
                                                                teacher.id,
                                                            )}
                                                        >
                                                            {teacher.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <InputError
                                                message={errors.user_id}
                                            />
                                        </div>

                                        <EducationLevelFields
                                            levels={educationLevels}
                                            defaultEducationLevel={defaultLevel}
                                            errors={errors}
                                            onChange={(
                                                educationLevel,
                                                gradeLevel,
                                            ) => {
                                                setFormLevel(educationLevel);
                                                setFormGrade(gradeLevel);
                                            }}
                                        />

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="grid gap-2">
                                                <Label htmlFor="section">
                                                    Section
                                                </Label>
                                                <Select
                                                    key={`${formLevel}|${formGrade}`}
                                                    name="section"
                                                    required
                                                    disabled={
                                                        levelSections.length ===
                                                        0
                                                    }
                                                >
                                                    <SelectTrigger
                                                        id="section"
                                                        className="w-full"
                                                    >
                                                        <SelectValue
                                                            placeholder={
                                                                formGrade === ''
                                                                    ? 'Choose a year level first'
                                                                    : levelSections.length ===
                                                                        0
                                                                      ? 'No sections yet'
                                                                      : 'Choose a section'
                                                            }
                                                        />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {levelSections.map(
                                                            (option) => (
                                                                <SelectItem
                                                                    key={
                                                                        option.name
                                                                    }
                                                                    value={
                                                                        option.name
                                                                    }
                                                                >
                                                                    {
                                                                        option.name
                                                                    }
                                                                </SelectItem>
                                                            ),
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <InputError
                                                    message={errors.section}
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="school_year">
                                                    School year
                                                </Label>
                                                <Input
                                                    id="school_year"
                                                    name="school_year"
                                                    required
                                                    defaultValue={
                                                        schoolYear?.selected
                                                    }
                                                    placeholder="2026-2027"
                                                />
                                                <InputError
                                                    message={errors.school_year}
                                                />
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Sections come from the Sections
                                            page. Add one there if it&apos;s
                                            missing.
                                        </p>

                                        <DialogFooter>
                                            <DialogClose asChild>
                                                <Button variant="secondary">
                                                    Cancel
                                                </Button>
                                            </DialogClose>
                                            <Button
                                                type="submit"
                                                disabled={processing}
                                            >
                                                Assign
                                            </Button>
                                        </DialogFooter>
                                    </>
                                )}
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>

                {teachers.length === 0 && (
                    <Alert>
                        <AlertDescription>
                            No teacher accounts yet. A super admin can create
                            one under Users with the Teacher role.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="overflow-x-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <table className="w-full text-sm">
                        <thead className="border-b border-sidebar-border/70 bg-muted/50 text-left dark:border-sidebar-border">
                            <tr>
                                <th className="px-4 py-2 font-medium">
                                    Adviser
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    Year level
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    Section
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    School year
                                </th>
                                <th className="px-4 py-2 text-right font-medium">
                                    Suspension notices sent
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {advisories.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-4 py-6 text-center text-muted-foreground"
                                    >
                                        No advisers assigned for this school
                                        year yet.
                                    </td>
                                </tr>
                            )}
                            {advisories.map((advisory) => (
                                <tr
                                    key={advisory.id}
                                    className="border-b border-sidebar-border/70 last:border-0 dark:border-sidebar-border"
                                >
                                    <td className="px-4 py-2 font-medium">
                                        {advisory.adviser.name}
                                    </td>
                                    <td className="px-4 py-2">
                                        {advisory.grade_level}
                                    </td>
                                    <td className="px-4 py-2">
                                        {advisory.section}
                                    </td>
                                    <td className="px-4 py-2">
                                        {advisory.school_year}
                                    </td>
                                    <td className="px-4 py-2 text-right tabular-nums">
                                        {advisory.suspension_notices_count}
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex justify-end">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    setDeleting(advisory)
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

            <Dialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove adviser?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        {deleting?.adviser.name} will no longer advise{' '}
                        {deleting?.grade_level} – {deleting?.section}. Grades
                        already imported are kept, but the history of suspension
                        notices sent to this section is deleted.
                    </p>
                    {deleting && (
                        <Form
                            {...AdvisoryController.destroy.form(deleting.id)}
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

AdvisoriesIndex.layout = {
    breadcrumbs: [{ title: 'Advisers', href: advisoriesIndex() }],
};
