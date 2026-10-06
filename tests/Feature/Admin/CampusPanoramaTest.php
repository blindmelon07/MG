<?php

use App\Models\CampusPanorama;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    Storage::fake('public');
});

function panoramaUpload(string $fixture = 'panorama-with-gps.jpg'): UploadedFile
{
    $path = base_path("tests/fixtures/{$fixture}");

    return new UploadedFile($path, $fixture, 'image/jpeg', null, true);
}

test('guests cannot upload 360 photos', function () {
    $this->post(route('admin.campus-panoramas.store'), [])
        ->assertRedirect(route('login'));
});

test('uploading a 360 photo reads its gps from the camera', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)
        ->post(route('admin.campus-panoramas.store'), [
            'title' => 'Main Gate',
            'image' => panoramaUpload(),
        ])
        ->assertRedirect(route('admin.campus-locations.index'));

    $panorama = CampusPanorama::sole();
    expect($panorama->title)->toBe('Main Gate');
    expect($panorama->latitude)->toEqualWithDelta(12.9709333, 0.000001);
    expect($panorama->longitude)->toEqualWithDelta(123.9940417, 0.000001);
    Storage::disk('public')->assertExists($panorama->path);
});

test('a 360 photo without gps needs coordinates typed in', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $image = UploadedFile::fake()->image('pano.jpg', 2048, 1024);

    $this->actingAs($admin)
        ->post(route('admin.campus-panoramas.store'), ['image' => $image])
        ->assertSessionHasErrors('latitude');

    $this->actingAs($admin)
        ->post(route('admin.campus-panoramas.store'), [
            'image' => UploadedFile::fake()->image('pano.jpg', 2048, 1024),
            'latitude' => 12.9705,
            'longitude' => 123.9942,
        ])
        ->assertSessionHasNoErrors();

    expect(CampusPanorama::sole()->latitude)->toBe(12.9705);
});

test('only 2:1 photos are accepted as 360 photos', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)
        ->post(route('admin.campus-panoramas.store'), [
            'image' => UploadedFile::fake()->image('photo.jpg', 1600, 1200),
            'latitude' => 12.9705,
            'longitude' => 123.9942,
        ])
        ->assertSessionHasErrors('image');

    expect(CampusPanorama::count())->toBe(0);
});

test('large 360 photos are shrunk for phones', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->post(route('admin.campus-panoramas.store'), [
        'image' => UploadedFile::fake()->image('big.jpg', 6080, 3040),
        'latitude' => 12.9705,
        'longitude' => 123.9942,
    ]);

    $stored = Storage::disk('public')->path(CampusPanorama::sole()->path);
    [$width, $height] = getimagesize($stored);
    expect($width)->toBe(4096);
    expect($height)->toBe(2048);
});

test('admin can set where north is and remove a 360 photo', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $panorama = CampusPanorama::factory()->create();
    Storage::disk('public')->put($panorama->path, 'jpeg');

    $this->actingAs($admin)
        ->put(route('admin.campus-panoramas.update', $panorama), [
            'title' => 'Driveway',
            'latitude' => 12.97,
            'longitude' => 123.994,
            'north_offset' => 212.5,
        ])
        ->assertRedirect(route('admin.campus-locations.index'));

    expect($panorama->fresh()->north_offset)->toBe(212.5);

    $this->actingAs($admin)
        ->delete(route('admin.campus-panoramas.destroy', $panorama))
        ->assertRedirect(route('admin.campus-locations.index'));

    expect(CampusPanorama::count())->toBe(0);
    Storage::disk('public')->assertMissing($panorama->path);
});

test('the kiosk map gets the 360 photos', function () {
    CampusPanorama::factory()->count(2)->create();

    $this->get(route('maps.index'))
        ->assertInertia(fn ($page) => $page
            ->component('kiosk/maps/index')
            ->has('panoramas', 2)
            ->has('panoramas.0.url'));
});
