<?php

namespace App\Support;

use App\Models\CampusLocation;
use App\Models\Setting;

/**
 * Where the kiosk itself stands on the campus map (map percent), so it can
 * show "You are here" and draw routes from that spot, mall-directory style.
 */
class KioskPosition
{
    public const SETTING = 'kiosk_position';

    /**
     * @return array{x: float, y: float}|null
     */
    public static function saved(): ?array
    {
        $value = Setting::get(self::SETTING);

        return is_array($value) && isset($value['x'], $value['y'])
            ? ['x' => (float) $value['x'], 'y' => (float) $value['y']]
            : null;
    }

    /**
     * The saved spot, or the Main Gate until an admin places the kiosk.
     *
     * @return array{x: float, y: float}
     */
    public static function current(): array
    {
        if ($saved = self::saved()) {
            return $saved;
        }

        $gate = CampusLocation::where('name', 'like', '%main gate%')->first(['x', 'y']);

        return $gate
            ? ['x' => (float) $gate->x, 'y' => (float) $gate->y]
            : ['x' => 50.0, 'y' => 90.0];
    }
}
