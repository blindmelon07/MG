<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Append-only record of who changed a grade, from what, to what.
 *
 * @property int $id
 * @property int $grade_id
 * @property int $student_id
 * @property int|null $user_id
 * @property string $event
 * @property array<string, mixed>|null $old_values
 * @property array<string, mixed>|null $new_values
 * @property string|null $ip_address
 * @property Carbon $created_at
 */
#[Fillable(['grade_id', 'student_id', 'user_id', 'event', 'old_values', 'new_values', 'ip_address'])]
class GradeAudit extends Model
{
    public const UPDATED_AT = null;

    /** Columns worth tracking; timestamps and bookkeeping are left out. */
    public const TRACKED = ['school_year', 'term', 'subject_code', 'subject', 'units', 'q1', 'q2', 'q3', 'q4', 'midterm', 'final_grade', 'remarks'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'old_values' => 'array',
            'new_values' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Student, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public static function record(Grade $grade, string $event): void
    {
        $tracked = array_flip(self::TRACKED);

        [$old, $new] = match ($event) {
            'created' => [null, array_intersect_key($grade->getAttributes(), $tracked)],
            'deleted' => [array_intersect_key($grade->getOriginal(), $tracked), null],
            default => [
                array_intersect_key(array_intersect_key($grade->getOriginal(), $grade->getChanges()), $tracked),
                array_intersect_key($grade->getChanges(), $tracked),
            ],
        };

        if ($event === 'updated' && $new === []) {
            return;
        }

        static::create([
            'grade_id' => $grade->id,
            'student_id' => $grade->student_id,
            'user_id' => auth('web')->id(),
            'event' => $event,
            'old_values' => $old,
            'new_values' => $new,
            'ip_address' => request()->ip(),
        ]);
    }
}
