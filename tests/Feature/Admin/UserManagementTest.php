<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('non super admin cannot access user management', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->get(route('admin.users.index'))->assertForbidden();
});

test('super admin can view the user list', function () {
    $superAdmin = User::factory()->create(['role' => 'super_admin']);
    User::factory()->create(['role' => 'admin']);

    $response = $this->actingAs($superAdmin)->get(route('admin.users.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/users/index')
        ->has('users', 2)
    );
});

test('super admin can create a new user', function () {
    $superAdmin = User::factory()->create(['role' => 'super_admin']);

    $response = $this->actingAs($superAdmin)->post(route('admin.users.store'), [
        'name' => 'New Staff',
        'email' => 'staff@example.com',
        'role' => 'admin',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $response->assertRedirect(route('admin.users.index'));

    $user = User::where('email', 'staff@example.com')->firstOrFail();
    expect($user->role)->toBe('admin');
    expect($user->email_verified_at)->not->toBeNull();
});

test('super admin can update a user without changing the password', function () {
    $superAdmin = User::factory()->create(['role' => 'super_admin']);
    $target = User::factory()->create(['role' => 'admin', 'name' => 'Old Name']);
    $originalPassword = $target->password;

    $this->actingAs($superAdmin)->put(route('admin.users.update', $target), [
        'name' => 'New Name',
        'email' => $target->email,
        'role' => 'admin',
    ])->assertRedirect(route('admin.users.index'));

    $target->refresh();
    expect($target->name)->toBe('New Name');
    expect($target->password)->toBe($originalPassword);
});

test('a user cannot delete their own account', function () {
    $superAdmin = User::factory()->create(['role' => 'super_admin']);

    $this->actingAs($superAdmin)->delete(route('admin.users.destroy', $superAdmin));

    expect(User::find($superAdmin->id))->not->toBeNull();
});

test('a super admin can delete another super admin when more than one remains', function () {
    $actor = User::factory()->create(['role' => 'super_admin']);
    $other = User::factory()->create(['role' => 'super_admin']);

    $this->actingAs($actor)->delete(route('admin.users.destroy', $other));

    expect(User::find($other->id))->toBeNull();
});

test('the sole super admin cannot demote themselves', function () {
    $superAdmin = User::factory()->create(['role' => 'super_admin']);

    $this->actingAs($superAdmin)->put(route('admin.users.update', $superAdmin), [
        'name' => $superAdmin->name,
        'email' => $superAdmin->email,
        'role' => 'admin',
    ]);

    expect($superAdmin->fresh()->role)->toBe('super_admin');
});
