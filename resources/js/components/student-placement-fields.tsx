import { Link } from '@inertiajs/react';
import { useState } from 'react';
import { EducationLevelFields } from '@/components/education-level-fields';
import type { EducationLevelOption } from '@/components/education-level-fields';
import InputError from '@/components/input-error';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { index as coursesIndex } from '@/routes/admin/courses';
import { index as sectionsIndex } from '@/routes/admin/sections';

export type CourseOption = {
    id: number;
    code: string;
    name: string;
    education_level: string;
};

export type SectionOption = {
    id: number;
    education_level: string;
    grade_level: string;
    course_id: number | null;
    name: string;
};

export type Placement = {
    education_level: string | null;
    grade_level: string | null;
    course_id: number | null;
    section: string | null;
};

/** College and graduate school students are enrolled in a course. */
export const COURSE_LEVELS = ['college', 'graduate'];

/**
 * Where a student is in a school year: education level, year level, course
 * (college and graduate school) and a section from the registrar's list.
 */
export function StudentPlacementFields({
    levels,
    courses,
    sections,
    placement,
    errors,
}: {
    levels: EducationLevelOption[];
    courses: CourseOption[];
    sections: SectionOption[];
    placement?: Placement;
    errors: Partial<Record<string, string>>;
}) {
    const [level, setLevel] = useState(placement?.education_level ?? '');
    const [grade, setGrade] = useState(placement?.grade_level ?? '');
    const [course, setCourse] = useState(
        placement?.course_id ? String(placement.course_id) : '',
    );
    const [section, setSection] = useState(placement?.section ?? '');

    const needsCourse = COURSE_LEVELS.includes(level);
    const levelCourses = courses.filter(
        (option) => option.education_level === level,
    );
    // A section tied to another course is left out; untied ones fit any course.
    const gradeSections = sections.filter(
        (option) =>
            option.education_level === level &&
            option.grade_level === grade &&
            (!needsCourse ||
                course === '' ||
                option.course_id === null ||
                String(option.course_id) === course),
    );
    const sectionKept = gradeSections.some((option) => option.name === section);

    return (
        <>
            <EducationLevelFields
                levels={levels}
                defaultEducationLevel={placement?.education_level}
                defaultGradeLevel={placement?.grade_level}
                errors={errors}
                onChange={(educationLevel, gradeLevel) => {
                    if (educationLevel !== level) {
                        setCourse('');
                    }

                    setLevel(educationLevel);
                    setGrade(gradeLevel);
                }}
            />

            {needsCourse && (
                <div className="grid gap-2">
                    <Label htmlFor="course_id">Course</Label>
                    <Select
                        name="course_id"
                        value={course}
                        onValueChange={setCourse}
                        disabled={levelCourses.length === 0}
                        required
                    >
                        <SelectTrigger id="course_id" className="w-full">
                            <SelectValue
                                placeholder={
                                    levelCourses.length === 0
                                        ? 'No courses for this level yet'
                                        : 'Choose a course'
                                }
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {levelCourses.map((option) => (
                                <SelectItem
                                    key={option.id}
                                    value={String(option.id)}
                                >
                                    {option.code} — {option.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {levelCourses.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                            Add the courses offered on the{' '}
                            <Link
                                href={coursesIndex()}
                                className="underline underline-offset-4"
                            >
                                Courses
                            </Link>{' '}
                            page first.
                        </p>
                    )}
                    <InputError message={errors.course_id} />
                </div>
            )}

            <div className="grid gap-2">
                <Label htmlFor="section">Section</Label>
                <Select
                    key={`${level}|${grade}|${course}`}
                    name="section"
                    value={sectionKept ? section : ''}
                    onValueChange={setSection}
                    disabled={gradeSections.length === 0}
                    required
                >
                    <SelectTrigger id="section" className="w-full">
                        <SelectValue
                            placeholder={
                                grade === ''
                                    ? 'Choose a year level first'
                                    : gradeSections.length === 0
                                      ? 'No sections for this year level yet'
                                      : 'Choose a section'
                            }
                        />
                    </SelectTrigger>
                    <SelectContent>
                        {gradeSections.map((option) => (
                            <SelectItem key={option.id} value={option.name}>
                                {option.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {grade !== '' && gradeSections.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                        Add this year level&apos;s sections on the{' '}
                        <Link
                            href={sectionsIndex()}
                            className="underline underline-offset-4"
                        >
                            Sections
                        </Link>{' '}
                        page first.
                    </p>
                )}
                <InputError message={errors.section} />
            </div>
        </>
    );
}
