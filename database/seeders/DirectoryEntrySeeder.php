<?php

namespace Database\Seeders;

use App\Models\CampusLocation;
use App\Models\DirectoryEntry;
use Illuminate\Database\Seeder;

class DirectoryEntrySeeder extends Seeder
{
    /**
     * Seed the School Directory with the offices named on the campus map
     * and the Main Building's ground-floor sign. Phone numbers and hours are
     * left for an admin to fill in, since they aren't known here.
     */
    public function run(): void
    {
        $offices = [
            // [name, building, where inside, floor plan room key, description]
            ["Registrar's Office", 'Main Building', 'Ground floor, office block beside the quadrangle', 'registrar', 'Enrollment, records, transcripts and certifications.'],
            ["Cashier's Office", 'Main Building', 'Ground floor, office block beside the quadrangle', 'cashier', 'Tuition and fee payments.'],
            ["Principal's Office", 'Main Building', 'Ground floor, office block beside the quadrangle', 'principal', null],
            ['School Clinic', 'Main Building', 'Ground floor, office block beside the quadrangle', 'clinic', 'First aid and health concerns.'],
            ['Quality Assurance Office', 'Main Building', 'Ground floor, high school wing', 'quality-assurance', null],
            ['High School Faculty Room', 'Main Building', 'Ground floor, high school wing', 'hs-faculty', null],
            ['Audio Visual Room (AVR)', 'Main Building', 'Ground floor, high school wing', 'avr', null],
            ['Science Laboratory', 'Main Building', 'Ground floor, college wing', 'science-lab', null],
            ["Dean's Office", 'Main Building', null, null, null],
            ['Guidance Office', 'Main Building', null, null, 'Counseling and student concerns.'],
            ['Library', 'Main Building', null, null, null],
            ["School Director's Office", 'AIT Building', null, null, null],
            ['Supply Office', 'ACI Gymnasium', null, null, null],
        ];

        foreach ($offices as $order => [$name, $building, $room, $floorRoom, $description]) {
            $locationId = CampusLocation::where('name', $building)->value('id');
            $entry = DirectoryEntry::firstOrCreate(
                ['category' => 'office', 'name' => $name],
                [
                    'description' => $description,
                    'campus_location_id' => $locationId,
                    'room' => $room,
                    'floor_room' => $floorRoom,
                    'sort_order' => $order,
                ],
            );

            // Entries seeded before the floor plan existed get placed on it,
            // without touching ones an admin has already pointed at a room.
            if ($floorRoom !== null && $entry->floor_room === null) {
                $entry->update([
                    'campus_location_id' => $locationId,
                    'room' => $entry->room ?? $room,
                    'floor_room' => $floorRoom,
                ]);
            }
        }

        DirectoryEntry::firstOrCreate(
            ['category' => 'hotline', 'name' => 'National Emergency Hotline'],
            ['phone' => '911', 'description' => 'Police, fire and medical emergencies.', 'sort_order' => 0],
        );
    }
}
