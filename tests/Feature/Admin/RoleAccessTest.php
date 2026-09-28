<?php

use App\Models\User;

test('teachers can only reach the grades module', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);

    $this->actingAs($teacher)->get(route('admin.grades.index'))->assertOk();
    $this->actingAs($teacher)->get(route('admin.students.index'))->assertForbidden();
    $this->actingAs($teacher)->get(route('admin.manuals.index'))->assertForbidden();
    $this->actingAs($teacher)->get(route('admin.teaching-assignments.index'))->assertForbidden();
    $this->actingAs($teacher)->get(route('admin.users.index'))->assertForbidden();
});

test('registrar staff can manage students, grades and assignments but not content', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);

    $this->actingAs($registrar)->get(route('admin.students.index'))->assertOk();
    $this->actingAs($registrar)->get(route('admin.grades.index'))->assertOk();
    $this->actingAs($registrar)->get(route('admin.teaching-assignments.index'))->assertOk();
    $this->actingAs($registrar)->get(route('admin.announcements.index'))->assertForbidden();
    $this->actingAs($registrar)->get(route('admin.users.index'))->assertForbidden();
});

test('admins keep access to content and gain the grades module', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->get(route('admin.manuals.index'))->assertOk();
    $this->actingAs($admin)->get(route('admin.grades.index'))->assertOk();
});

test('the dashboard sends teachers and registrar staff to their module', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);

    $this->actingAs($teacher)->get(route('dashboard'))->assertRedirect(route('admin.grades.index'));
    $this->actingAs($registrar)->get(route('dashboard'))->assertRedirect(route('admin.students.index'));
});

test('super admin can create teacher and registrar accounts', function () {
    $superAdmin = User::factory()->create(['role' => 'super_admin']);

    $this->actingAs($superAdmin)->post(route('admin.users.store'), [
        'name' => 'Ms. Santos',
        'email' => 'santos@example.com',
        'role' => 'teacher',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertRedirect(route('admin.users.index'));

    expect(User::where('email', 'santos@example.com')->value('role'))->toBe('teacher');
});
