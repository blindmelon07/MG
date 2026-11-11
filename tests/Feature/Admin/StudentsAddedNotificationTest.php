<?php

use App\Models\Section;
use App\Models\User;
use App\Notifications\StudentsAdded;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;

uses(RefreshDatabase::class);

beforeEach(function () {
    schoolYears('2026-2027', '2025-2026');

    Section::create(['education_level' => 'jhs', 'grade_level' => 'Grade 8', 'name' => 'St. Thomas']);

    Notification::fake();
});

test('adding a student emails every admin', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $superAdmin = User::factory()->create(['role' => 'super_admin']);
    $registrar = User::factory()->create(['role' => 'registrar']);
    $teacher = User::factory()->create(['role' => 'teacher']);

    $this->actingAs($admin)->post(route('admin.students.store'), [
        'name' => 'Juan Dela Cruz',
        'student_number' => 'LRN-12345678',
        'education_level' => 'jhs',
        'grade_level' => 'Grade 8',
        'section' => 'St. Thomas',
        'phone_number' => null,
        'status' => 'active',
        'guardians' => [
            ['name' => 'Maria Dela Cruz', 'relationship' => 'Mother', 'phone_number' => '09171234567'],
        ],
    ])->assertRedirect(route('admin.students.index'));

    Notification::assertSentTo([$admin, $superAdmin], StudentsAdded::class, function (StudentsAdded $notification, array $channels, User $notifiable) use ($admin) {
        $mail = $notification->toMail($notifiable);

        return $notification->addedBy === $admin->name
            && $notification->schoolYear === '2026-2027'
            && $mail->subject === 'New student added: Juan Dela Cruz'
            && collect($mail->introLines)->contains('**Placement:** Grade 8, St. Thomas');
    });
    Notification::assertNotSentTo([$registrar, $teacher], StudentsAdded::class);
});

test('an import sends one summary email listing the new students', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $header = 'name,student_number,education_level,grade_level,course,section,status,phone_number,guardian_1_name,guardian_1_relationship,guardian_1_phone,guardian_2_name,guardian_2_relationship,guardian_2_phone';

    $this->actingAs($admin)->post(route('admin.students.import.store'), [
        'file' => UploadedFile::fake()->createWithContent('students.csv', $header."\n".implode("\n", [
            'Juan Dela Cruz,LRN-0001,Junior High School,Grade 8,,St. Thomas,active,,Maria Dela Cruz,Mother,09171234567,,,',
            'Ana Reyes,LRN-0002,Junior High School,Grade 8,,St. Thomas,active,,Elena Reyes,Mother,09191234567,,,',
        ])),
    ])->assertRedirect(route('admin.students.index'));

    Notification::assertSentToTimes($admin, StudentsAdded::class, 1);
    Notification::assertSentTo($admin, StudentsAdded::class, function (StudentsAdded $notification) use ($admin) {
        $mail = $notification->toMail($admin);

        return $mail->subject === 'New students imported: 2 students'
            && collect($mail->introLines)->contains('- Ana Reyes (LRN-0002) — Grade 8, St. Thomas');
    });
});

test('an import that adds no new students sends no email', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $header = 'name,student_number,education_level,grade_level,course,section,status,phone_number,guardian_1_name,guardian_1_relationship,guardian_1_phone,guardian_2_name,guardian_2_relationship,guardian_2_phone';

    $this->actingAs($admin)->post(route('admin.students.import.store'), [
        'file' => UploadedFile::fake()->createWithContent('students.csv', $header."\n".'Bad Row,,Junior High School,Grade 8,,St. Thomas,active,,,,,,,'),
    ]);

    Notification::assertNothingSent();
});
