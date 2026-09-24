<?php

namespace App\Models;

use Database\Factories\MapReferencePointFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * A GPS reading taken on campus, paired with the map spot (x/y percent)
 * where it was taken. Two or more of these line phone GPS up with the map.
 */
#[Fillable(['label', 'latitude', 'longitude', 'accuracy', 'x', 'y'])]
class MapReferencePoint extends Model
{
    /** @use HasFactory<MapReferencePointFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'accuracy' => 'float',
            'x' => 'float',
            'y' => 'float',
        ];
    }
}
