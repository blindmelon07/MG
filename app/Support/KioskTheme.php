<?php

namespace App\Support;

use App\Models\Setting;

/**
 * The colors visitors see on the kiosk and student portal. Admins can
 * change each one for light and dark screens; anything not set falls back
 * to the built-in look.
 */
class KioskTheme
{
    public const SETTING = 'kiosk_theme';

    /** The built-in colors, matching resources/css/app.css. */
    public const DEFAULTS = [
        'light' => [
            'background' => '#ffffff',
            'foreground' => '#0a0a0a',
            'card' => '#ffffff',
            'card-foreground' => '#0a0a0a',
            'primary' => '#171717',
            'primary-foreground' => '#fafafa',
            'secondary' => '#f5f5f5',
            'secondary-foreground' => '#171717',
            'accent' => '#f5f5f5',
            'accent-foreground' => '#171717',
            'muted' => '#f5f5f5',
            'muted-foreground' => '#737373',
            'border' => '#e5e5e5',
            'destructive' => '#e7000b',
        ],
        'dark' => [
            'background' => '#0a0a0a',
            'foreground' => '#fafafa',
            'card' => '#0a0a0a',
            'card-foreground' => '#fafafa',
            'primary' => '#fafafa',
            'primary-foreground' => '#171717',
            'secondary' => '#262626',
            'secondary-foreground' => '#fafafa',
            'accent' => '#262626',
            'accent-foreground' => '#fafafa',
            'muted' => '#262626',
            'muted-foreground' => '#a3a3a3',
            'border' => '#262626',
            'destructive' => '#82181a',
        ],
    ];

    /**
     * The saved colors over the defaults, or null when nothing is saved.
     *
     * @return array{light: array<string, string>, dark: array<string, string>}|null
     */
    public static function saved(): ?array
    {
        $saved = Setting::get(self::SETTING);

        if (! is_array($saved)) {
            return null;
        }

        return [
            'light' => [...self::DEFAULTS['light'], ...array_intersect_key($saved['light'] ?? [], self::DEFAULTS['light'])],
            'dark' => [...self::DEFAULTS['dark'], ...array_intersect_key($saved['dark'] ?? [], self::DEFAULTS['dark'])],
        ];
    }

    /**
     * @return array{light: array<string, string>, dark: array<string, string>}
     */
    public static function current(): array
    {
        return self::saved() ?? self::DEFAULTS;
    }

    /**
     * @return list<string>
     */
    public static function keys(): array
    {
        return array_keys(self::DEFAULTS['light']);
    }
}
