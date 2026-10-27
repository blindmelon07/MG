<?php

use App\Models\MapReferencePoint;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('guests cannot add gps reference points', function () {
    $this->post(route('admin.map-reference-points.store'), [])
        ->assertRedirect(route('login'));
});

test('admin can add a gps reference point', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $response = $this->actingAs($admin)->post(route('admin.map-reference-points.store'), [
        'label' => 'Main gate',
        'latitude' => 12.9701234,
        'longitude' => 123.9941234,
        'accuracy' => 6.5,
        'x' => 47.9,
        'y' => 92.0,
    ]);

    $response->assertRedirect(route('admin.campus-locations.index'));

    $point = MapReferencePoint::sole();
    expect($point->label)->toBe('Main gate');
    expect($point->latitude)->toBe(12.9701234);
    expect($point->x)->toBe(47.9);
});

test('a gps reference point needs a reading and a map spot', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)
        ->post(route('admin.map-reference-points.store'), [
            'latitude' => 120,
            'x' => 150,
        ])
        ->assertSessionHasErrors(['latitude', 'longitude', 'x', 'y']);

    expect(MapReferencePoint::count())->toBe(0);
});

test('admin can remove a gps reference point', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $point = MapReferencePoint::factory()->create();

    $this->actingAs($admin)
        ->delete(route('admin.map-reference-points.destroy', $point))
        ->assertRedirect(route('admin.campus-locations.index'));

    expect(MapReferencePoint::count())->toBe(0);
});

test('admin campus map page lists the gps reference points', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    MapReferencePoint::factory()->count(2)->create();

    $this->actingAs($admin)
        ->get(route('admin.campus-locations.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('admin/campus-locations/index')
            ->has('referencePoints', 2)
        );
});

test('kiosk map receives reference points without extra details', function () {
    MapReferencePoint::factory()->create(['label' => 'Main gate']);

    $this->get(route('maps.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('kiosk/maps/index')
            ->has('referencePoints', 1, fn ($point) => $point
                ->hasAll(['latitude', 'longitude', 'x', 'y'])
                ->missing('label')
            )
        );
});

test('a point with coordinates entered from Google Maps needs no accuracy reading', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->post(route('admin.map-reference-points.store'), [
        'label' => 'Chapel corner',
        'latitude' => 13.036512,
        'longitude' => 124.003298,
        'accuracy' => '',
        'x' => 40.0,
        'y' => 55.5,
    ])->assertRedirect(route('admin.campus-locations.index'));

    expect(MapReferencePoint::sole()->accuracy)->toBeNull();
});

test('admin can edit a gps reference point', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $point = MapReferencePoint::factory()->create(['label' => 'Gate', 'accuracy' => 8]);

    $this->actingAs($admin)
        ->put(route('admin.map-reference-points.update', $point), [
            'label' => 'Main gate',
            'latitude' => 12.970973,
            'longitude' => 123.994085,
            'accuracy' => '',
            'x' => 47.2,
            'y' => 93.1,
        ])
        ->assertRedirect(route('admin.campus-locations.index'));

    $point->refresh();
    expect($point->label)->toBe('Main gate');
    expect($point->latitude)->toBe(12.970973);
    expect($point->x)->toBe(47.2);
    expect($point->accuracy)->toBeNull();
    expect(MapReferencePoint::count())->toBe(1);
});

test('an edited gps reference point still needs a reading and a map spot', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $point = MapReferencePoint::factory()->create();

    $this->actingAs($admin)
        ->put(route('admin.map-reference-points.update', $point), [
            'latitude' => 120,
            'x' => 150,
        ])
        ->assertSessionHasErrors(['latitude', 'longitude', 'x', 'y']);
});

test('guests cannot edit gps reference points', function () {
    $point = MapReferencePoint::factory()->create();

    $this->put(route('admin.map-reference-points.update', $point), [])
        ->assertRedirect(route('login'));
});
