<?php

namespace App\Models;

use Database\Factories\CampusLocationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Storage;

#[Fillable(['name', 'description', 'x', 'y', 'sort_order'])]
class CampusLocation extends Model
{
    /** @use HasFactory<CampusLocationFactory> */
    use HasFactory;

    protected $hidden = ['photo_path'];

    protected $appends = ['photo_url'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'x' => 'float',
            'y' => 'float',
        ];
    }

    /**
     * The building's indoor floor plan, if one has been drawn.
     *
     * @return HasOne<FloorPlan, $this>
     */
    public function floorPlan(): HasOne
    {
        return $this->hasOne(FloorPlan::class);
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function photoUrl(): Attribute
    {
        return Attribute::get(fn (): ?string => $this->photo_path
            ? Storage::disk('public')->url($this->photo_path)
            : null);
    }
}
