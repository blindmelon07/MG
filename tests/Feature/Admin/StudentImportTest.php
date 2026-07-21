<?php

use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;

uses(RefreshDatabase::class);

function studentImportCsv(string $content): UploadedFile
{
    return UploadedFile::fake()->createWithContent('students.csv', $content);
}

test('admin can download the csv template', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $response = $this->actingAs($admin)->get(route('admin.students.import.template'));

    $response->assertOk();
    $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
    expect($response->streamedContent())->toContain('guardian_1_name');
});

test('importing a csv creates students with their guardians', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $csv = <<<'CSV'
    name,student_number,grade_level,section,status,phone_number,guardian_1_name,guardian_1_relationship,guardian_1_phone,guardian_2_name,guardian_2_relationship,guardian_2_phone
    Juan Dela Cruz,LRN-0001,Grade 8,St. Thomas,active,,Maria Dela Cruz,Mother,09171234567,Jose Dela Cruz,Father,09181234567
    Ana Reyes,LRN-0002,Grade 7,St. Peter,active,,Elena Reyes,Mother,09191234567,,,
    CSV;

    $this->actingAs($admin)->post(route('admin.students.import.store'), [
        'file' => studentImportCsv($csv),
    ])->assertRedirect(route('admin.students.index'));

    $juan = Student::where('student_number', 'LRN-0001')->firstOrFail();
    expect($juan->guardians)->toHaveCount(2);

    $ana = Student::where('student_number', 'LRN-0002')->firstOrFail();
    expect($ana->guardians)->toHaveCount(1);
});

test('importing skips rows whose student number already exists', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Student::factory()->create(['student_number' => 'LRN-0001']);

    $csv = <<<'CSV'
    name,student_number,grade_level,section,status,phone_number,guardian_1_name,guardian_1_relationship,guardian_1_phone,guardian_2_name,guardian_2_relationship,guardian_2_phone
    Juan Dela Cruz,LRN-0001,Grade 8,St. Thomas,active,,Maria Dela Cruz,Mother,09171234567,,,
    CSV;

    $this->actingAs($admin)->post(route('admin.students.import.store'), [
        'file' => studentImportCsv($csv),
    ]);

    expect(Student::where('student_number', 'LRN-0001')->count())->toBe(1);
});

test('importing reports rows with no guardian or missing name as errors', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $csv = <<<'CSV'
    name,student_number,grade_level,section,status,phone_number,guardian_1_name,guardian_1_relationship,guardian_1_phone,guardian_2_name,guardian_2_relationship,guardian_2_phone
    ,LRN-0003,Grade 8,St. Thomas,active,,,,,,,
    No Guardian Student,LRN-0004,Grade 8,St. Thomas,active,,,,,,,
    CSV;

    $this->actingAs($admin)->post(route('admin.students.import.store'), [
        'file' => studentImportCsv($csv),
    ]);

    expect(Student::count())->toBe(0);
});
