<?php

namespace Database\Seeders;

use App\Models\Announcement;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class AnnouncementSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::where('email', 'admin@aemilianum.edu.ph')->firstOrFail();

        $announcements = [
            [
                'title' => 'Enrollment for AY 2026-2027 Now Open',
                'type' => 'announcement',
                'content' => 'Enrollment for the incoming academic year is now open through the school portal. New and continuing students are encouraged to enroll early to secure their preferred schedule. Visit the Registrar\'s Office for assistance with document requirements.',
                'published_at' => now()->subDays(5),
            ],
            [
                'title' => 'Semestral Break Schedule',
                'type' => 'announcement',
                'content' => 'Classes will be suspended for the semestral break from October 26 to October 30. Regular classes resume on November 2. Offices will remain open on a skeleton workforce basis during the break.',
                'published_at' => now()->subDays(2),
            ],
            [
                'title' => 'Foundation Day Celebration',
                'type' => 'event',
                'content' => 'Join us for a week of games, food fairs, and cultural performances celebrating the founding anniversary of Aemilianum College Inc. All students, faculty, and alumni are welcome to attend.',
                'event_start_at' => now()->addDays(14)->setTime(8, 0),
                'event_end_at' => now()->addDays(14)->setTime(17, 0),
                'location' => 'School Quadrangle',
                'published_at' => now()->subDay(),
            ],
            [
                'title' => 'General Parent-Teacher Assembly',
                'type' => 'event',
                'content' => 'A general assembly for parents and guardians to discuss the first grading period results, school policies, and upcoming activities. Attendance is highly encouraged for at least one parent or guardian per student.',
                'event_start_at' => now()->addDays(7)->setTime(9, 0),
                'event_end_at' => now()->addDays(7)->setTime(11, 30),
                'location' => 'School Gymnasium',
                'published_at' => now(),
            ],
        ];

        foreach ($announcements as $announcement) {
            Announcement::updateOrCreate(
                ['slug' => Str::slug($announcement['title'])],
                [
                    'created_by' => $author->id,
                    'title' => $announcement['title'],
                    'type' => $announcement['type'],
                    'content' => $announcement['content'],
                    'event_start_at' => $announcement['event_start_at'] ?? null,
                    'event_end_at' => $announcement['event_end_at'] ?? null,
                    'location' => $announcement['location'] ?? null,
                    'status' => 'published',
                    'published_at' => $announcement['published_at'],
                ],
            );
        }
    }
}
