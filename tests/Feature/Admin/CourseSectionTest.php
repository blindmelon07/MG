<?php

use App\Models\Course;
use App\Models\Section;
use App\Models\Student;
use App\Models\TeachingAssignment;
use App\Models\User;

test('registrar can add college and graduate courses with their units', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);

    $this->actingAs($registrar)->post(route('admin.courses.store'), [
        'code' => 'BSIT',
        'name' => 'BS Information Technology',
        'education_level' => 'college',
        'units' => '162',
    ])->assertRedirect(route('admin.courses.index'));

    $this->post(route('admin.courses.store'), ['code' => 'BSIT', 'name' => 'Duplicate', 'education_level' => 'college'])
        ->assertSessionHasErrors('code');
    $this->post(route('admin.courses.store'), ['code' => 'G7', 'name' => 'Grade 7', 'education_level' => 'jhs'])
        ->assertSessionHasErrors('education_level');

    expect(Course::sole()->units)->toBe('162.0');
});

test('a course with students cannot be removed', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $course = Course::create(['code' => 'BSIT', 'name' => 'BS Information Technology', 'education_level' => 'college']);
    Student::factory()->create(['education_level' => 'college', 'grade_level' => '1st Year', 'course_id' => $course->id]);

    $this->actingAs($registrar)->delete(route('admin.courses.destroy', $course));

    expect(Course::count())->toBe(1);
});

test('registrar can list sections for each year level', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $course = Course::create(['code' => 'MAED', 'name' => 'Master of Arts in Education', 'education_level' => 'graduate']);

    $this->actingAs($registrar)->post(route('admin.sections.store'), [
        'education_level' => 'jhs',
        'grade_level' => 'Grade 7',
        'name' => ' St. Peter ',
        'course_id' => $course->id,
    ])->assertRedirect(route('admin.sections.index'));

    $this->post(route('admin.sections.store'), ['education_level' => 'graduate', 'grade_level' => '1st Year', 'name' => 'MAED 1-A', 'course_id' => $course->id]);

    $this->post(route('admin.sections.store'), ['education_level' => 'jhs', 'grade_level' => 'Grade 7', 'name' => 'St. Peter'])
        ->assertSessionHasErrors('name');
    $this->post(route('admin.sections.store'), ['education_level' => 'jhs', 'grade_level' => '1st Year', 'name' => 'X'])
        ->assertSessionHasErrors('grade_level');

    expect(Section::where('education_level', 'jhs')->sole()->only(['name', 'course_id']))->toBe(['name' => 'St. Peter', 'course_id' => null])
        ->and(Section::where('education_level', 'graduate')->sole()->course_id)->toBe($course->id);
});

test('renaming a section moves its students and teachers along', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $section = Section::create(['education_level' => 'jhs', 'grade_level' => 'Grade 8', 'name' => 'St Thomas']);
    $student = Student::factory()->create(['education_level' => 'jhs', 'grade_level' => 'Grade 8', 'section' => 'St Thomas']);
    $assignment = TeachingAssignment::create([
        'user_id' => User::factory()->create(['role' => 'teacher'])->id,
        'education_level' => 'jhs',
        'grade_level' => 'Grade 8',
        'subject' => 'Mathematics',
        'section' => 'St Thomas',
        'school_year' => '2026-2027',
    ]);

    $this->actingAs($registrar)->put(route('admin.sections.update', $section), [
        'education_level' => 'jhs',
        'grade_level' => 'Grade 8',
        'name' => 'St. Thomas',
    ]);

    expect($student->fresh()->section)->toBe('St. Thomas')
        ->and($student->enrollments()->value('section'))->toBe('St. Thomas')
        ->and($assignment->fresh()->section)->toBe('St. Thomas');
});

test('the registrar pages for courses, sections, school years and students render', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $student = Student::factory()->create();

    $pages = [
        route('admin.courses.index') => 'admin/courses/index',
        route('admin.sections.index') => 'admin/sections/index',
        route('admin.school-years.index') => 'admin/school-years/index',
        route('admin.students.create') => 'admin/students/create',
        route('admin.students.edit', $student) => 'admin/students/edit',
        route('admin.teaching-assignments.index') => 'admin/teaching-assignments/index',
        route('admin.grades.index') => 'admin/grades/index',
    ];

    foreach ($pages as $url => $component) {
        $this->actingAs($registrar)->get($url)
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component($component)->has('schoolYear.selected'));
    }
});
