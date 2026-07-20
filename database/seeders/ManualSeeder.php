<?php

namespace Database\Seeders;

use App\Models\Manual;
use App\Models\ManualCategory;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ManualSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::where('email', 'admin@aemilianum.edu.ph')->firstOrFail();

        $categories = [
            'Student Handbook' => [
                'description' => 'Rules, conduct, and general policies for students.',
                'manuals' => [
                    'Attendance Policy' => 'Students are required to maintain at least 80% attendance per subject each grading period. Three consecutive unexcused absences will result in a warning letter to the student and parent/guardian. Excuse letters must be submitted to the class adviser within two school days of the absence.',
                    'Dress Code and Uniform Policy' => 'Students must wear the prescribed school uniform from Monday to Thursday, and the official PE uniform on scheduled PE days. Friday is designated as a free-dress day, subject to the institution\'s decency guidelines. ID lace and school ID must be worn at all times within the campus.',
                    'Code of Conduct' => 'Students are expected to display courtesy, honesty, and respect toward faculty, staff, and fellow students at all times. Bullying, cheating, and vandalism are subject to disciplinary action ranging from a warning to suspension, depending on severity, as determined by the Student Discipline Committee.',
                ],
            ],
            'Academic Policies' => [
                'description' => 'Grading, exams, and academic standing policies.',
                'manuals' => [
                    'Grading System' => 'Grades are computed using Written Work (30%), Performance Tasks (50%), and Quarterly Assessment (20%). The passing grade for all subjects is 75%. Students with a final grade below 75% in any subject are required to attend remedial classes before the next grading period.',
                    'Examination Guidelines' => 'Quarterly examinations are administered on the dates set by the Academic Affairs Office. Students must present a valid school ID before entering the examination room. Special examinations are granted only for excused absences with a medical certificate or equivalent documentation.',
                ],
            ],
            'Admission & Enrollment' => [
                'description' => 'Requirements and procedures for new and returning students.',
                'manuals' => [
                    'Admission Requirements' => 'New students must submit a Form 138 (Report Card), PSA Birth Certificate, Certificate of Good Moral Character, and two 2x2 ID photos. Transferee students must additionally submit a transfer credential from their previous school.',
                    'Enrollment Procedure' => 'Enrollment is conducted online through the school portal, followed by document verification and payment of fees at the Registrar\'s Office. Continuing students are given priority enrollment during the two weeks before the start of the new academic year.',
                ],
            ],
            'Campus Services' => [
                'description' => 'Support services available to students, faculty, and visitors.',
                'manuals' => [
                    'Library Services' => 'The library is open Monday to Friday, 7:30 AM to 5:00 PM, and Saturday, 8:00 AM to 12:00 PM. Students may borrow up to three books for a maximum of seven days. Reference materials and periodicals are for library use only.',
                    'Guidance and Counseling Services' => 'The Guidance Office provides academic, personal, and career counseling to all students free of charge. Walk-in consultations are available during school hours, and appointments can be scheduled through the class adviser.',
                    'Clinic and Health Services' => 'The school clinic is staffed by a school nurse from 7:00 AM to 5:00 PM on school days. Students requiring medication must have a written request from a parent or guardian on file with the clinic.',
                ],
            ],
        ];

        foreach ($categories as $categoryName => $data) {
            $category = ManualCategory::updateOrCreate(
                ['slug' => Str::slug($categoryName)],
                [
                    'name' => $categoryName,
                    'description' => $data['description'],
                    'sort_order' => 0,
                ],
            );

            foreach ($data['manuals'] as $title => $content) {
                Manual::updateOrCreate(
                    ['slug' => Str::slug($title)],
                    [
                        'manual_category_id' => $category->id,
                        'created_by' => $author->id,
                        'title' => $title,
                        'content' => $content,
                        'status' => 'published',
                        'published_at' => now(),
                    ],
                );
            }
        }
    }
}
