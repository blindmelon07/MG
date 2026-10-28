<?php

use App\Jobs\SendSmsJob;
use App\Models\Course;
use App\Models\Guardian;
use App\Models\Section;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    schoolYears('2026-2027', '2025-2026');

    Section::create(['education_level' => 'jhs', 'grade_level' => 'Grade 8', 'name' => 'St. Thomas']);
    Section::create(['education_level' => 'jhs', 'grade_level' => 'Grade 7', 'name' => 'St. Peter']);
});

function newStudentPayload(array $overrides = []): array
{
    return [
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
        ...$overrides,
    ];
}

test('admin can view the student list', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Student::factory()->has(Guardian::factory())->create();

    $response = $this->actingAs($admin)->get(route('admin.students.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/students/index')
        ->has('students.data', 1)
        ->where('students.data.0.enrollment.school_year', '2026-2027')
    );
});

test('the student list shows the school year being viewed', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $student = Student::factory()->create(['grade_level' => 'Grade 8', 'section' => 'St. Thomas']);
    $student->enroll('2025-2026', ['education_level' => 'jhs', 'grade_level' => 'Grade 7', 'section' => 'St. Peter']);
    Student::factory()->create();

    $this->actingAs($admin)->post(route('admin.school-year.select'), ['school_year' => '2025-2026']);

    $this->get(route('admin.students.index'))
        ->assertInertia(fn ($page) => $page
            ->has('students.data', 1)
            ->where('students.data.0.enrollment.grade_level', 'Grade 7')
            ->where('counts', ['enrolled' => 1, 'none' => 1])
        );

    $this->get(route('admin.students.index', ['enrollment' => 'none']))
        ->assertInertia(fn ($page) => $page->has('students.data', 1));
});

test('admin can create a student with guardians', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $response = $this->actingAs($admin)->post(route('admin.students.store'), newStudentPayload([
        'guardians' => [
            ['name' => 'Maria Dela Cruz', 'relationship' => 'Mother', 'phone_number' => '09171234567'],
            ['name' => 'Jose Dela Cruz', 'relationship' => 'Father', 'phone_number' => '09181234567'],
        ],
    ]));

    $response->assertRedirect(route('admin.students.index'));

    $student = Student::where('name', 'Juan Dela Cruz')->firstOrFail();
    expect($student->guardians)->toHaveCount(2)
        ->and($student->grading_system)->toBe('k12')
        ->and($student->enrollments()->pluck('school_year')->all())->toBe(['2026-2027'])
        ->and($student->password)->toBeNull();
});

test('adding a student can text the login to the student and every guardian', function () {
    Queue::fake();
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->post(route('admin.students.store'), newStudentPayload([
        'phone_number' => '09991234567',
        'send_credentials' => '1',
        'guardians' => [
            ['name' => 'Maria Dela Cruz', 'relationship' => 'Mother', 'phone_number' => '09171234567'],
            ['name' => 'Jose Dela Cruz', 'relationship' => 'Father', 'phone_number' => '09181234567'],
        ],
    ]))->assertInertiaFlash('credentials.sms_recipients', 3);

    $student = Student::where('student_number', 'LRN-12345678')->firstOrFail();
    expect($student->password)->not->toBeNull()
        ->and($student->must_change_password)->toBeTrue();

    Queue::assertPushed(SendSmsJob::class, 3);
    Queue::assertPushed(fn (SendSmsJob $job) => $job->recipient === '09991234567'
        && str_contains($job->message, 'LRN-12345678')
        && $job->connection === 'deferred');
});

test('a student added while viewing a past year is only enrolled in that year', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->post(route('admin.school-year.select'), ['school_year' => '2025-2026']);
    $this->post(route('admin.students.store'), newStudentPayload())->assertRedirect();

    $student = Student::where('student_number', 'LRN-12345678')->firstOrFail();
    expect($student->enrollments()->pluck('school_year')->all())->toBe(['2025-2026']);
});

test('the year level must belong to the chosen education level', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->post(route('admin.students.store'), newStudentPayload([
        'education_level' => 'shs',
    ]))->assertSessionHasErrors('grade_level');
});

test('the section must be one listed for the year level', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->post(route('admin.students.store'), newStudentPayload([
        'section' => 'St. Peter',
    ]))->assertSessionHasErrors('section');
});

test('college students need a course and get the college grading system', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $course = Course::create(['code' => 'BSIT', 'name' => 'BS Information Technology', 'education_level' => 'college', 'units' => 160]);
    Section::create(['education_level' => 'college', 'grade_level' => '1st Year', 'course_id' => $course->id, 'name' => 'BSIT 1-A']);

    $payload = newStudentPayload([
        'student_number' => 'C-2026-001',
        'education_level' => 'college',
        'grade_level' => '1st Year',
        'section' => 'BSIT 1-A',
    ]);

    $this->actingAs($admin)->post(route('admin.students.store'), $payload)->assertSessionHasErrors('course_id');

    $this->post(route('admin.students.store'), [...$payload, 'course_id' => $course->id])
        ->assertRedirect(route('admin.students.index'));

    $student = Student::where('student_number', 'C-2026-001')->firstOrFail();
    expect($student->grading_system)->toBe('college')
        ->and($student->course_id)->toBe($course->id)
        ->and($student->enrollmentFor('2026-2027')->course_id)->toBe($course->id);
});

test('student details are required and phone numbers must be exactly 11 digits', function (string $phone) {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->post(route('admin.students.store'), [
        'name' => 'Juan Dela Cruz',
        'phone_number' => $phone,
        'status' => 'active',
        'guardians' => [['name' => 'Maria', 'relationship' => 'Mother', 'phone_number' => $phone]],
    ])->assertSessionHasErrors([
        'student_number', 'education_level', 'grade_level', 'section',
        'phone_number', 'guardians.0.phone_number',
    ]);
})->with(['0917123456', '091712345678', '+639171234567', '639171234567', '0917-123-4567']);

test('creating a student requires at least one guardian', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $response = $this->actingAs($admin)->post(route('admin.students.store'), [
        'name' => 'Juan Dela Cruz',
        'status' => 'active',
        'guardians' => [],
    ]);

    $response->assertSessionHasErrors('guardians');
});

test('admin can update a student and sync guardians', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $student = Student::factory()->create(['grade_level' => 'Grade 8', 'section' => 'St. Thomas']);
    $keptGuardian = Guardian::factory()->for($student)->create();
    $removedGuardian = Guardian::factory()->for($student)->create();

    $response = $this->actingAs($admin)->put(route('admin.students.update', $student), newStudentPayload([
        'name' => $student->name,
        'student_number' => $student->student_number,
        'grade_level' => 'Grade 7',
        'section' => 'St. Peter',
        'guardians' => [
            ['id' => $keptGuardian->id, 'name' => $keptGuardian->name, 'relationship' => $keptGuardian->relationship, 'phone_number' => $keptGuardian->phone_number],
            ['name' => 'New Guardian', 'relationship' => 'Guardian', 'phone_number' => '09171234567'],
        ],
    ]));

    $response->assertRedirect(route('admin.students.index'));

    $student->refresh();
    expect($student->guardians)->toHaveCount(2)
        ->and($student->guardians->pluck('id'))->not->toContain($removedGuardian->id)
        ->and($student->section)->toBe('St. Peter')
        ->and($student->enrollmentFor('2026-2027')->section)->toBe('St. Peter');
});

test('editing a past school year changes only that year', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $student = Student::factory()->has(Guardian::factory())->create(['grade_level' => 'Grade 8', 'section' => 'St. Thomas']);
    $guardian = $student->guardians->first();

    $this->actingAs($admin)->post(route('admin.school-year.select'), ['school_year' => '2025-2026']);

    $this->put(route('admin.students.update', $student), newStudentPayload([
        'name' => $student->name,
        'student_number' => $student->student_number,
        'grade_level' => 'Grade 7',
        'section' => 'St. Peter',
        'guardians' => [['id' => $guardian->id, 'name' => $guardian->name, 'relationship' => $guardian->relationship, 'phone_number' => $guardian->phone_number]],
    ]))->assertRedirect();

    $student->refresh();
    expect($student->section)->toBe('St. Thomas')
        ->and($student->enrollmentFor('2026-2027')->section)->toBe('St. Thomas')
        ->and($student->enrollmentFor('2025-2026')->grade_level)->toBe('Grade 7');
});

test('admin can delete a student', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $student = Student::factory()->create();

    $this->actingAs($admin)->delete(route('admin.students.destroy', $student));

    expect(Student::find($student->id))->toBeNull();
});
