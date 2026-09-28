<?php

use App\Models\Grade;
use App\Models\Student;
use App\Models\TeachingAssignment;
use App\Models\User;
use Illuminate\Http\UploadedFile;

function gradesCsv(string $content): UploadedFile
{
    return UploadedFile::fake()->createWithContent('grades.csv', $content);
}

test('registrar can import k-12 grades and the final grade is averaged from the quarters', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $student = Student::factory()->create(['student_number' => 'LRN-0001']);

    $csv = <<<'CSV'
    student_number,student_name,school_year,subject,q1,q2,q3,q4,final_grade,remarks
    LRN-0001,Juan Dela Cruz,2026-2027,Mathematics,85,87,88,90,,
    LRN-0001,Juan Dela Cruz,2026-2027,English,70,72,74,73,,
    CSV;

    $this->actingAs($registrar)->post(route('admin.grades.import.store'), [
        'grading_system' => 'k12',
        'file' => gradesCsv($csv),
    ])->assertRedirect(route('admin.grades.index'));

    $math = $student->grades()->where('subject', 'Mathematics')->firstOrFail();
    expect((float) $math->final_grade)->toBe(88.0)
        ->and($math->remarks)->toBe('Passed')
        ->and($math->encoded_by)->toBe($registrar->id);

    $english = $student->grades()->where('subject', 'English')->firstOrFail();
    expect($english->remarks)->toBe('Failed');
});

test('re-importing the same subject and period updates the existing grade', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    Student::factory()->create(['student_number' => 'LRN-0001']);

    $header = "student_number,student_name,school_year,subject,q1,q2,q3,q4,final_grade,remarks\n";

    foreach (['85,,,', '85,86,,'] as $quarters) {
        $this->actingAs($registrar)->post(route('admin.grades.import.store'), [
            'grading_system' => 'k12',
            'file' => gradesCsv($header."LRN-0001,,2026-2027,Mathematics,{$quarters},,\n"),
        ]);
    }

    expect(Grade::count())->toBe(1)
        ->and((float) Grade::first()->q2)->toBe(86.0)
        ->and(Grade::first()->final_grade)->toBeNull();
});

test('college grades are stored per term with INC accepted as a final grade', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $student = Student::factory()->create(['student_number' => '2026-00123', 'grading_system' => 'college']);

    $csv = <<<'CSV'
    student_number,student_name,school_year,term,subject_code,subject,units,midterm,final_grade,remarks
    2026-00123,Ana Reyes,2026-2027,1st sem,IT 101,Introduction to Computing,3,1.75,1.50,
    2026-00123,Ana Reyes,2026-2027,1st sem,MATH 101,College Algebra,3,2.00,INC,
    2026-00123,Ana Reyes,2026-2027,1st sem,PE 1,Physical Education,2,,5.00,
    CSV;

    $this->actingAs($registrar)->post(route('admin.grades.import.store'), [
        'grading_system' => 'college',
        'file' => gradesCsv($csv),
    ]);

    $grades = $student->grades()->get()->keyBy('subject');

    expect($grades)->toHaveCount(3)
        ->and($grades['Introduction to Computing']->term)->toBe('1st Semester')
        ->and($grades['Introduction to Computing']->remarks)->toBe('Passed')
        ->and($grades['College Algebra']->final_grade)->toBeNull()
        ->and($grades['College Algebra']->remarks)->toBe('INC')
        ->and($grades['Physical Education']->remarks)->toBe('Failed');

    // GWA only counts graded subjects: (1.50*3 + 5.00*2) / 5
    expect(Grade::averageOf($grades->values(), 'college'))->toBe(2.9);
});

test('rows with invalid data are reported and skipped', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    Student::factory()->create(['student_number' => 'LRN-0001']);
    Student::factory()->create(['student_number' => 'COL-0001', 'grading_system' => 'college']);

    $csv = <<<'CSV'
    student_number,student_name,school_year,subject,q1,q2,q3,q4,final_grade,remarks
    LRN-9999,,2026-2027,Mathematics,85,85,85,85,,
    LRN-0001,,2026,Mathematics,85,85,85,85,,
    LRN-0001,,2026-2027,Mathematics,105,85,85,85,,
    COL-0001,,2026-2027,Mathematics,85,85,85,85,,
    CSV;

    $this->actingAs($registrar)->post(route('admin.grades.import.store'), [
        'grading_system' => 'k12',
        'file' => gradesCsv($csv),
    ])->assertSessionHasNoErrors();

    expect(Grade::count())->toBe(0);
});

test('teachers can only import grades for their assigned subject and section', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    TeachingAssignment::create([
        'user_id' => $teacher->id,
        'subject' => 'Mathematics',
        'section' => 'St. Thomas',
        'school_year' => '2026-2027',
    ]);

    Student::factory()->create(['student_number' => 'LRN-0001', 'section' => 'St. Thomas']);
    Student::factory()->create(['student_number' => 'LRN-0002', 'section' => 'St. Peter']);

    $csv = <<<'CSV'
    student_number,student_name,school_year,subject,q1,q2,q3,q4,final_grade,remarks
    LRN-0001,,2026-2027,mathematics,85,85,85,85,,
    LRN-0001,,2026-2027,English,85,85,85,85,,
    LRN-0002,,2026-2027,Mathematics,85,85,85,85,,
    CSV;

    $this->actingAs($teacher)->post(route('admin.grades.import.store'), [
        'grading_system' => 'k12',
        'file' => gradesCsv($csv),
    ]);

    expect(Grade::count())->toBe(1)
        ->and(Grade::first()->student->student_number)->toBe('LRN-0001');
});

test('teachers only see and delete grades in their assigned classes', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    TeachingAssignment::create([
        'user_id' => $teacher->id,
        'subject' => 'Mathematics',
        'section' => 'St. Thomas',
        'school_year' => '2026-2027',
    ]);

    $mine = Grade::factory()->for(Student::factory()->state(['section' => 'St. Thomas']))->create(['subject' => 'Mathematics']);
    $other = Grade::factory()->for(Student::factory()->state(['section' => 'St. Peter']))->create(['subject' => 'Mathematics']);

    $this->actingAs($teacher)->get(route('admin.grades.index'))
        ->assertInertia(fn ($page) => $page
            ->component('admin/grades/index')
            ->has('grades.data', 1)
            ->where('grades.data.0.id', $mine->id)
        );

    $this->actingAs($teacher)->delete(route('admin.grades.destroy', $other))->assertForbidden();
    $this->actingAs($teacher)->delete(route('admin.grades.destroy', $mine));

    expect(Grade::find($mine->id))->toBeNull()
        ->and(Grade::find($other->id))->not->toBeNull();
});

test('teachers can download a template pre-filled with their class list', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    $assignment = TeachingAssignment::create([
        'user_id' => $teacher->id,
        'subject' => 'Science',
        'section' => 'St. Thomas',
        'school_year' => '2026-2027',
    ]);

    Student::factory()->create(['name' => 'In Section', 'section' => 'St. Thomas']);
    Student::factory()->create(['name' => 'Other Section', 'section' => 'St. Peter']);

    $response = $this->actingAs($teacher)
        ->get(route('admin.grades.import.template', ['system' => 'k12', 'assignment' => $assignment->id]));

    $response->assertOk();
    expect($response->streamedContent())
        ->toContain('In Section')
        ->toContain('Science')
        ->not->toContain('Other Section');

    $otherTeacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    $this->actingAs($otherTeacher)
        ->get(route('admin.grades.import.template', ['system' => 'k12', 'assignment' => $assignment->id]))
        ->assertForbidden();
});
