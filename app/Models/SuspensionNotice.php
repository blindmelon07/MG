<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int|null $advisory_id null once the adviser is removed; the notice is kept
 * @property int|null $sent_by
 * @property string|null $education_level
 * @property string|null $grade_level
 * @property string|null $section
 * @property string|null $school_year
 * @property string|null $sent_by_name
 * @property Carbon $starts_on
 * @property Carbon|null $ends_on
 * @property string $reason
 * @property string $message
 * @property int $recipient_count
 * @property Carbon $created_at
 */
#[Fillable([
    'advisory_id',
    'sent_by',
    'education_level',
    'grade_level',
    'section',
    'school_year',
    'sent_by_name',
    'starts_on',
    'ends_on',
    'reason',
    'message',
    'recipient_count',
])]
class SuspensionNotice extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'starts_on' => 'date:Y-m-d',
            'ends_on' => 'date:Y-m-d',
            'recipient_count' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        // However a notice is created, it keeps its own copy of the section
        // and sender, so the log never depends on the advisory surviving.
        static::creating(function (SuspensionNotice $notice): void {
            $advisory = $notice->advisory_id !== null ? Advisory::find($notice->advisory_id) : null;

            foreach (['education_level', 'grade_level', 'section', 'school_year'] as $column) {
                $notice->{$column} ??= $advisory?->{$column};
            }

            if ($notice->sent_by !== null) {
                $notice->sent_by_name ??= User::find($notice->sent_by)?->name;
            }
        });
    }

    /**
     * The section and sender as they were when the notice went out, kept on
     * the notice so the log survives the adviser being removed.
     *
     * @return array<string, int|string|null>
     */
    public static function snapshot(Advisory $advisory, User $sender): array
    {
        return [
            ...$advisory->only(['education_level', 'grade_level', 'section', 'school_year']),
            'sent_by' => $sender->id,
            'sent_by_name' => $sender->name,
        ];
    }

    /**
     * @return BelongsTo<Advisory, $this>
     */
    public function advisory(): BelongsTo
    {
        return $this->belongsTo(Advisory::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }
}
