<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/**
 * A site-wide option stored by key. Values are cached since some are read
 * on every page.
 */
#[Fillable(['key', 'value'])]
class Setting extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'value' => 'array',
        ];
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return Cache::rememberForever(
            "settings.{$key}",
            fn () => static::where('key', $key)->value('value'),
        ) ?? $default;
    }

    public static function put(string $key, mixed $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
        Cache::forget("settings.{$key}");
    }

    public static function forget(string $key): void
    {
        static::where('key', $key)->delete();
        Cache::forget("settings.{$key}");
    }
}
