<?php

namespace App\Http\Requests\Admin\Concerns;

use App\Models\Course;
use App\Models\Student;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/**
 * Education level, year level, course and section, each drawn from the
 * lists the registrar keeps.
 */
trait ValidatesStudentPlacement
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    protected function placementRules(): array
    {
        $educationLevel = $this->string('education_level')->toString();

        return [
            'education_level' => ['required', Rule::in(array_keys(Student::EDUCATION_LEVELS))],
            'grade_level' => ['required', 'string', Rule::in(Student::EDUCATION_LEVELS[$educationLevel]['grade_levels'] ?? [])],
            'course_id' => [
                Rule::requiredIf(Course::requiredFor($educationLevel)),
                'nullable',
                'integer',
                Rule::exists('courses', 'id')->where('education_level', $educationLevel),
            ],
            'section' => [
                'required',
                'string',
                'max:255',
                Rule::exists('sections', 'name')
                    ->where('education_level', $educationLevel)
                    ->where('grade_level', $this->string('grade_level')->toString()),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function placementMessages(): array
    {
        return [
            'grade_level.in' => 'Choose a year level that belongs to the selected education level.',
            'course_id.required' => 'Choose the course the student is taking.',
            'course_id.exists' => 'Choose a course offered at this education level.',
            'section.exists' => 'Choose one of the sections listed for this year level.',
        ];
    }

    /**
     * The validated placement, with no course outside college and graduate school.
     *
     * @return array{education_level: string, grade_level: string, course_id: int|null, section: string}
     */
    public function placement(): array
    {
        $data = $this->safe()->only(['education_level', 'grade_level', 'course_id', 'section']);
        $data['course_id'] = Course::requiredFor($data['education_level']) ? (int) $data['course_id'] : null;

        return $data;
    }
}
