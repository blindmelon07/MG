<?php

namespace App\Models;

use Database\Factories\CampusLocationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name', 'description', 'x', 'y', 'sort_order'])]
class CampusLocation extends Model
{
    /** @use HasFactory<CampusLocationFactory> */
    use HasFactory;

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
}
