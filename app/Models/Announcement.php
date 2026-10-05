<?php

namespace App\Models;

use Database\Factories\AnnouncementFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $title
 * @property string $content
 * @property string $type
 * @property string $status
 * @property string $audience
 * @property list<string>|null $personnel_roles
 * @property string|null $location
 * @property int|null $campus_location_id
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
    'campus_location_id',
    'status',
    'audience',
    'personnel_roles',
    'published_at',
])]
class Announcement extends Model
{
    /** @use HasFactory<AnnouncementFactory> */
    use HasFactory;

    /**
     * Personnel groups an announcement can also be sent to, keyed by user role.
     *
     * @var array<string, string>
     */
    public const PERSONNEL_ROLES = [
        'teacher' => 'Faculty',
        'registrar' => 'Registrar staff',
        'admin' => 'Administrators',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'event_start_at' => 'datetime',
            'event_end_at' => 'datetime',
            'published_at' => 'datetime',
            'personnel_roles' => 'array',
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
     * @return BelongsTo<CampusLocation, $this>
     */
    public function campusLocation(): BelongsTo
    {
        return $this->belongsTo(CampusLocation::class);
    }

    /**
     * Where a notification should send people: the event's spot on the campus
     * map when it has one, otherwise the announcement itself.
     */
    public function publicUrl(): string
    {
        if ($this->type === 'event' && $this->campus_location_id !== null) {
            return route('maps.index', ['location' => $this->campus_location_id, 'event' => $this->slug]);
        }

        return route('announcements.show', $this->slug);
    }

    /**
     * @return MorphMany<Media, $this>
     */
    public function media(): MorphMany
    {
        return $this->morphMany(Media::class, 'mediable');
    }

    /**
     * @return BelongsToMany<Student, $this>
     */
    public function students(): BelongsToMany
    {
        return $this->belongsToMany(Student::class, 'announcement_student');
    }
}
