import { Form, Head, usePage } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import StudentController from '@/actions/App/Http/Controllers/Admin/StudentController';
import type { EducationLevelOption } from '@/components/education-level-fields';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { PhoneInput } from '@/components/phone-input';
import { StudentPlacementFields } from '@/components/student-placement-fields';
import type {
    CourseOption,
    Placement,
    SectionOption,
} from '@/components/student-placement-fields';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { edit, index as studentsIndex } from '@/routes/admin/students';

type GuardianRow = {
    id?: number;
    name: string;
    relationship: string;
    phone_number: string;
};

type HistoryRow = {
    id: number;
    school_year: string;
    education_level: string | null;
    grade_level: string | null;
    section: string | null;
    course: { id: number; code: string } | null;
};

type EditedStudent = {
    id: number;
    name: string;
    student_number: string | null;
    education_level: string | null;
    grade_level: string | null;
    section: string | null;
    phone_number: string | null;
    status: 'active' | 'inactive';
    guardians: GuardianRow[];
};

export default function StudentsEdit({
    student,
    placement,
    enrolled,
    history,
    educationLevels,
    courses,
    sectionOptions,
}: {
    student: EditedStudent;
    placement: Placement;
    enrolled: boolean;
    history: HistoryRow[];
    educationLevels: EducationLevelOption[];
    courses: CourseOption[];
    sectionOptions: SectionOption[];
}) {
    const { schoolYear } = usePage().props;
    const year = schoolYear?.selected ?? '';
    const levelLabel = (value: string | null) =>
        educationLevels.find((level) => level.value === value)?.label ?? '—';

    const [guardians, setGuardians] = useState<GuardianRow[]>(
        student.guardians.length > 0
            ? student.guardians
            : [{ name: '', relationship: '', phone_number: '' }],
    );

    return (
        <>
            <Head title={`Edit ${student.name}`} />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <Heading
                    title="Edit Student"
                    description={`Update this student's details and guardian contacts. Level and section are for S.Y. ${year}; switch the school year at the top to edit another year.`}
                />

                {!enrolled && (
                    <Alert className="max-w-2xl">
                        <AlertDescription>
                            {student.name} isn&apos;t enrolled in S.Y. {year}{' '}
                            yet. Saving enrolls them with the level and section
                            below, filled in from their latest school year.
                        </AlertDescription>
                    </Alert>
                )}

                <Form
                    {...StudentController.update.form(student.id)}
                    className="max-w-2xl space-y-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    required
                                    defaultValue={student.name}
                                />
                                <InputError message={errors.name} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="student_number">
                                        Student #
                                    </Label>
                                    <Input
                                        id="student_number"
                                        name="student_number"
                                        required
                                        defaultValue={
                                            student.student_number ?? ''
                                        }
                                    />
                                    <InputError
                                        message={errors.student_number}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="phone_number">
                                        Student&apos;s phone (optional)
                                    </Label>
                                    <PhoneInput
                                        id="phone_number"
                                        name="phone_number"
                                        defaultValue={
                                            student.phone_number ?? ''
                                        }
                                    />
                                    <InputError message={errors.phone_number} />
                                </div>
                            </div>

                            <StudentPlacementFields
                                levels={educationLevels}
                                courses={courses}
                                sections={sectionOptions}
                                placement={placement}
                                errors={errors}
                            />

                            <div className="grid gap-2">
                                <Label htmlFor="status">Status</Label>
                                <Select
                                    name="status"
                                    defaultValue={student.status}
                                >
                                    <SelectTrigger
                                        id="status"
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">
                                            Active
                                        </SelectItem>
                                        <SelectItem value="inactive">
                                            Inactive
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.status} />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Parents / Guardians</Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setGuardians((rows) => [
                                                ...rows,
                                                {
                                                    name: '',
                                                    relationship: '',
                                                    phone_number: '',
                                                },
                                            ])
                                        }
                                    >
                                        <Plus /> Add guardian
                                    </Button>
                                </div>

                                {guardians.map((guardian, index) => (
                                    <div
                                        key={guardian.id ?? `new-${index}`}
                                        className="grid grid-cols-[1fr_1fr_1fr_auto] items-start gap-2 rounded-lg border border-sidebar-border/70 p-3 dark:border-sidebar-border"
                                    >
                                        {guardian.id && (
                                            <input
                                                type="hidden"
                                                name={`guardians[${index}][id]`}
                                                value={guardian.id}
                                            />
                                        )}
                                        <div className="grid gap-1">
                                            <Label
                                                htmlFor={`guardian-name-${index}`}
                                            >
                                                Name
                                            </Label>
                                            <Input
                                                id={`guardian-name-${index}`}
                                                name={`guardians[${index}][name]`}
                                                required
                                                defaultValue={guardian.name}
                                            />
                                            <InputError
                                                message={
                                                    errors[
                                                        `guardians.${index}.name`
                                                    ]
                                                }
                                            />
                                        </div>
                                        <div className="grid gap-1">
                                            <Label
                                                htmlFor={`guardian-relationship-${index}`}
                                            >
                                                Relationship
                                            </Label>
                                            <Input
                                                id={`guardian-relationship-${index}`}
                                                name={`guardians[${index}][relationship]`}
                                                placeholder="Mother, Father, Guardian"
                                                required
                                                defaultValue={
                                                    guardian.relationship
                                                }
                                            />
                                            <InputError
                                                message={
                                                    errors[
                                                        `guardians.${index}.relationship`
                                                    ]
                                                }
                                            />
                                        </div>
                                        <div className="grid gap-1">
                                            <Label
                                                htmlFor={`guardian-phone-${index}`}
                                            >
                                                Phone
                                            </Label>
                                            <PhoneInput
                                                id={`guardian-phone-${index}`}
                                                name={`guardians[${index}][phone_number]`}
                                                required
                                                defaultValue={
                                                    guardian.phone_number
                                                }
                                            />
                                            <InputError
                                                message={
                                                    errors[
                                                        `guardians.${index}.phone_number`
                                                    ]
                                                }
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="mt-6"
                                            disabled={guardians.length === 1}
                                            onClick={() =>
                                                setGuardians((rows) =>
                                                    rows.filter(
                                                        (_, i) => i !== index,
                                                    ),
                                                )
                                            }
                                        >
                                            <Trash2 />
                                            <span className="sr-only">
                                                Remove
                                            </span>
                                        </Button>
                                    </div>
                                ))}
                                <InputError message={errors.guardians} />
                            </div>

                            <div className="flex items-center gap-4">
                                <Button type="submit" disabled={processing}>
                                    {enrolled
                                        ? 'Save Changes'
                                        : `Save & enroll in S.Y. ${year}`}
                                </Button>
                            </div>
                        </>
                    )}
                </Form>

                {history.length > 0 && (
                    <section className="max-w-2xl space-y-2">
                        <h2 className="text-sm font-semibold">
                            Enrollment history
                        </h2>
                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                            <table className="w-full text-sm">
                                <thead className="border-b border-sidebar-border/70 bg-muted/50 text-left dark:border-sidebar-border">
                                    <tr>
                                        <th className="px-4 py-2 font-medium">
                                            School year
                                        </th>
                                        <th className="px-4 py-2 font-medium">
                                            Level
                                        </th>
                                        <th className="px-4 py-2 font-medium">
                                            Year &amp; section
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((row) => (
                                        <tr
                                            key={row.id}
                                            className="border-b border-sidebar-border/70 last:border-0 dark:border-sidebar-border"
                                        >
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                {row.school_year}
                                            </td>
                                            <td className="px-4 py-2">
                                                {levelLabel(
                                                    row.education_level,
                                                )}
                                            </td>
                                            <td className="px-4 py-2">
                                                {[
                                                    row.course?.code,
                                                    row.grade_level,
                                                    row.section,
                                                ]
                                                    .filter(Boolean)
                                                    .join(' — ') || '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}
            </div>
        </>
    );
}

StudentsEdit.layout = (page: { student: EditedStudent }) => ({
    breadcrumbs: [
        { title: 'Students', href: studentsIndex() },
        { title: 'Edit', href: edit(page.student.id) },
    ],
});
