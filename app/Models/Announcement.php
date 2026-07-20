<?php

namespace App\Models;

use Database\Factories\AnnouncementFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $title
 * @property string $content
 * @property string $type
 * @property string $status
 * @property string|null $location
 * @property Carbon|null $event_start_at
 * @property Carbon|null $event_end_at
 * @property Carbon|null $published_at
 */
#[Fillable([
    'created_by',
    'title',
    'slug',
    'content',
    'type',
    'event_start_at',
    'event_end_at',
    'location',
    'status',
    'published_at',
])]
class Announcement extends Model
{
    /** @use HasFactory<AnnouncementFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'event_start_at' => 'datetime',
            'event_end_at' => 'datetime',
            'published_at' => 'datetime',
        ];
    }

    /**
     * @param  Builder<Announcement>  $query
     * @return Builder<Announcement>
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', 'published');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return MorphMany<Media, $this>
     */
    public function media(): MorphMany
    {
        return $this->morphMany(Media::class, 'mediable');
    }
}
