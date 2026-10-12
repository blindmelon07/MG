<?php

use App\Models\Subject;
use App\Models\TeachingAssignment;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('registrar can assign a teacher to a class', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    Subject::factory()->create(['name' => 'Mathematics', 'education_level' => 'jhs']);

    $this->actingAs($registrar)->post(route('admin.teaching-assignments.store'), [
        'user_id' => $teacher->id,
        'education_level' => 'jhs',
        'grade_level' => 'Grade 8',
        'subject' => ' Mathematics ',
        'section' => 'St. Thomas',
        'school_year' => '2026-2027',
    ])->assertRedirect(route('admin.teaching-assignments.index', ['level' => 'jhs']));

    expect($teacher->teachingAssignments()->first())
        ->education_level->toBe('jhs')
        ->grade_level->toBe('Grade 8')
        ->subject->toBe('Mathematics')
        ->section->toBe('St. Thomas');
});

test('only users with the teacher role can be assigned', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $admin = User::factory()->create(['role' => 'admin']);
    Subject::factory()->create(['name' => 'Mathematics', 'education_level' => 'jhs']);

    $this->actingAs($registrar)->post(route('admin.teaching-assignments.store'), [
        'user_id' => $admin->id,
        'education_level' => 'jhs',
        'grade_level' => 'Grade 8',
        'subject' => 'Mathematics',
        'section' => 'St. Thomas',
        'school_year' => '2026-2027',
    ])->assertSessionHasErrors('user_id');

    expect(TeachingAssignment::count())->toBe(0);
});

test('the subject must exist in the subjects list for that education level', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    Subject::factory()->create(['name' => 'Calculus', 'education_level' => 'college']);

    $this->actingAs($registrar)->post(route('admin.teaching-assignments.store'), [
        'user_id' => $teacher->id,
        'education_level' => 'jhs',
        'grade_level' => 'Grade 8',
        'subject' => 'Calculus',
        'section' => 'St. Thomas',
        'school_year' => '2026-2027',
    ])->assertSessionHasErrors('subject');

    expect(TeachingAssignment::count())->toBe(0);
});

test('the year level must belong to the education level', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    Subject::factory()->create(['name' => 'Mathematics', 'education_level' => 'jhs']);

    $this->actingAs($registrar)->post(route('admin.teaching-assignments.store'), [
        'user_id' => $teacher->id,
        'education_level' => 'jhs',
        'grade_level' => 'Grade 11',
        'subject' => 'Mathematics',
        'section' => 'St. Thomas',
        'school_year' => '2026-2027',
    ])->assertSessionHasErrors('grade_level');
});

test('assignments can be filtered by education level', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);

    TeachingAssignment::create(['user_id' => $teacher->id, 'education_level' => 'jhs', 'grade_level' => 'Grade 7', 'subject' => 'Science', 'section' => 'A', 'school_year' => '2026-2027']);
    TeachingAssignment::create(['user_id' => $teacher->id, 'education_level' => 'college', 'grade_level' => '1st Year', 'subject' => 'Calculus', 'section' => 'B', 'school_year' => '2026-2027']);

    $this->actingAs($registrar)
        ->get(route('admin.teaching-assignments.index', ['level' => 'college']))
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/teaching-assignments/index')
            ->where('level', 'college')
            ->has('assignments', 1)
            ->where('assignments.0.subject', 'Calculus')
            ->where('levelCounts.jhs', 1)
            ->where('levelCounts.college', 1));
});

test('teachers see only their own teaching assignments', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    $other = User::factory()->withTwoFactor()->create(['role' => 'teacher']);

    TeachingAssignment::create(['user_id' => $teacher->id, 'education_level' => 'shs', 'grade_level' => 'Grade 11', 'subject' => 'Physics', 'section' => 'A', 'school_year' => '2026-2027']);
    TeachingAssignment::create(['user_id' => $other->id, 'education_level' => 'jhs', 'grade_level' => 'Grade 7', 'subject' => 'Science', 'section' => 'B', 'school_year' => '2026-2027']);

    $this->actingAs($teacher)
        ->get(route('admin.teaching-assignments.mine'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/teaching-assignments/mine')
            ->has('assignments', 1)
            ->where('assignments.0.subject', 'Physics')
            ->where('assignments.0.grade_level', 'Grade 11'));
});

test('teachers cannot manage teaching assignments', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);

    $this->actingAs($teacher)
        ->get(route('admin.teaching-assignments.index'))
        ->assertForbidden();
});
