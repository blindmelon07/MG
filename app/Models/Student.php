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
