<?php

use App\Models\CampusLocation;
use App\Models\DirectoryEntry;
use App\Models\User;
use App\Support\KioskPosition;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

test('the kiosk directory lists offices, hotlines and buildings', function () {
    $main = CampusLocation::factory()->create(['name' => 'Main Building']);
    DirectoryEntry::factory()->create([
        'name' => "Registrar's Office",
        'campus_location_id' => $main->id,
        'room' => 'Ground floor',
    ]);
    DirectoryEntry::factory()->hotline()->create(['name' => 'Clinic', 'phone' => '0917']);

    $this->get(route('directory.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('kiosk/directory/index')
            ->has('entries', 2)
            ->has('buildings', 1)
            ->where('entries', fn ($entries) => collect($entries)->contains(
                fn ($e) => $e['name'] === "Registrar's Office" && $e['campus_location']['name'] === 'Main Building',
            )));
});

test('only admins can manage the directory', function () {
    $this->get(route('admin.directory-entries.index'))->assertRedirect(route('login'));

    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);

    $this->actingAs($teacher)
        ->post(route('admin.directory-entries.store'), ['category' => 'hotline', 'name' => 'X', 'phone' => '911'])
        ->assertForbidden();

    expect(DirectoryEntry::count())->toBe(0);
});

test('an admin can add, edit and remove directory entries', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $main = CampusLocation::factory()->create();

    $this->actingAs($admin)
        ->post(route('admin.directory-entries.store'), [
            'category' => 'office',
            'name' => "Cashier's Office",
            'campus_location_id' => $main->id,
            'room' => 'Beside the Registrar',
            'office_hours' => 'Mon–Fri, 8–5',
        ])
        ->assertRedirect(route('admin.directory-entries.index'));

    $entry = DirectoryEntry::sole();
    expect($entry)
        ->campus_location_id->toBe($main->id)
        ->sort_order->toBe(0);

    $this->actingAs($admin)
        ->put(route('admin.directory-entries.update', $entry), [
            'category' => 'office',
            'name' => 'Cashier',
            'campus_location_id' => '',
        ])
        ->assertRedirect();

    expect($entry->fresh())
        ->name->toBe('Cashier')
        ->campus_location_id->toBeNull();

    $this->actingAs($admin)
        ->delete(route('admin.directory-entries.destroy', $entry))
        ->assertRedirect();

    expect(DirectoryEntry::count())->toBe(0);
});

test('a hotline needs a phone number', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)
        ->post(route('admin.directory-entries.store'), ['category' => 'hotline', 'name' => 'Guard house'])
        ->assertSessionHasErrors('phone');
});

test('the kiosk home starts routes from the main gate until the kiosk is placed', function () {
    CampusLocation::factory()->create(['name' => 'Main Gate', 'x' => 47.9, 'y' => 92]);

    $this->get(route('home'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('kiosk/home')
            ->where('kioskPosition', ['x' => 47.9, 'y' => 92]));

    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)
        ->put(route('admin.kiosk-position.update'), ['x' => 60.123, 'y' => 70])
        ->assertRedirect();

    expect(KioskPosition::current())->toBe(['x' => 60.12, 'y' => 70.0]);

    $this->actingAs($admin)->delete(route('admin.kiosk-position.destroy'));

    expect(KioskPosition::saved())->toBeNull();
});

test('the kiosk home offers offices that are on the map and opens on a chosen one', function () {
    $main = CampusLocation::factory()->create();
    $office = DirectoryEntry::factory()->create(['campus_location_id' => $main->id]);
    DirectoryEntry::factory()->create(['campus_location_id' => null]);
    DirectoryEntry::factory()->hotline()->create();

    $this->get(route('home', ['office' => $office->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->has('offices', 1)
            ->where('offices.0.id', $office->id)
            ->where('focus.office', $office->id)
            ->where('focus.location', null));
});

test('an office can point at a room on its building floor plan', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $main = CampusLocation::factory()->create(['name' => 'Main Building']);

    $this->actingAs($admin)
        ->post(route('admin.directory-entries.store'), [
            'category' => 'office',
            'name' => "Registrar's Office",
            'campus_location_id' => $main->id,
            'floor_room' => 'registrar',
        ])
        ->assertRedirect();

    expect(DirectoryEntry::sole()->floor_room)->toBe('registrar');

    $this->get(route('home'))
        ->assertInertia(fn (Assert $page) => $page->where('offices.0.floor_room', 'registrar'));

    $this->actingAs($admin)
        ->post(route('admin.directory-entries.store'), [
            'category' => 'office',
            'name' => 'Bad',
            'floor_room' => 'Not A Key!',
        ])
        ->assertSessionHasErrors('floor_room');
});

test('campus locations can have a photo for the kiosk details card', function () {
    Storage::fake('public');
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->post(route('admin.campus-locations.store'), [
        'name' => 'Main Gate',
        'x' => 50,
        'y' => 90,
        'photo' => UploadedFile::fake()->image('gate.jpg'),
    ])->assertRedirect();

    $location = CampusLocation::sole();
    $path = $location->photo_path;
    Storage::disk('public')->assertExists($path);

    $this->get(route('home'))
        ->assertInertia(fn (Assert $page) => $page->where('locations.0.photo_url', $location->photo_url));

    $this->actingAs($admin)->put(route('admin.campus-locations.update', $location), [
        'name' => 'Main Gate',
        'x' => 50,
        'y' => 90,
        'remove_photo' => '1',
    ])->assertRedirect();

    expect($location->fresh()->photo_path)->toBeNull();
    Storage::disk('public')->assertMissing($path);
});
