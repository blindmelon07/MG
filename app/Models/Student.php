<?php

namespace App\Models;

use Database\Factories\StudentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $name
 * @property string|null $student_number
 * @property string|null $education_level
 * @property string|null $grade_level
 * @property string|null $section
 * @property string $grading_system
 * @property string|null $phone_number
 * @property string $status
 * @property string|null $password
 * @property bool $must_change_password
 * @property Carbon|null $last_login_at
 */
#[Fillable([
    'name',
    'student_number',
    'education_level',
    'grade_level',
    'section',
    'grading_system',
    'phone_number',
    'status',
])]
#[Hidden(['password', 'remember_token'])]
class Student extends Authenticatable
{
    /** @use HasFactory<StudentFactory> */
    use HasFactory;

    public const GRADING_SYSTEMS = ['k12', 'college'];

    /**
     * Education levels the school offers, with the year levels each one allows.
     *
     * @var array<string, array{label: string, grading_system: string, grade_levels: list<string>}>
     */
    public const EDUCATION_LEVELS = [
        'jhs' => [
            'label' => 'Junior High School',
            'grading_system' => 'k12',
            'grade_levels' => ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'],
        ],
        'shs' => [
            'label' => 'Senior High School',
            'grading_system' => 'k12',
            'grade_levels' => ['Grade 11', 'Grade 12'],
        ],
        'college' => [
            'label' => 'College',
            'grading_system' => 'college',
            'grade_levels' => ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'],
        ],
        'graduate' => [
            'label' => 'Graduate School',
            'grading_system' => 'college',
            'grade_levels' => ['1st Year', '2nd Year', '3rd Year'],
        ],
    ];

    /**
     * Education levels as the frontend expects them.
     *
     * @return list<array{value: string, label: string, grade_levels: list<string>}>
     */
    public static function educationLevelOptions(): array
    {
        return array_map(
            fn (string $key, array $level) => ['value' => $key, 'label' => $level['label'], 'grade_levels' => $level['grade_levels']],
            array_keys(self::EDUCATION_LEVELS),
            self::EDUCATION_LEVELS,
        );
    }

    public static function gradingSystemFor(string $educationLevel): string
    {
        return self::EDUCATION_LEVELS[$educationLevel]['grading_system'] ?? 'k12';
    }

    /**
     * Match an education level by key ("jhs"), label ("Junior High School") or initials ("JHS").
     */
    public static function resolveEducationLevel(?string $value): ?string
    {
        $value = strtolower(trim((string) $value));

        foreach (self::EDUCATION_LEVELS as $key => $level) {
            $label = strtolower($level['label']);
            $initials = implode('', array_map(fn (string $word) => $word[0], explode(' ', $label)));

            if (in_array($value, [$key, $label, $initials], true)) {
                return $key;
            }
        }

        return null;
    }

    /**
     * The canonical spelling of a year level for an education level, or null if it isn't one of them.
     */
    public static function resolveGradeLevel(string $educationLevel, ?string $value): ?string
    {
        $value = strtolower(trim((string) $value));

        foreach (self::EDUCATION_LEVELS[$educationLevel]['grade_levels'] ?? [] as $gradeLevel) {
            // Also accept the short form: "8" for "Grade 8", "1st" for "1st Year".
            $short = strtolower(trim(str_replace(['Grade', 'Year'], '', $gradeLevel)));

            if ($value === strtolower($gradeLevel) || $value === $short) {
                return $gradeLevel;
            }
        }

        return null;
    }

    public function educationLevelLabel(): ?string
    {
        return self::EDUCATION_LEVELS[$this->education_level]['label'] ?? null;
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'must_change_password' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // The grading system follows from the education level.
        static::saving(function (Student $student): void {
            if ($student->education_level !== null && $student->isDirty('education_level')) {
                $student->grading_system = self::gradingSystemFor($student->education_level);
            }
        });
    }

    /** Excludes look-alike characters (0/O, 1/l/I) so printed slips are easy to type. */
    private const TEMPORARY_PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    private const TEMPORARY_PASSWORD_LENGTH = 10;

    /**
     * Replace the password with a random one the student must change on first login.
     * Also ends any "remember me" sessions. Returns the plain password so it can be
     * handed to the student once; it is never stored unhashed.
     */
    public function issueTemporaryPassword(): string
    {
        $alphabet = self::TEMPORARY_PASSWORD_ALPHABET;
        $password = '';

        for ($i = 0; $i < self::TEMPORARY_PASSWORD_LENGTH; $i++) {
            $password .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        $this->password = $password;
        $this->must_change_password = true;
        $this->setRememberToken(Str::random(60));
        $this->save();

        return $password;
    }

    public function hasAccount(): bool
    {
        return $this->student_number !== null && $this->password !== null;
    }

    /**
     * Students who can't sign in yet or are still on a temporary password.
     *
     * @param  Builder<Student>  $query
     * @return Builder<Student>
     */
    public function scopeAwaitingCredentials(Builder $query): Builder
    {
        return $query->whereNotNull('student_number')
            ->where(fn (Builder $q) => $q->whereNull('password')->orWhere('must_change_password', true));
    }

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
     * @return HasMany<Grade, $this>
     */
    public function grades(): HasMany
    {
        return $this->hasMany(Grade::class);
    }

    /**
     * @return BelongsToMany<Announcement, $this>
     */
    public function announcements(): BelongsToMany
    {
        return $this->belongsToMany(Announcement::class, 'announcement_student');
    }
}
