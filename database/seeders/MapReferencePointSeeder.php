<?php

namespace Database\Seeders;

use App\Models\MapReferencePoint;
use Illuminate\Database\Seeder;

class MapReferencePointSeeder extends Seeder
{
    /**
     * Add GPS calibration points that fill gaps left by the ones entered in
     * the admin panel. Existing points are never changed or removed, and
     * running this twice doesn't add duplicates.
     *
     * Coordinates: the driveway is halfway between the admin's Main Gate and
     * chapel points; the Main Building corners come from its OpenStreetMap
     * outline. x/y are percentages across the 3D site plan in campus-map.tsx.
     */
    public function run(): void
    {
        $points = [
            ['Driveway middle', 12.9707205, 123.9940830, 46.2, 82.1],
            ['Main Building, north-east corner', 12.9704316, 123.9940209, 51.6, 73.0],
            ['Main Building, north-west corner', 12.9704384, 123.9931373, 100.0, 73.0],
            ['Main Building, south-west corner', 12.9700216, 123.9932460, 97.7, 39.5],
        ];

        foreach ($points as [$label, $latitude, $longitude, $x, $y]) {
            MapReferencePoint::firstOrCreate(
                ['label' => $label],
                [
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                    'x' => $x,
                    'y' => $y,
                ],
            );
        }
    }
}
