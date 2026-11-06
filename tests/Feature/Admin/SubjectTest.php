<?php

use App\Models\Course;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('registrar can add, edit and remove subjects', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);

    $this->actingAs($registrar)->get(route('admin.subjects.index'))->assertOk();

    $this->actingAs($registrar)->post(route('admin.subjects.store'), [
        'name' => ' Mathematics ',
        'education_level' => 'jhs',
    ])->assertRedirect(route('admin.subjects.index'));

    $subject = Subject::firstOrFail();
    expect($subject->name)->toBe('Mathematics');

    $this->actingAs($registrar)->put(route('admin.subjects.update', $subject), [
        'code' => 'MATH101',
        'name' => 'College Algebra',
        'education_level' => 'college',
        'units' => 3,
    ])->assertRedirect(route('admin.subjects.index'));

    expect($subject->fresh())
        ->code->toBe('MATH101')
        ->units->toBe('3.0');

    $this->actingAs($registrar)->delete(route('admin.subjects.destroy', $subject));

    expect(Subject::count())->toBe(0);
});

test('the same subject cannot be added twice for one education level', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    Subject::factory()->create(['name' => 'Science', 'education_level' => 'jhs']);

    $this->actingAs($registrar)->post(route('admin.subjects.store'), [
        'name' => 'Science',
        'education_level' => 'jhs',
    ])->assertSessionHasErrors('name');

    $this->actingAs($registrar)->post(route('admin.subjects.store'), [
        'name' => 'Science',
        'education_level' => 'shs',
    ])->assertSessionHasNoErrors();
});

test('college subjects are filed under a course, or under general education without one', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $bsit = Course::create(['code' => 'BSIT', 'name' => 'BS Information Technology', 'education_level' => 'college']);
    $bsba = Course::create(['code' => 'BSBA', 'name' => 'BS Business Administration', 'education_level' => 'college']);

    $this->actingAs($registrar)->post(route('admin.subjects.store'), [
        'name' => 'Capstone Project',
        'education_level' => 'college',
        'course_id' => $bsit->id,
    ])->assertSessionHasNoErrors();

    // Another course can have a subject with the same name.
    $this->actingAs($registrar)->post(route('admin.subjects.store'), [
        'name' => 'Capstone Project',
        'education_level' => 'college',
        'course_id' => $bsba->id,
    ])->assertSessionHasNoErrors();

    $this->actingAs($registrar)->post(route('admin.subjects.store'), [
        'name' => 'Capstone Project',
        'education_level' => 'college',
        'course_id' => $bsit->id,
    ])->assertSessionHasErrors('name');

    $this->actingAs($registrar)->post(route('admin.subjects.store'), [
        'name' => 'Purposive Communication',
        'education_level' => 'college',
    ])->assertSessionHasNoErrors();

    expect(Subject::where('course_id', $bsit->id)->pluck('name')->all())->toBe(['Capstone Project'])
        ->and(Subject::where('name', 'Purposive Communication')->value('course_id'))->toBeNull();

    $this->actingAs($registrar)->get(route('admin.subjects.index'))
        ->assertInertia(fn ($page) => $page->has('courses', 2));
});

test('a subject only takes a course from its own education level', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $maed = Course::create(['code' => 'MAED', 'name' => 'Master of Arts in Education', 'education_level' => 'graduate']);

    $this->actingAs($registrar)->post(route('admin.subjects.store'), [
        'name' => 'Thesis Writing',
        'education_level' => 'college',
        'course_id' => $maed->id,
    ])->assertSessionHasErrors('course_id');

    // Below college the course is ignored.
    $this->actingAs($registrar)->post(route('admin.subjects.store'), [
        'name' => 'Science',
        'education_level' => 'jhs',
        'course_id' => $maed->id,
    ])->assertSessionHasNoErrors();

    expect(Subject::where('name', 'Science')->value('course_id'))->toBeNull();
});

test('teachers cannot manage subjects', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);

    $this->actingAs($teacher)->get(route('admin.subjects.index'))->assertForbidden();
});

test('teaching assignments suggest subjects from the list', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    Subject::factory()->create(['name' => 'Filipino']);

    $this->actingAs($registrar)->get(route('admin.teaching-assignments.index'))
        ->assertInertia(fn ($page) => $page->where('subjects.0.name', 'Filipino')->where('subjects.0.education_level', 'jhs'));
});
