<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A degree program offered in college or graduate school, e.g. BSIT.
 *
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string $education_level
 * @property string|null $units
 */
#[Fillable(['code', 'name', 'education_level', 'units'])]
class Course extends Model
{
    /** Education levels whose students are enrolled in a course. */
    public const EDUCATION_LEVELS = ['college', 'graduate'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'units' => 'decimal:1',
        ];
    }

    public static function requiredFor(?string $educationLevel): bool
    {
        return in_array($educationLevel, self::EDUCATION_LEVELS, true);
    }

    /**
     * Match a course of an education level by its code ("BSIT") or name, ignoring case.
     */
    public static function resolve(string $educationLevel, ?string $value): ?self
    {
        $value = strtolower(trim((string) $value));

        if ($value === '') {
            return null;
        }

        return static::where('education_level', $educationLevel)->get()
            ->first(fn (Course $course) => in_array($value, [strtolower($course->code), strtolower($course->name)], true));
    }

    /**
     * @return HasMany<Section, $this>
     */
    public function sections(): HasMany
    {
        return $this->hasMany(Section::class);
    }

    /**
     * @return HasMany<Student, $this>
     */
    public function students(): HasMany
    {
        return $this->hasMany(Student::class);
    }
}
