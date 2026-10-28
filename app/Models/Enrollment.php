<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Where a student was in one school year: level, year level, course and section.
 *
 * @property int $id
 * @property int $student_id
 * @property string $school_year
 * @property string|null $education_level
 * @property string|null $grade_level
 * @property int|null $course_id
 * @property string|null $section
 */
#[Fillable(['student_id', 'school_year', 'education_level', 'grade_level', 'course_id', 'section'])]
class Enrollment extends Model
{
    /** The student columns an enrollment records. */
    public const PLACEMENT = ['education_level', 'grade_level', 'course_id', 'section'];

    public function gradingSystem(): ?string
    {
        return $this->education_level === null ? null : Student::gradingSystemFor($this->education_level);
    }

    /**
     * @return BelongsTo<Student, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    /**
     * @return BelongsTo<Course, $this>
     */
    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }
}
