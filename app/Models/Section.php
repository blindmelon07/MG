<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A section offered for one year level, e.g. "St. Thomas" in Grade 8. College
 * and graduate sections can belong to a course.
 *
 * @property int $id
 * @property string $education_level
 * @property string $grade_level
 * @property int|null $course_id
 * @property string $name
 */
#[Fillable(['education_level', 'grade_level', 'course_id', 'name'])]
class Section extends Model
{
    /**
     * The section's name as saved, matched ignoring case and spacing, or null if the year level has no such section.
     */
    public static function resolve(string $educationLevel, string $gradeLevel, ?string $value): ?string
    {
        $value = strtolower(trim((string) $value));

        if ($value === '') {
            return null;
        }

        return static::where('education_level', $educationLevel)
            ->where('grade_level', $gradeLevel)
            ->pluck('name')
            ->first(fn (string $name) => strtolower(trim($name)) === $value);
    }

    /**
     * @return BelongsTo<Course, $this>
     */
    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }
}
