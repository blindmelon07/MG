<?php

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

test('teachers cannot manage subjects', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);

    $this->actingAs($teacher)->get(route('admin.subjects.index'))->assertForbidden();
});

test('teaching assignments suggest subjects from the list', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    Subject::factory()->create(['name' => 'Filipino']);

    $this->actingAs($registrar)->get(route('admin.teaching-assignments.index'))
        ->assertInertia(fn ($page) => $page->where('subjects', ['Filipino']));
});
