<?php

namespace App\Models;

use Database\Factories\GradeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
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
 * @property string|null $prelim
 * @property string|null $midterm
 * @property string|null $finals
 * @property string|null $final_grade
 * @property string|null $remarks
 * @property int|null $encoded_by
 * @property Carbon|null $approved_at
 * @property int|null $approved_by
 * @property Carbon|null $returned_at
 * @property int|null $returned_by
 * @property string|null $return_reason
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
    'prelim',
    'midterm',
    'finals',
    'final_grade',
    'remarks',
    'encoded_by',
    'approved_at',
    'approved_by',
    'returned_at',
    'returned_by',
    'return_reason',
])]
class Grade extends Model
{
    /** @use HasFactory<GradeFactory> */
    use HasFactory;

    public const TERMS = ['1st Semester', '2nd Semester', 'Summer'];

    /**
     * JHS and SHS grade in three terms, kept in q1 to q3. q4 only holds
     * grades from before the switch from four quarters.
     */
    public const K12_TERMS = ['q1', 'q2', 'q3'];

    /** K-12 grades are percentages; 75 is the DepEd passing mark. */
    public const K12_PASSING = 75;

    /** College grades in three periods; final_grade holds the total grade. */
    public const COLLEGE_PERIODS = ['prelim', 'midterm', 'finals'];

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
            'prelim' => 'decimal:2',
            'midterm' => 'decimal:2',
            'finals' => 'decimal:2',
            'final_grade' => 'decimal:2',
            'approved_at' => 'datetime',
            'returned_at' => 'datetime',
        ];
    }

    /**
     * College grades a teacher uploads are posted only once the registrar
     * approves them. Registrar and admin uploads, and K-12 grades (encoded
     * by subject teachers and advisers), are posted right away.
     */
    public static function needsApproval(string $gradingSystem, User $encoder): bool
    {
        return $gradingSystem === 'college' && ! $encoder->canManageAllGrades();
    }

    public function isPosted(): bool
    {
        return $this->approved_at !== null;
    }

    /**
     * Grades students can see.
     *
     * @param  Builder<Grade>  $query
     * @return Builder<Grade>
     */
    public function scopePosted(Builder $query): Builder
    {
        return $query->whereNotNull('approved_at');
    }

    /**
     * Waiting for the registrar: not posted and not sent back to the teacher.
     *
     * @param  Builder<Grade>  $query
     * @return Builder<Grade>
     */
    public function scopePendingApproval(Builder $query): Builder
    {
        return $query->whereNull('approved_at')->whereNull('returned_at');
    }

    /**
     * Sent back to the teacher by the registrar, waiting for a corrected upload.
     *
     * @param  Builder<Grade>  $query
     * @return Builder<Grade>
     */
    public function scopeReturned(Builder $query): Builder
    {
        return $query->whereNull('approved_at')->whereNotNull('returned_at');
    }

    public function isReturned(): bool
    {
        return $this->approved_at === null && $this->returned_at !== null;
    }

    /**
     * Post the grade for students to see.
     */
    public function approve(User $approver): void
    {
        $this->forceFill([
            'approved_at' => now(),
            'approved_by' => $approver->id,
            'returned_at' => null,
            'returned_by' => null,
            'return_reason' => null,
        ])->save();

        GradeAudit::record($this, 'approved');
    }

    /**
     * Send a pending grade back to the teacher who uploaded it, with the
     * reason. It stays hidden from the student until a corrected upload is
     * approved.
     */
    public function returnToTeacher(User $registrar, string $reason): void
    {
        $this->forceFill([
            'returned_at' => now(),
            'returned_by' => $registrar->id,
            'return_reason' => $reason,
        ])->save();

        GradeAudit::record($this, 'returned', ['return_reason' => $reason]);
    }

    /**
     * Clear the "returned" mark, e.g. when the teacher uploads a correction.
     *
     * @return $this
     */
    public function clearReturn(): static
    {
        return $this->forceFill(['returned_at' => null, 'returned_by' => null, 'return_reason' => null]);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
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
     * Limit grades to the classes a teacher is assigned to or advises.
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
        $advisories = $user->advisories()->get();

        if ($assignments->isEmpty() && $advisories->isEmpty()) {
            return $query->whereRaw('1 = 0');
        }

        return $query->where(function (Builder $query) use ($assignments, $advisories): void {
            foreach ($assignments as $assignment) {
                $query->orWhere(function (Builder $query) use ($assignment): void {
                    $query->where('subject', $assignment->subject)
                        ->where('school_year', $assignment->school_year)
                        ->whereHas('student', fn (Builder $q) => $q->inSectionDuring($assignment->section, $assignment->school_year));
                });
            }

            // Advisers see every subject of their advisory class.
            foreach ($advisories as $advisory) {
                $query->orWhere(function (Builder $query) use ($advisory): void {
                    $query->where('school_year', $advisory->school_year)
                        ->whereIn('student_id', $advisory->inClass(Student::query())->select('id'));
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
            ->contains(fn (TeachingAssignment $a) => $a->covers($this->subject, $this->student->sectionIn($this->school_year), $this->school_year))
            || $user->advisories()->get()->contains(fn (Advisory $a) => $a->covers($this->student, $this->school_year));
    }

    /**
     * K-12 final grade is the rounded average of the terms, once every term is in.
     *
     * @param  list<float|null>  $terms
     */
    public static function k12Final(array $terms): ?float
    {
        if ($terms === [] || in_array(null, $terms, true)) {
            return null;
        }

        return round(array_sum($terms) / count($terms));
    }

    /**
     * College total grade is the average of prelim, midterm and finals, once all three are in.
     *
     * @param  list<float|null>  $periods
     */
    public static function collegeFinal(array $periods): ?float
    {
        if ($periods === [] || in_array(null, $periods, true)) {
            return null;
        }

        return round(array_sum($periods) / count($periods), 2);
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
