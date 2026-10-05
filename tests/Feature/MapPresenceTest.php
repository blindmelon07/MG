<?php

use App\Models\MapPresence;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

const MAP_CLIENT_ID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';

test('a phone sharing its location appears on the dashboard map', function () {
    $this->postJson(route('maps.presence'), ['client' => MAP_CLIENT_ID, 'x' => 42.25, 'y' => 61])->assertNoContent();
    // Reporting again moves the same dot rather than adding one.
    $this->postJson(route('maps.presence'), ['client' => MAP_CLIENT_ID, 'x' => 43, 'y' => 60])->assertNoContent();

    expect(MapPresence::count())->toBe(1);

    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->component('dashboard')
            ->has('activeUsers', 1)
            ->where('activeUsers.0.x', 43)
            ->where('activeUsers.0.label', 'Visitor')
            ->where('activeUsers.0.kind', 'visitor'));
});

test('a signed-in student is shown by name', function () {
    $student = Student::factory()->create(['name' => 'Juan Dela Cruz']);

    $this->actingAs($student, 'student')->postJson(route('maps.presence'), ['client' => MAP_CLIENT_ID, 'x' => 10, 'y' => 10]);

    expect(MapPresence::firstOrFail())
        ->student_id->toBe($student->id)
        ->label()->toBe('Juan Dela Cruz')
        ->kind()->toBe('student');
});

test('people who stopped reporting drop off the map', function () {
    MapPresence::create(['session_key' => 'stale', 'x' => 1, 'y' => 1, 'last_seen_at' => now()->subMinutes(5)]);
    MapPresence::create(['session_key' => 'fresh', 'x' => 2, 'y' => 2, 'last_seen_at' => now()]);

    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page->has('activeUsers', 1));
});

test('turning location off removes the dot', function () {
    $this->postJson(route('maps.presence'), ['client' => MAP_CLIENT_ID, 'x' => 50, 'y' => 50]);
    $this->deleteJson(route('maps.presence.leave'), ['client' => MAP_CLIENT_ID])->assertNoContent();

    expect(MapPresence::count())->toBe(0);
});

test('presence reports must be map coordinates', function () {
    $this->postJson(route('maps.presence'), ['client' => MAP_CLIENT_ID, 'x' => 500, 'y' => 'north'])
        ->assertJsonValidationErrors(['x', 'y']);

    $this->postJson(route('maps.presence'), ['client' => 'not-a-uuid', 'x' => 1, 'y' => 1])
        ->assertJsonValidationErrors(['client']);
});
