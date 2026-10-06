<?php

namespace App\Models;

use Database\Factories\CampusPanoramaFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/**
 * A 360° (equirectangular) photo taken on campus, and the GPS spot where it
 * was taken. Phones show the one nearest to them, turned by their compass.
 */
#[Fillable(['title', 'path', 'latitude', 'longitude', 'north_offset'])]
class CampusPanorama extends Model
{
    /** @use HasFactory<CampusPanoramaFactory> */
    use HasFactory;

    protected $appends = ['url'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'north_offset' => 'float',
        ];
    }

    /**
     * @return Attribute<string, never>
     */
    protected function url(): Attribute
    {
        return Attribute::get(fn (): string => Storage::disk('public')->url($this->path));
    }
}
