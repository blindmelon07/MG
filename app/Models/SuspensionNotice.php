<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $advisory_id
 * @property int|null $sent_by
 * @property Carbon $starts_on
 * @property Carbon|null $ends_on
 * @property string $reason
 * @property string $message
 * @property int $recipient_count
 * @property Carbon $created_at
 */
#[Fillable(['advisory_id', 'sent_by', 'starts_on', 'ends_on', 'reason', 'message', 'recipient_count'])]
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
