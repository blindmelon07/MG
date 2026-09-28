<?php

namespace Database\Seeders;

use App\Models\Student;
use Illuminate\Database\Seeder;

/**
 * Removes everything DemoGradesSeeder created: the DEMO students, and with
 * them their grades and grade history. Real students are never touched.
 *
 *   php artisan db:seed --class=RemoveDemoGradesSeeder
 */
class RemoveDemoGradesSeeder extends Seeder
{
    public function run(): void
    {
        // Grades and grade history are removed with each student (cascading keys).
        $count = Student::where('student_number', 'like', DemoGradesSeeder::PREFIX.'%')->delete();

        $this->command->info("Removed {$count} demo student(s) and their grades.");
    }
}
