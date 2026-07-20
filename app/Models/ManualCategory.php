<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'slug', 'description', 'sort_order'])]
class ManualCategory extends Model
{
    /**
     * @return HasMany<Manual, $this>
     */
    public function manuals(): HasMany
    {
        return $this->hasMany(Manual::class);
    }
}
