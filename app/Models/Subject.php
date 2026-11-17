<?php

namespace App\Models;

use Database\Factories\SubjectFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property string|null $code
 * @property string $name
 * @property string $education_level
 * @property int|null $course_id
 * @property string|null $year_level
 * @property string|null $semester
 * @property string|null $units
 */
#[Fillable(['code', 'name', 'education_level', 'course_id', 'year_level', 'semester', 'units'])]
class Subject extends Model
{
    /** @use HasFactory<SubjectFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'units' => 'decimal:1',
        ];
    }

    /**
     * The course a college or graduate subject is offered in. Null for general
     * education subjects and for subjects below college.
     *
     * @return BelongsTo<Course, $this>
     */
    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    /**
     * Subjects a student can take: their education level, general education
     * or their own course, and, given a semester, offered in it (a subject
     * without a semester is offered every semester).
     *
     * @param  Builder<Subject>  $query
     * @return Builder<Subject>
     */
    public function scopeAvailableTo(Builder $query, Student $student, ?string $semester = null): Builder
    {
        return $query->where('education_level', $student->education_level)
            ->where(fn (Builder $q) => $q->whereNull('course_id')->when(
                $student->course_id !== null,
                fn (Builder $q) => $q->orWhere('course_id', $student->course_id),
            ))
            ->when($semester !== null, fn (Builder $q) => $q->where(
                fn (Builder $q) => $q->whereNull('semester')->orWhere('semester', $semester),
            ));
    }
}
