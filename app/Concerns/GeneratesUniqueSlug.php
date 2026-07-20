<?php

namespace App\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

trait GeneratesUniqueSlug
{
    /**
     * @param  class-string<Model>  $modelClass
     */
    protected function generateUniqueSlug(string $modelClass, string $title): string
    {
        $base = Str::slug($title);
        $slug = $base;
        $suffix = 1;

        while ($modelClass::query()->where('slug', $slug)->exists()) {
            $suffix++;
            $slug = "{$base}-{$suffix}";
        }

        return $slug;
    }
}
