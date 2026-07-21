<?php

namespace App\Models;

use Database\Factories\StudentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $name
 * @property string|null $student_number
 * @property string|null $grade_level
 * @property string|null $section
 * @property string|null $phone_number
 * @property string $status
 */
#[Fillable([
    'name',
    'student_number',
    'grade_level',
    'section',
    'phone_number',
    'status',
])]
class Student extends Model
{
    /** @use HasFactory<StudentFactory> */
    use HasFactory;

    /**
     * @param  Builder<Student>  $query
     * @return Builder<Student>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }

    /**
     * @return HasMany<Guardian, $this>
     */
    public function guardians(): HasMany
    {
        return $this->hasMany(Guardian::class);
    }

    /**
     * @return BelongsToMany<Announcement, $this>
     */
    public function announcements(): BelongsToMany
    {
        return $this->belongsToMany(Announcement::class, 'announcement_student');
    }
}
