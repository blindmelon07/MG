import { Download } from 'lucide-react';
import { useState } from 'react';
import type { EducationLevelOption } from '@/components/education-level-fields';
import { COURSE_LEVELS } from '@/components/student-placement-fields';
import type {
    CourseOption,
    SectionOption,
} from '@/components/student-placement-fields';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { template as importTemplate } from '@/routes/admin/grades/import';
import type { GradingSystem } from '@/types/auth';

export type TemplateOptions = {
    educationLevels: (EducationLevelOption & { value: string })[];
    courses: CourseOption[];
    sections: SectionOption[];
    subjects: { id: number; name: string; education_level: string }[];
};

const ANY = '__any__';

const GRADING_SYSTEM_LEVELS: Record<GradingSystem, string[]> = {
    k12: ['jhs', 'shs'],
    college: ['college', 'graduate'],
};

function Picker({
    id,
    label,
    value,
    onChange,
    options,
    anyLabel,
    disabled,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    anyLabel: string;
    disabled?: boolean;
}) {
    return (
        <div className="grid gap-1">
            <Label htmlFor={id} className="text-xs">
                {label}
            </Label>
            <Select
                value={value || ANY}
                onValueChange={(next) => onChange(next === ANY ? '' : next)}
                disabled={disabled}
            >
                <SelectTrigger id={id} className="h-8 w-full">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ANY}>{anyLabel}</SelectItem>
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

/**
 * Builds a link to an Excel template listing the students enrolled in a
 * school year, narrowed to a level, year level, course or section.
 */
export function GradeTemplatePicker({
    system,
    schoolYear,
    options,
}: {
    system: GradingSystem;
    schoolYear: string;
    options: TemplateOptions;
}) {
    const [level, setLevel] = useState('');
    const [grade, setGrade] = useState('');
    const [course, setCourse] = useState('');
    const [section, setSection] = useState('');
    const [subject, setSubject] = useState('');

    const levels = options.educationLevels.filter((option) =>
        GRADING_SYSTEM_LEVELS[system].includes(option.value),
    );
    const levelKeys = level ? [level] : GRADING_SYSTEM_LEVELS[system];
    const grades = levels.find(
        (option) => option.value === level,
    )?.grade_levels;
    const courses = options.courses.filter(
        (option) =>
            COURSE_LEVELS.includes(option.education_level) &&
            levelKeys.includes(option.education_level),
    );
    const sections = [
        ...new Set(
            options.sections
                .filter(
                    (option) =>
                        levelKeys.includes(option.education_level) &&
                        (grade === '' || option.grade_level === grade) &&
                        (course === '' ||
                            option.course_id === null ||
                            String(option.course_id) === course),
                )
                .map((option) => option.name),
        ),
    ];
    const subjects = [
        ...new Set(
            options.subjects
                .filter((option) => levelKeys.includes(option.education_level))
                .map((option) => option.name),
        ),
    ];

    const href = importTemplate(system, {
        query: {
            school_year: schoolYear,
            education_level: level || undefined,
            grade_level: grade || undefined,
            course_id: course || undefined,
            section: section || undefined,
            subject: subject || undefined,
        },
    }).url;

    return (
        <div className="grid gap-3 rounded-lg border border-sidebar-border/70 p-3 dark:border-sidebar-border">
            <p className="text-xs text-muted-foreground">
                Or download a template listing the students enrolled in S.Y.{' '}
                {schoolYear}, with their student #, name and year level filled
                in:
            </p>
            <div className="grid grid-cols-2 gap-3">
                <Picker
                    id="template-level"
                    label="Education level"
                    value={level}
                    onChange={(value) => {
                        setLevel(value);
                        setGrade('');
                        setCourse('');
                        setSection('');
                        setSubject('');
                    }}
                    options={levels.map((option) => ({
                        value: option.value,
                        label: option.label,
                    }))}
                    anyLabel="All levels"
                />
                <Picker
                    id="template-grade"
                    label="Year level"
                    value={grade}
                    onChange={(value) => {
                        setGrade(value);
                        setSection('');
                    }}
                    options={(grades ?? []).map((value) => ({
                        value,
                        label: value,
                    }))}
                    anyLabel="All year levels"
                    disabled={!grades}
                />
                {system === 'college' && (
                    <Picker
                        id="template-course"
                        label="Course"
                        value={course}
                        onChange={(value) => {
                            setCourse(value);
                            setSection('');
                        }}
                        options={courses.map((option) => ({
                            value: String(option.id),
                            label: option.code,
                        }))}
                        anyLabel="All courses"
                    />
                )}
                <Picker
                    id="template-section"
                    label="Section"
                    value={section}
                    onChange={setSection}
                    options={sections.map((value) => ({
                        value,
                        label: value,
                    }))}
                    anyLabel="All sections"
                />
                <Picker
                    id="template-subject"
                    label="Subject"
                    value={subject}
                    onChange={setSubject}
                    options={subjects.map((value) => ({
                        value,
                        label: value,
                    }))}
                    anyLabel="Fill in later"
                />
            </div>
            <a
                href={href}
                className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
                <Download className="size-4" /> Download class list (Excel)
            </a>
        </div>
    );
}
