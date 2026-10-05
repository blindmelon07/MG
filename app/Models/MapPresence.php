<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Where someone using the kiosk map with "Show my location" was last seen,
 * in map percent. Shown live on the admin dashboard.
 *
 * @property int $id
 * @property string $session_key
 * @property int|null $student_id
 * @property int|null $user_id
 * @property float $x
 * @property float $y
 * @property Carbon $last_seen_at
 */
#[Fillable(['session_key', 'student_id', 'user_id', 'x', 'y', 'last_seen_at'])]
class MapPresence extends Model
{
    public $timestamps = false;

    /** Someone who hasn't reported in this long has left the map. */
    public const ACTIVE_SECONDS = 90;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'x' => 'float',
            'y' => 'float',
            'last_seen_at' => 'datetime',
        ];
    }

    /**
     * @param  Builder<MapPresence>  $query
     * @return Builder<MapPresence>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('last_seen_at', '>=', now()->subSeconds(self::ACTIVE_SECONDS));
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
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function label(): string
    {
        return $this->student->name ?? $this->user->name ?? 'Visitor';
    }

    public function kind(): string
    {
        return match (true) {
            $this->student_id !== null => 'student',
            $this->user_id !== null => 'personnel',
            default => 'visitor',
        };
    }
}
