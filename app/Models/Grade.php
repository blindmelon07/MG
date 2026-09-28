<?php

namespace App\Models;

use Database\Factories\GradeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Collection;

/**
 * @property int $id
 * @property int $student_id
 * @property string $grading_system
 * @property string $school_year
 * @property string|null $term
 * @property string|null $subject_code
 * @property string $subject
 * @property string|null $units
 * @property string|null $q1
 * @property string|null $q2
 * @property string|null $q3
 * @property string|null $q4
 * @property string|null $midterm
 * @property string|null $final_grade
 * @property string|null $remarks
 * @property int|null $encoded_by
 */
#[Fillable([
    'student_id',
    'grading_system',
    'school_year',
    'term',
    'subject_code',
    'subject',
    'units',
    'q1',
    'q2',
    'q3',
    'q4',
    'midterm',
    'final_grade',
    'remarks',
    'encoded_by',
])]
class Grade extends Model
{
    /** @use HasFactory<GradeFactory> */
    use HasFactory;

    public const TERMS = ['1st Semester', '2nd Semester', 'Summer'];

    /** K-12 grades are percentages; 75 is the DepEd passing mark. */
    public const K12_PASSING = 75;

    /** College grades use the 1.00 (highest) to 5.00 (failed) scale; 3.00 passes. */
    public const COLLEGE_PASSING = 3.0;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'units' => 'decimal:1',
            'q1' => 'decimal:2',
            'q2' => 'decimal:2',
            'q3' => 'decimal:2',
            'q4' => 'decimal:2',
            'midterm' => 'decimal:2',
            'final_grade' => 'decimal:2',
        ];
    }

    protected static function booted(): void
    {
        static::created(fn (Grade $grade) => GradeAudit::record($grade, 'created'));
        static::updated(fn (Grade $grade) => GradeAudit::record($grade, 'updated'));
        static::deleted(fn (Grade $grade) => GradeAudit::record($grade, 'deleted'));
    }

    /**
     * @return BelongsTo<Student, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function encoder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'encoded_by');
    }

    /**
     * Limit grades to the classes a teacher is assigned to.
     *
     * @param  Builder<Grade>  $query
     * @return Builder<Grade>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->canManageAllGrades()) {
            return $query;
        }

        $assignments = $user->teachingAssignments()->get();

        if ($assignments->isEmpty()) {
            return $query->whereRaw('1 = 0');
        }

        return $query->where(function (Builder $query) use ($assignments): void {
            foreach ($assignments as $assignment) {
                $query->orWhere(function (Builder $query) use ($assignment): void {
                    $query->where('subject', $assignment->subject)
                        ->where('school_year', $assignment->school_year)
                        ->whereHas('student', fn (Builder $q) => $q->where('section', $assignment->section));
                });
            }
        });
    }

    public function isVisibleTo(User $user): bool
    {
        if ($user->canManageAllGrades()) {
            return true;
        }

        return $user->teachingAssignments()->get()
            ->contains(fn (TeachingAssignment $a) => $a->covers($this->subject, $this->student->section, $this->school_year));
    }

    /**
     * K-12 final grade is the rounded average of the four quarters.
     *
     * @param  list<float|null>  $quarters
     */
    public static function k12Final(array $quarters): ?float
    {
        if (count($quarters) !== 4 || in_array(null, $quarters, true)) {
            return null;
        }

        return round(array_sum($quarters) / 4);
    }

    public static function remarksFor(string $gradingSystem, ?float $final): ?string
    {
        if ($final === null) {
            return null;
        }

        $passed = $gradingSystem === 'college'
            ? $final <= self::COLLEGE_PASSING
            : $final >= self::K12_PASSING;

        return $passed ? 'Passed' : 'Failed';
    }

    /**
     * General average (K-12) or units-weighted GWA (college) for a set of grades.
     *
     * @param  Collection<int, Grade>  $grades
     */
    public static function averageOf(Collection $grades, string $gradingSystem): ?float
    {
        $graded = $grades->filter(fn (Grade $grade) => $grade->final_grade !== null);

        if ($gradingSystem === 'k12') {
            return $graded->isEmpty() ? null : round((float) $graded->avg(fn (Grade $grade) => (float) $grade->final_grade), 2);
        }

        $weighted = $graded->filter(fn (Grade $grade) => (float) $grade->units > 0);
        $units = (float) $weighted->sum(fn (Grade $grade) => (float) $grade->units);

        if ($units <= 0) {
            return null;
        }

        return round($weighted->sum(fn (Grade $grade) => (float) $grade->final_grade * (float) $grade->units) / $units, 2);
    }
}
