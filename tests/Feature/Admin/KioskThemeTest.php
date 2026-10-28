<?php

use App\Models\User;
use App\Support\KioskTheme;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function kioskColors(string $primary = '#1E3A8A'): array
{
    $theme = KioskTheme::DEFAULTS;
    $theme['light']['primary'] = $primary;

    return $theme;
}

test('only admins can change the kiosk colors', function () {
    $this->get(route('admin.kiosk-theme.edit'))->assertRedirect(route('login'));

    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);

    $this->actingAs($teacher)
        ->put(route('admin.kiosk-theme.update'), kioskColors())
        ->assertForbidden();
});

test('kiosk pages use the default colors until an admin saves some', function () {
    $this->get(route('home'))
        ->assertInertia(fn ($page) => $page->where('kioskTheme', null));
});

test('admin can save the kiosk colors and the kiosk gets them', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)
        ->get(route('admin.kiosk-theme.edit'))
        ->assertInertia(fn ($page) => $page
            ->component('admin/kiosk-theme/edit')
            ->where('customized', false)
            ->where('theme.light.primary', '#171717'));

    $this->actingAs($admin)
        ->put(route('admin.kiosk-theme.update'), kioskColors())
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.kiosk-theme.edit'));

    $this->get(route('home'))
        ->assertInertia(fn ($page) => $page
            ->where('kioskTheme.light.primary', '#1e3a8a')
            ->where('kioskTheme.dark.primary', '#fafafa'));
});

test('kiosk colors must be hex colors', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)
        ->put(route('admin.kiosk-theme.update'), kioskColors('blue'))
        ->assertSessionHasErrors('light.primary');

    expect(KioskTheme::saved())->toBeNull();
});

test('admin can reset the kiosk colors', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->put(route('admin.kiosk-theme.update'), kioskColors());
    expect(KioskTheme::saved())->not->toBeNull();

    $this->actingAs($admin)
        ->delete(route('admin.kiosk-theme.destroy'))
        ->assertRedirect(route('admin.kiosk-theme.edit'));

    expect(KioskTheme::saved())->toBeNull();
});
