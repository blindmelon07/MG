<?php

use App\Models\TeachingAssignment;
use App\Models\User;

test('registrar can assign a teacher to a class', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);

    $this->actingAs($registrar)->post(route('admin.teaching-assignments.store'), [
        'user_id' => $teacher->id,
        'subject' => ' Mathematics ',
        'section' => 'St. Thomas',
        'school_year' => '2026-2027',
    ])->assertRedirect(route('admin.teaching-assignments.index'));

    expect($teacher->teachingAssignments()->first())
        ->subject->toBe('Mathematics')
        ->section->toBe('St. Thomas');
});

test('only users with the teacher role can be assigned', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($registrar)->post(route('admin.teaching-assignments.store'), [
        'user_id' => $admin->id,
        'subject' => 'Mathematics',
        'section' => 'St. Thomas',
        'school_year' => '2026-2027',
    ])->assertSessionHasErrors('user_id');

    expect(TeachingAssignment::count())->toBe(0);
});
