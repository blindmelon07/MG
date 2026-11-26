<?php

namespace Database\Seeders;

use App\Models\CampusLocation;
use App\Models\FloorPlan;
use Illuminate\Database\Seeder;

class FloorPlanSeeder extends Seeder
{
    /**
     * Seed the floor plans traced from the school's posted floor signs
     * (data/floor-plans.json). A building that already has a plan, or isn't
     * on the campus map, is left alone.
     */
    public function run(): void
    {
        $plans = json_decode((string) file_get_contents(__DIR__.'/data/floor-plans.json'), true);

        foreach ($plans as $plan) {
            $location = CampusLocation::where('name', $plan['building'])->first();

            if (! $location || FloorPlan::where('campus_location_id', $location->id)->exists()) {
                continue;
            }

            FloorPlan::create([
                'campus_location_id' => $location->id,
                'floor' => $plan['floor'],
                'width' => $plan['width'],
                'depth' => $plan['depth'],
                'meters_per_unit' => $plan['metersPerUnit'],
                'site_x0' => $plan['site']['x0'],
                'site_y0' => $plan['site']['y0'],
                'site_x1' => $plan['site']['x1'],
                'site_y1' => $plan['site']['y1'],
                'rooms' => $plan['rooms'],
                'halls' => $plan['halls'],
                'entrances' => $plan['entrances'],
            ]);
        }
    }
}
