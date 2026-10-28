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
    SectionOption,
} from '@/components/student-placement-fields';
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
import { create, index as studentsIndex } from '@/routes/admin/students';

type GuardianRow = { name: string; relationship: string; phone_number: string };

const emptyGuardian: GuardianRow = {
    name: '',
    relationship: '',
    phone_number: '',
};

export default function StudentsCreate({
    educationLevels,
    courses,
    sectionOptions,
}: {
    educationLevels: EducationLevelOption[];
    courses: CourseOption[];
    sectionOptions: SectionOption[];
}) {
    const { schoolYear } = usePage().props;
    const [guardians, setGuardians] = useState<GuardianRow[]>([
        { ...emptyGuardian },
    ]);

    return (
        <>
            <Head title="New Student" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <Heading
                    title="New Student"
                    description={`Add a student and their parent/guardian contacts. They are enrolled in S.Y. ${schoolYear?.selected ?? ''}.`}
                />

                <Form
                    {...StudentController.store.form()}
                    className="max-w-2xl space-y-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="name">Name</Label>
                                <Input id="name" name="name" required />
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
                                    />
                                    <InputError message={errors.phone_number} />
                                </div>
                            </div>

                            <StudentPlacementFields
                                levels={educationLevels}
                                courses={courses}
                                sections={sectionOptions}
                                errors={errors}
                            />

                            <div className="grid gap-2">
                                <Label htmlFor="status">Status</Label>
                                <Select name="status" defaultValue="active">
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
                                                { ...emptyGuardian },
                                            ])
                                        }
                                    >
                                        <Plus /> Add guardian
                                    </Button>
                                </div>

                                {guardians.map((guardian, index) => (
                                    <div
                                        key={index}
                                        className="grid grid-cols-[1fr_1fr_1fr_auto] items-start gap-2 rounded-lg border border-sidebar-border/70 p-3 dark:border-sidebar-border"
                                    >
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

                            <div className="flex items-start gap-3 rounded-lg border border-sidebar-border/70 p-3 dark:border-sidebar-border">
                                <Checkbox
                                    id="send_credentials"
                                    name="send_credentials"
                                    value="1"
                                    defaultChecked
                                />
                                <div className="grid gap-1">
                                    <Label htmlFor="send_credentials">
                                        Text the portal login now
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Creates a temporary password and sends
                                        the student # and password by SMS to the
                                        student&apos;s phone and every guardian.
                                        It is also shown once on screen, with a
                                        printable slip.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <Button type="submit" disabled={processing}>
                                    Create Student
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}

StudentsCreate.layout = {
    breadcrumbs: [
        { title: 'Students', href: studentsIndex() },
        { title: 'New', href: create() },
    ],
};
