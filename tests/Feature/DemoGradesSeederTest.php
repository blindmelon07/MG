<?php

use App\Models\Grade;
use App\Models\GradeAudit;
use App\Models\Student;
use Database\Seeders\DemoGradesSeeder;
use Database\Seeders\RemoveDemoGradesSeeder;

test('the demo seeder creates labelled students with k-12 and college grades', function () {
    $this->seed(DemoGradesSeeder::class);

    $students = Student::all();

    expect($students)->toHaveCount(9)
        ->and($students->every(fn (Student $s) => str_starts_with((string) $s->student_number, 'DEMO-')))->toBeTrue()
        ->and($students->every(fn (Student $s) => str_starts_with((string) $s->section, 'DEMO ')))->toBeTrue()
        ->and($students->every(fn (Student $s) => $s->password === null && $s->phone_number === null))->toBeTrue()
        ->and($students->sum(fn (Student $s) => $s->guardians()->count()))->toBe(0);

    $k12 = Grade::where('grading_system', 'k12')->where('school_year', '2025-2026')->firstOrFail();
    expect($k12->final_grade)->not->toBeNull()->and($k12->remarks)->toBeIn(['Passed', 'Failed']);

    expect(Grade::where('grading_system', 'k12')->where('school_year', '2026-2027')->whereNotNull('q2')->exists())->toBeFalse()
        ->and(Grade::where('grading_system', 'college')->where('remarks', 'INC')->exists())->toBeTrue()
        ->and(Grade::where('school_year', '2026-2027')->where('grading_system', 'college')->whereNotNull('final_grade')->exists())->toBeFalse();
});

test('running the demo seeder twice does not duplicate anything', function () {
    $this->seed(DemoGradesSeeder::class);
    $grades = Grade::count();

    $this->seed(DemoGradesSeeder::class);

    expect(Student::count())->toBe(9)->and(Grade::count())->toBe($grades);
});

test('the removal seeder deletes only demo records', function () {
    $real = Student::factory()->create(['student_number' => 'LRN-0001']);
    Grade::factory()->for($real)->create();

    $this->seed(DemoGradesSeeder::class);
    $this->seed(RemoveDemoGradesSeeder::class);

    expect(Student::pluck('student_number')->all())->toBe(['LRN-0001'])
        ->and(Grade::count())->toBe(1)
        ->and(GradeAudit::whereNotIn('student_id', [$real->id])->count())->toBe(0);
});
