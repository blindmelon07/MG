<?php

use App\Models\Guardian;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('admin can view the student list', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Student::factory()->has(Guardian::factory())->create();

    $response = $this->actingAs($admin)->get(route('admin.students.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/students/index')
        ->has('students.data', 1)
    );
});

test('admin can create a student with guardians', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $response = $this->actingAs($admin)->post(route('admin.students.store'), [
        'name' => 'Juan Dela Cruz',
        'student_number' => 'LRN-12345678',
        'grade_level' => 'Grade 8',
        'section' => 'St. Thomas',
        'phone_number' => null,
        'status' => 'active',
        'guardians' => [
            ['name' => 'Maria Dela Cruz', 'relationship' => 'Mother', 'phone_number' => '09171234567'],
            ['name' => 'Jose Dela Cruz', 'relationship' => 'Father', 'phone_number' => '639181234567'],
        ],
    ]);

    $response->assertRedirect(route('admin.students.index'));

    $student = Student::where('name', 'Juan Dela Cruz')->firstOrFail();
    expect($student->guardians)->toHaveCount(2);
});

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
    $student = Student::factory()->create();
    $keptGuardian = Guardian::factory()->for($student)->create();
    $removedGuardian = Guardian::factory()->for($student)->create();

    $response = $this->actingAs($admin)->put(route('admin.students.update', $student), [
        'name' => $student->name,
        'student_number' => $student->student_number,
        'grade_level' => $student->grade_level,
        'section' => $student->section,
        'phone_number' => null,
        'status' => 'active',
        'guardians' => [
            ['id' => $keptGuardian->id, 'name' => $keptGuardian->name, 'relationship' => $keptGuardian->relationship, 'phone_number' => $keptGuardian->phone_number],
            ['name' => 'New Guardian', 'relationship' => 'Guardian', 'phone_number' => '09171234567'],
        ],
    ]);

    $response->assertRedirect(route('admin.students.index'));

    $student->refresh();
    expect($student->guardians)->toHaveCount(2);
    expect($student->guardians->pluck('id'))->not->toContain($removedGuardian->id);
});

test('admin can delete a student', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $student = Student::factory()->create();

    $this->actingAs($admin)->delete(route('admin.students.destroy', $student));

    expect(Student::find($student->id))->toBeNull();
});
