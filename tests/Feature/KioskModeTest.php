<?php

use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(fn () => config(['kiosk.mode' => true]));

test('a kiosk PC opens the kiosk pages', function (string $route) {
    $this->get(route($route))->assertOk();
})->with(['home', 'directory.index', 'manuals.index', 'announcements.index', 'maps.index', 'student.login']);

test('a kiosk PC turns away staff and admin pages, even for a signed-in admin', function () {
    $this->get(route('login'))->assertNotFound();
    $this->get(route('dashboard'))->assertNotFound();
    $this->get('/settings/profile')->assertNotFound();

    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->get(route('admin.directory-entries.index'))->assertNotFound();
    $this->actingAs($admin)->post(route('admin.directory-entries.store'), [])->assertNotFound();
});

test('students signing in on a kiosk PC always get a kiosk session', function () {
    $this->get(route('student.login'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('kiosk/student/login')
            ->where('kioskMode', true));

    $student = Student::factory()->create();
    $student->forceFill(['password' => bcrypt('secret-pass-123')])->save();

    $this->post(route('student.login.store'), [
        'student_number' => $student->student_number,
        'password' => 'secret-pass-123',
        'remember' => true,
    ]);

    expect(session('student_kiosk'))->toBeTrue();
});

test('without kiosk mode everything works as before', function () {
    config(['kiosk.mode' => false]);

    $this->get(route('login'))->assertOk();
    $this->get(route('home'))->assertInertia(fn (Assert $page) => $page->where('kioskMode', false));
});
