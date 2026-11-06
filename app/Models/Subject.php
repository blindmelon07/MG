<?php

namespace App\Models;

use Database\Factories\SubjectFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property string|null $code
 * @property string $name
 * @property string $education_level
 * @property int|null $course_id
 * @property string|null $units
 */
#[Fillable(['code', 'name', 'education_level', 'course_id', 'units'])]
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
}
