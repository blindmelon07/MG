<?php

use App\Jobs\SendSmsJob;
use App\Models\Advisory;
use App\Models\Grade;
use App\Models\Guardian;
use App\Models\Section;
use App\Models\Student;
use App\Models\SuspensionNotice;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    schoolYears('2026-2027', '2025-2026');
});

function shsStudent(array $attributes = []): Student
{
    return Student::factory()->create([
        'education_level' => 'shs',
        'grade_level' => 'Grade 11',
        'section' => 'St. Thomas',
        ...$attributes,
    ]);
}

function advisoryFor(User $teacher, array $attributes = []): Advisory
{
    return Advisory::create([
        'user_id' => $teacher->id,
        'education_level' => 'shs',
        'grade_level' => 'Grade 11',
        'section' => 'St. Thomas',
        'school_year' => '2026-2027',
        ...$attributes,
    ]);
}

test('registrar can assign a teacher as a section adviser', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    Section::create(['education_level' => 'shs', 'grade_level' => 'Grade 11', 'name' => 'St. Thomas']);

    $this->actingAs($registrar)->post(route('admin.advisories.store'), [
        'user_id' => $teacher->id,
        'education_level' => 'shs',
        'grade_level' => 'Grade 11',
        'section' => 'st. thomas',
        'school_year' => '2026-2027',
    ])->assertRedirect(route('admin.advisories.index'));

    expect($teacher->advisories()->sole())
        ->section->toBe('St. Thomas')
        ->grade_level->toBe('Grade 11');

    $this->actingAs($registrar)->get(route('admin.advisories.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/advisories/index')
            ->has('advisories', 1)
            ->where('advisories.0.adviser.name', $teacher->name));
});

test('a section has one adviser per school year and must exist', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    $other = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    Section::create(['education_level' => 'shs', 'grade_level' => 'Grade 11', 'name' => 'St. Thomas']);
    advisoryFor($teacher);

    $payload = [
        'user_id' => $other->id,
        'education_level' => 'shs',
        'grade_level' => 'Grade 11',
        'section' => 'St. Thomas',
        'school_year' => '2026-2027',
    ];

    $this->actingAs($registrar)->post(route('admin.advisories.store'), $payload)
        ->assertSessionHasErrors('section');

    $this->actingAs($registrar)->post(route('admin.advisories.store'), [...$payload, 'section' => 'Nowhere'])
        ->assertSessionHasErrors('section');

    $this->actingAs($registrar)->post(route('admin.advisories.store'), [...$payload, 'education_level' => 'jhs', 'grade_level' => 'Grade 8'])
        ->assertSessionHasErrors('education_level');

    expect(Advisory::count())->toBe(1);
});

test('teachers cannot manage advisers', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);

    $this->actingAs($teacher)->get(route('admin.advisories.index'))->assertForbidden();
});

test('an adviser can import grades in any subject for their advisory class only', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    advisoryFor($teacher);
    $advisee = shsStudent(['student_number' => 'LRN-0001']);
    shsStudent(['student_number' => 'LRN-0002', 'section' => 'St. Paul']);
    shsStudent(['student_number' => 'LRN-0003', 'grade_level' => 'Grade 12']);

    $csv = <<<'CSV'
    student_number,student_name,year_level,section,school_year,subject,term_1,term_2,term_3,final_grade,remarks
    LRN-0001,,Grade 11,St. Thomas,2026-2027,General Mathematics,85,87,88,,
    LRN-0001,,Grade 11,St. Thomas,2026-2027,Oral Communication,90,90,90,,
    LRN-0002,,Grade 11,St. Paul,2026-2027,General Mathematics,85,87,88,,
    LRN-0003,,Grade 12,St. Thomas,2026-2027,General Mathematics,85,87,88,,
    LRN-0001,,Grade 11,St. Thomas,2025-2026,General Mathematics,85,87,88,,
    CSV;

    $this->actingAs($teacher)->post(route('admin.grades.import.store'), [
        'grading_system' => 'k12',
        'file' => UploadedFile::fake()->createWithContent('grades.csv', $csv),
    ])->assertRedirect(route('admin.grades.index'));

    expect(Grade::pluck('student_id')->unique()->all())->toBe([$advisee->id])
        ->and(Grade::where('school_year', '2026-2027')->pluck('subject')->sort()->values()->all())
        ->toBe(['General Mathematics', 'Oral Communication'])
        ->and(Grade::count())->toBe(2);

    $this->actingAs($teacher)->get(route('admin.grades.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('grades.data', 2)
            ->has('advisories', 1));
});

test('an adviser can download their advisory class list', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    $advisory = advisoryFor($teacher);
    shsStudent(['student_number' => 'LRN-0001', 'name' => 'Ana Reyes']);
    shsStudent(['student_number' => 'LRN-0002', 'section' => 'St. Paul']);

    $response = $this->actingAs($teacher)->get(route('admin.grades.import.template', ['system' => 'k12', 'advisory' => $advisory->id]));
    $response->assertOk();

    $other = advisoryFor(User::factory()->withTwoFactor()->create(['role' => 'teacher']), ['section' => 'St. Paul']);
    $this->actingAs($teacher)->get(route('admin.grades.import.template', ['system' => 'k12', 'advisory' => $other->id]))
        ->assertForbidden();
});

test('an adviser texts a class suspension notice to their students and guardians', function () {
    Queue::fake();

    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher', 'name' => 'Maria Santos']);
    $advisory = advisoryFor($teacher);
    $student = shsStudent(['phone_number' => '09171234567']);
    Guardian::factory()->for($student)->create(['phone_number' => '09181234567']);
    // Same number twice is texted once.
    Guardian::factory()->for(shsStudent(['phone_number' => '0917 123 4567']))->create(['phone_number' => '09191234567']);
    shsStudent(['phone_number' => '09201234567', 'section' => 'St. Paul']);
    Student::factory()->inactive()->create(['education_level' => 'shs', 'grade_level' => 'Grade 11', 'section' => 'St. Thomas', 'phone_number' => '09211234567']);

    $this->actingAs($teacher)->post(route('admin.advisories.suspension-notices.store', $advisory), [
        'starts_on' => now()->addDay()->toDateString(),
        'ends_on' => now()->addDays(2)->toDateString(),
        'reason' => 'Typhoon signal no. 2',
    ])->assertRedirect(route('admin.advisories.mine'));

    $notice = SuspensionNotice::sole();
    expect($notice->recipient_count)->toBe(3)
        ->and($notice->sent_by)->toBe($teacher->id)
        ->and($notice->message)->toContain('CLASS SUSPENSION: Grade 11 – St. Thomas')
        ->toContain('Typhoon signal no. 2')
        ->toContain('Maria Santos');

    Queue::assertPushed(SendSmsJob::class, 3);
    Queue::assertNotPushed(SendSmsJob::class, fn (SendSmsJob $job) => in_array($job->recipient, ['09201234567', '09211234567'], true));
});

test('only the adviser can send a notice, and not for a past date or a past school year', function () {
    Queue::fake();

    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    $other = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    $advisory = advisoryFor($teacher);
    $past = advisoryFor($teacher, ['school_year' => '2025-2026']);
    shsStudent(['phone_number' => '09171234567']);

    $payload = ['starts_on' => now()->toDateString(), 'reason' => 'Flooding'];

    $this->actingAs($other)->post(route('admin.advisories.suspension-notices.store', $advisory), $payload)
        ->assertForbidden();

    $this->actingAs($teacher)->post(route('admin.advisories.suspension-notices.store', $advisory), [...$payload, 'starts_on' => now()->subDay()->toDateString()])
        ->assertSessionHasErrors('starts_on');

    $this->actingAs($teacher)->post(route('admin.advisories.suspension-notices.store', $past), $payload);

    expect(SuspensionNotice::count())->toBe(0);
    Queue::assertNothingPushed();
});

test('the adviser sees their advisory class and its notices', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    $advisory = advisoryFor($teacher);
    shsStudent(['phone_number' => '09171234567']);
    $advisory->suspensionNotices()->create([
        'starts_on' => '2026-11-09',
        'reason' => 'Typhoon',
        'message' => 'CLASS SUSPENSION',
        'recipient_count' => 1,
    ]);

    $this->actingAs($teacher)->get(route('admin.advisories.mine'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/advisories/mine')
            ->has('advisories', 1)
            ->where('advisories.0.student_count', 1)
            ->where('advisories.0.recipient_count', 1)
            ->where('advisories.0.is_current', true)
            ->has('advisories.0.notices', 1));
});
