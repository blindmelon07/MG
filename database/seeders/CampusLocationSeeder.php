<?php

namespace Database\Seeders;

use App\Models\CampusLocation;
use Illuminate\Database\Seeder;

class CampusLocationSeeder extends Seeder
{
    /**
     * Seed the pins for the Aemilianum College campus map.
     *
     * x/y are percentages across the 3D site plan in campus-map.tsx.
     */
    public function run(): void
    {
        $locations = [
            ['Main Gate', 'Main entrance from the road to Sorsogon City proper.', 47.9, 92.0],
            ['Main Building', 'High School, Tertiary, Principal\'s Office, Registrar and Cashier\'s Office, AITV5, Library, Computer Laboratories, Audio Visual Room, Guidance Office, Dean\'s Office, Auditorium, Conference Hall, Chemistry Laboratory.', 66.6, 55.5],
            ['AIT Building', 'Computer Hardware Servicing, Architectural, Electronics, Electrical, and Machine, Welding and Fabrication Laboratories; School Director\'s Office.', 65.2, 9.7],
            ['ACI Gymnasium', 'School Clinic, TLE Room, Supply Office, School Dormitory, Music Room.', 26.2, 50.0],
            ['St. Jerome Emiliani Chapel', null, 44.5, 60.9],
            ['Convent', null, 52.6, 35.7],
            ['Automotive Laboratory', null, 90.7, 29.4],
            ['ACI Quadrangle', 'Volleyball court and stage.', 79.5, 55.5],
            ['Soccer Field', null, 67.6, 83.6],
            ['Basketball Court', null, 88.0, 85.7],
            ['Canteen', null, 97.9, 34.9],
            ['College of Law', 'Aemilianum College Inc. – College of Law, across the parking lot from the gymnasium.', 13.8, 84.4],
            ['Parking Space', null, 42.4, 80.6],
            ['I ♥ ACI Sign', 'Landmark photo spot on the front lawn beside the Main Building entrance.', 68.4, 74.5],
            ['Restrooms', 'Male and female comfort rooms beside the covered walk.', 62.8, 37.0],
        ];

        foreach ($locations as $order => [$name, $description, $x, $y]) {
            CampusLocation::updateOrCreate(
                ['name' => $name],
                [
                    'description' => $description,
                    'x' => $x,
                    'y' => $y,
                    'sort_order' => $order,
                ],
            );
        }
    }
}
