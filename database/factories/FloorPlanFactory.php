<?php

namespace Database\Factories;

use App\Models\CampusLocation;
use App\Models\FloorPlan;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FloorPlan>
 */
class FloorPlanFactory extends Factory
{
    /**
     * A small building: one office and a hallway, entered from the south.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'campus_location_id' => CampusLocation::factory(),
            'floor' => 'Ground floor',
            'width' => 20,
            'depth' => 10,
            'meters_per_unit' => 1,
            'site_x0' => 40,
            'site_y0' => 40,
            'site_x1' => 50,
            'site_y1' => 45,
            'rooms' => [
                ['key' => 'registrar', 'name' => 'Registrar', 'kind' => 'office', 'x' => 0, 'y' => 0, 'w' => 6, 'd' => 5, 'door' => 'south'],
            ],
            'halls' => [
                ['x' => 0, 'y' => 5, 'w' => 20, 'd' => 3],
            ],
            'entrances' => [
                ['key' => 'south', 'name' => 'the main door', 'at' => ['x' => 10, 'y' => 8], 'inward' => 'north'],
            ],
        ];
    }
}
