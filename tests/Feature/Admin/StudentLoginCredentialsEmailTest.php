<?php

use App\Models\Section;
use App\Models\Student;
use App\Models\User;
use App\Notifications\StudentLoginCredentials;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    schoolYears('2026-2027', '2025-2026');

    Section::create(['education_level' => 'jhs', 'grade_level' => 'Grade 8', 'name' => 'St. Thomas']);

    Notification::fake();
    Queue::fake();
});

function studentWithEmail(array $overrides = []): array
{
    return [
        'name' => 'Juan Dela Cruz',
        'student_number' => 'LRN-12345678',
        'email' => 'juan@example.com',
        'education_level' => 'jhs',
        'grade_level' => 'Grade 8',
        'section' => 'St. Thomas',
        'phone_number' => null,
        'status' => 'active',
        'guardians' => [
            ['name' => 'Maria Dela Cruz', 'relationship' => 'Mother', 'phone_number' => '09171234567'],
        ],
        ...$overrides,
    ];
}

test('adding a student emails them their portal login', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)
        ->post(route('admin.students.store'), studentWithEmail(['send_credentials' => '1']))
        ->assertRedirect(route('admin.students.index'))
        ->assertInertiaFlash('credentials.emailed_to', 'juan@example.com');

    $student = Student::where('student_number', 'LRN-12345678')->firstOrFail();
    expect($student->email)->toBe('juan@example.com');

    Notification::assertSentTo($student, StudentLoginCredentials::class, function (StudentLoginCredentials $notification) use ($student) {
        $mail = $notification->toMail($student);

        return Hash::check($notification->password, $student->password)
            && collect($mail->introLines)->contains('**Student number:** LRN-12345678')
            && collect($mail->introLines)->contains("**Temporary password:** {$notification->password}");
    });
});

test('the login email is encrypted while it waits in the queue', function () {
    expect(new StudentLoginCredentials('secret'))
        ->toBeInstanceOf(ShouldBeEncrypted::class)
        ->toBeInstanceOf(ShouldQueue::class);
});

test('no login email when credentials are not sent or there is no email', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->post(route('admin.students.store'), studentWithEmail());
    $this->actingAs($admin)->post(route('admin.students.store'), studentWithEmail([
        'student_number' => 'LRN-2',
        'email' => null,
        'send_credentials' => '1',
    ]))->assertInertiaFlash('credentials.emailed_to', null);

    Notification::assertNotSentTo(Student::all(), StudentLoginCredentials::class);
});

test('a student email must be valid', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)
        ->post(route('admin.students.store'), studentWithEmail(['email' => 'not-an-email']))
        ->assertSessionHasErrors('email');
});

test('importing students emails the login to those with an email', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $header = 'name,student_number,education_level,grade_level,course,section,status,phone_number,email,guardian_1_name,guardian_1_relationship,guardian_1_phone';

    $this->actingAs($admin)->post(route('admin.students.import.store'), [
        'send_credentials' => '1',
        'file' => UploadedFile::fake()->createWithContent('students.csv', $header."\n".implode("\n", [
            'Juan Dela Cruz,LRN-0001,Junior High School,Grade 8,,St. Thomas,active,,juan@example.com,Maria Dela Cruz,Mother,09171234567',
            'Ana Reyes,LRN-0002,Junior High School,Grade 8,,St. Thomas,active,,,Elena Reyes,Mother,09191234567',
            'Bad Email,LRN-0003,Junior High School,Grade 8,,St. Thomas,active,,nope,Elena Reyes,Mother,09191234567',
        ])),
    ])->assertRedirect(route('admin.students.index'));

    $juan = Student::where('student_number', 'LRN-0001')->firstOrFail();

    Notification::assertSentTo($juan, StudentLoginCredentials::class);
    Notification::assertNotSentTo(Student::where('student_number', 'LRN-0002')->firstOrFail(), StudentLoginCredentials::class);
    expect(Student::where('student_number', 'LRN-0003')->exists())->toBeFalse();
});
