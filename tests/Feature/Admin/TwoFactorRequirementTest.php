<?php

use App\Models\User;

test('teachers and registrar staff without two-factor are sent to set it up', function (string $role, string $route) {
    $user = User::factory()->create(['role' => $role]);

    $this->actingAs($user)->get(route($route))
        ->assertRedirect(route('security.edit'))
        ->assertInertiaFlash('toast.type', 'warning');
})->with([
    'teacher on grades' => ['teacher', 'admin.grades.index'],
    'teacher on dashboard' => ['teacher', 'dashboard'],
    'registrar on students' => ['registrar', 'admin.students.index'],
]);

test('they can still reach the security settings to set it up', function () {
    $teacher = User::factory()->create(['role' => 'teacher']);

    $this->actingAs($teacher)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('security.edit'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('twoFactorRequired', true)->where('twoFactorEnabled', false));
});

test('an unconfirmed two-factor setup does not count', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher', 'two_factor_confirmed_at' => null]);

    $this->actingAs($teacher)->get(route('admin.grades.index'))->assertRedirect(route('security.edit'));
});

test('admins are not forced to use two-factor', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->get(route('admin.grades.index'))->assertOk();
});

test('staff who require two-factor cannot turn it off', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);

    $this->actingAs($teacher)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->delete(route('two-factor.disable'))
        ->assertSessionHasErrors('two_factor');

    expect($teacher->fresh()->hasEnabledTwoFactorAuthentication())->toBeTrue();
});

test('other staff can still turn it off', function () {
    $admin = User::factory()->withTwoFactor()->create(['role' => 'admin']);

    $this->actingAs($admin)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->delete(route('two-factor.disable'));

    expect($admin->fresh()->hasEnabledTwoFactorAuthentication())->toBeFalse();
});

test('a super admin can reset a teacher\'s two-factor, who must then set it up again', function () {
    $superAdmin = User::factory()->create(['role' => 'super_admin']);
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);

    $this->actingAs($superAdmin)->delete(route('admin.users.two-factor.destroy', $teacher))->assertRedirect();

    $teacher->refresh();
    expect($teacher->hasEnabledTwoFactorAuthentication())->toBeFalse()
        ->and($teacher->two_factor_secret)->toBeNull();

    $this->actingAs($teacher)->get(route('admin.grades.index'))->assertRedirect(route('security.edit'));
});

test('only super admins can reset someone else\'s two-factor', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);

    $this->actingAs($registrar)->delete(route('admin.users.two-factor.destroy', $teacher))->assertForbidden();

    expect($teacher->fresh()->hasEnabledTwoFactorAuthentication())->toBeTrue();
});
