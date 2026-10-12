<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string|null $education_level
 * @property string|null $grade_level
 * @property string $subject
 * @property string $section
 * @property string $school_year
 */
#[Fillable(['user_id', 'education_level', 'grade_level', 'subject', 'section', 'school_year'])]
class TeachingAssignment extends Model
{
    /**
     * @return BelongsTo<User, $this>
     */
    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function educationLevelLabel(): ?string
    {
        return Student::EDUCATION_LEVELS[$this->education_level]['label'] ?? null;
    }

    public function covers(string $subject, ?string $section, string $schoolYear): bool
    {
        return $section !== null
            && strcasecmp(trim($this->subject), trim($subject)) === 0
            && strcasecmp(trim($this->section), trim($section)) === 0
            && $this->school_year === $schoolYear;
    }
}
