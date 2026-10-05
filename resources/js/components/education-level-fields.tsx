import { useState } from 'react';
import InputError from '@/components/input-error';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export type EducationLevelOption = {
    value: string;
    label: string;
    grade_levels: string[];
};

/**
 * Education level, then a year level drawn from that level's list
 * (e.g. Junior High School → Grades 7–10).
 */
export function EducationLevelFields({
    levels,
    defaultEducationLevel,
    defaultGradeLevel,
    errors,
}: {
    levels: EducationLevelOption[];
    defaultEducationLevel?: string | null;
    defaultGradeLevel?: string | null;
    errors: { education_level?: string; grade_level?: string };
}) {
    const [educationLevel, setEducationLevel] = useState(
        defaultEducationLevel ?? '',
    );
    const [gradeLevel, setGradeLevel] = useState(defaultGradeLevel ?? '');
    const gradeLevels =
        levels.find((level) => level.value === educationLevel)?.grade_levels ??
        [];

    return (
        <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
                <Label htmlFor="education_level">Education level</Label>
                <Select
                    name="education_level"
                    value={educationLevel}
                    onValueChange={(value) => {
                        setEducationLevel(value);

                        // Keep the year only if the new level has it too.
                        const next =
                            levels.find((level) => level.value === value)
                                ?.grade_levels ?? [];

                        if (!next.includes(gradeLevel)) {
                            setGradeLevel('');
                        }
                    }}
                    required
                >
                    <SelectTrigger id="education_level" className="w-full">
                        <SelectValue placeholder="Choose a level" />
                    </SelectTrigger>
                    <SelectContent>
                        {levels.map((level) => (
                            <SelectItem key={level.value} value={level.value}>
                                {level.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <InputError message={errors.education_level} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="grade_level">Year level</Label>
                <Select
                    name="grade_level"
                    value={gradeLevel}
                    onValueChange={setGradeLevel}
                    disabled={gradeLevels.length === 0}
                    required
                >
                    <SelectTrigger id="grade_level" className="w-full">
                        <SelectValue
                            placeholder={
                                gradeLevels.length === 0
                                    ? 'Choose a level first'
                                    : 'Choose a year level'
                            }
                        />
                    </SelectTrigger>
                    <SelectContent>
                        {gradeLevels.map((grade) => (
                            <SelectItem key={grade} value={grade}>
                                {grade}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <InputError message={errors.grade_level} />
            </div>
        </div>
    );
}
