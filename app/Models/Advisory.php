<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A teacher's advisory class: the section they advise for one school year.
 * The adviser can import grades for every subject of the section's students
 * and text the section class suspension notices.
 *
 * @property int $id
 * @property int $user_id
 * @property string $education_level
 * @property string $grade_level
 * @property string $section
 * @property string $school_year
 */
#[Fillable(['user_id', 'education_level', 'grade_level', 'section', 'school_year'])]
class Advisory extends Model
{
    /** Education levels whose sections have advisers. */
    public const EDUCATION_LEVELS = ['shs'];

    /**
     * @return BelongsTo<User, $this>
     */
    public function adviser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return HasMany<SuspensionNotice, $this>
     */
    public function suspensionNotices(): HasMany
    {
        return $this->hasMany(SuspensionNotice::class);
    }

    /**
     * Whether the student was enrolled in this advisory class.
     */
    public function covers(Student $student, string $schoolYear): bool
    {
        if ($schoolYear !== $this->school_year) {
            return false;
        }

        $enrollments = $student->relationLoaded('enrollments') ? $student->enrollments : $student->enrollments()->get();
        $enrollment = $enrollments->firstWhere('school_year', $schoolYear);

        return $enrollment !== null
            && $enrollment->education_level === $this->education_level
            && $enrollment->grade_level === $this->grade_level
            && $enrollment->section !== null
            && strcasecmp(trim($enrollment->section), trim($this->section)) === 0;
    }

    /**
     * Limit a student query to those enrolled in this advisory class.
     *
     * @param  Builder<Student>  $query
     * @return Builder<Student>
     */
    public function inClass(Builder $query): Builder
    {
        return $query->whereHas('enrollments', fn (Builder $q) => $q
            ->where('school_year', $this->school_year)
            ->where('education_level', $this->education_level)
            ->where('grade_level', $this->grade_level)
            ->where('section', $this->section));
    }

    /**
     * The section's active students.
     *
     * @return Builder<Student>
     */
    public function students(): Builder
    {
        return $this->inClass(Student::active());
    }

    public function label(): string
    {
        return "{$this->grade_level} – {$this->section}";
    }
}
