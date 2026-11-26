<?php

namespace App\Models;

use Database\Factories\FloorPlanFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * One floor of a building, drawn as rooms, hallways and entrances in plan
 * units (x east, y south), for walking visitors from the door to an office.
 */
#[Fillable(['campus_location_id', 'floor', 'width', 'depth', 'meters_per_unit', 'site_x0', 'site_y0', 'site_x1', 'site_y1', 'rooms', 'halls', 'entrances'])]
class FloorPlan extends Model
{
    /** @use HasFactory<FloorPlanFactory> */
    use HasFactory;

    public const ROOM_KINDS = ['office', 'classroom', 'lab', 'stairs', 'open', 'outside'];

    public const SIDES = ['north', 'south', 'east', 'west'];

    protected $hidden = ['image_path'];

    protected $appends = ['image_url'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'width' => 'float',
            'depth' => 'float',
            'meters_per_unit' => 'float',
            'site_x0' => 'float',
            'site_y0' => 'float',
            'site_x1' => 'float',
            'site_y1' => 'float',
            'rooms' => 'array',
            'halls' => 'array',
            'entrances' => 'array',
        ];
    }

    /**
     * @return BelongsTo<CampusLocation, $this>
     */
    public function campusLocation(): BelongsTo
    {
        return $this->belongsTo(CampusLocation::class);
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function imageUrl(): Attribute
    {
        return Attribute::get(fn (): ?string => $this->image_path
            ? Storage::disk('public')->url($this->image_path)
            : null);
    }

    /**
     * Room keys offices can point at.
     *
     * @return list<string>
     */
    public function roomKeys(): array
    {
        return array_values(array_map(fn (array $room) => $room['key'], $this->rooms ?? []));
    }

    /**
     * The shape the kiosk's indoor routing reads (FloorPlan in
     * resources/js/lib/floor-plans.ts).
     *
     * @return array<string, mixed>
     */
    public function toWayfinding(): array
    {
        return [
            'id' => $this->id,
            'campusLocationId' => $this->campus_location_id,
            'building' => $this->campusLocation?->name ?? '',
            'floor' => $this->floor,
            'width' => $this->width,
            'depth' => $this->depth,
            'metersPerUnit' => $this->meters_per_unit,
            'site' => [
                'x0' => $this->site_x0,
                'y0' => $this->site_y0,
                'x1' => $this->site_x1,
                'y1' => $this->site_y1,
            ],
            'rooms' => $this->rooms,
            'halls' => $this->halls,
            'entrances' => $this->entrances,
            'imageUrl' => $this->image_url,
        ];
    }
}
