<?php

use App\Models\CampusLocation;
use App\Models\DirectoryEntry;
use App\Models\FloorPlan;
use App\Models\User;
use Database\Seeders\FloorPlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function () {
    Storage::fake('public');
});

/**
 * @return array<string, mixed>
 */
function floorPlanPayload(CampusLocation $building, array $overrides = []): array
{
    return [
        'campus_location_id' => $building->id,
        'floor' => 'Ground floor',
        'width' => '100',
        'depth' => '60',
        'meters_per_unit' => '0.5',
        'site_x0' => '40',
        'site_y0' => '40',
        'site_x1' => '50',
        'site_y1' => '46',
        'rooms' => [
            ['key' => 'registrar', 'name' => 'Registrar', 'kind' => 'office', 'x' => '0', 'y' => '0', 'w' => '20', 'd' => '15', 'door' => 'south'],
            ['key' => 'cashier', 'name' => 'Cashier', 'kind' => 'office', 'x' => '20', 'y' => '0', 'w' => '20', 'd' => '15', 'door' => 'south'],
        ],
        'halls' => [
            ['x' => '0', 'y' => '15', 'w' => '100', 'd' => '8'],
        ],
        'entrances' => [
            ['key' => 'east', 'name' => 'the east door', 'at' => ['x' => '100', 'y' => '19'], 'inward' => 'west'],
        ],
        ...$overrides,
    ];
}

test('only admins can manage floor plans', function () {
    $this->get(route('admin.floor-plans.index'))->assertRedirect(route('login'));

    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    $building = CampusLocation::factory()->create();

    $this->actingAs($teacher)
        ->post(route('admin.floor-plans.store'), floorPlanPayload($building))
        ->assertForbidden();

    expect(FloorPlan::count())->toBe(0);
});

test('an admin can upload a floor plan and trace it', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $building = CampusLocation::factory()->create(['name' => 'Main Building']);

    $this->actingAs($admin)
        ->get(route('admin.floor-plans.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/floor-plans/create')
            ->has('locations', 1));

    $this->actingAs($admin)
        ->post(route('admin.floor-plans.store'), floorPlanPayload($building, [
            'image' => UploadedFile::fake()->image('sign.jpg', 1000, 600),
        ]))
        ->assertSessionHasNoErrors();

    $plan = FloorPlan::sole();
    expect($plan->campus_location_id)->toBe($building->id)
        ->and($plan->width)->toBe(100.0)
        ->and($plan->rooms)->toHaveCount(2)
        ->and($plan->rooms[0]['w'])->toEqual(20)
        ->and($plan->entrances[0]['at'])->toEqual(['x' => 100, 'y' => 19])
        ->and($plan->image_path)->not->toBeNull();

    Storage::disk('public')->assertExists($plan->image_path);

    $this->actingAs($admin)
        ->get(route('admin.floor-plans.edit', $plan))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/floor-plans/edit')
            ->where('plan.building', 'Main Building')
            ->where('plan.rooms.1.key', 'cashier')
            ->where('plan.imageUrl', fn ($url) => str_contains($url, 'floor-plans/')));
});

test('a floor plan must hold together', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $building = CampusLocation::factory()->create();
    $payload = floorPlanPayload($building);
    $payload['rooms'][1]['key'] = 'registrar';
    $payload['rooms'][0]['door'] = 'up';
    $payload['site_x1'] = '30';

    $this->actingAs($admin)
        ->post(route('admin.floor-plans.store'), $payload)
        ->assertSessionHasErrors(['rooms.0.key', 'rooms.1.key', 'rooms.0.door', 'site_x1']);

    expect(FloorPlan::count())->toBe(0);
});

test('a building can only have one floor plan', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $plan = FloorPlan::factory()->create();

    $this->actingAs($admin)
        ->post(route('admin.floor-plans.store'), floorPlanPayload($plan->campusLocation))
        ->assertSessionHasErrors(['campus_location_id' => 'This building already has a floor plan.']);
});

test('saving a plan unplaces offices whose room was removed', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $building = CampusLocation::factory()->create();
    $plan = FloorPlan::factory()->create(['campus_location_id' => $building->id]);
    $registrar = DirectoryEntry::factory()->create(['campus_location_id' => $building->id, 'floor_room' => 'registrar']);
    $cashier = DirectoryEntry::factory()->create(['campus_location_id' => $building->id, 'floor_room' => 'cashier']);
    $payload = floorPlanPayload($building);
    array_shift($payload['rooms']); // the registrar's room is gone

    $this->actingAs($admin)
        ->put(route('admin.floor-plans.update', $plan), $payload)
        ->assertRedirect(route('admin.floor-plans.edit', $plan));

    expect($registrar->fresh()->floor_room)->toBeNull()
        ->and($cashier->fresh()->floor_room)->toBe('cashier')
        ->and($plan->fresh()->roomKeys())->toBe(['cashier']);
});

test('replacing or removing the picture cleans up the old file', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $plan = FloorPlan::factory()->create();
    $plan->forceFill(['image_path' => UploadedFile::fake()->image('old.jpg')->store('floor-plans', 'public')])->save();
    $old = $plan->image_path;

    $this->actingAs($admin)
        ->put(route('admin.floor-plans.update', $plan), floorPlanPayload($plan->campusLocation, [
            'image' => UploadedFile::fake()->image('new.png'),
        ]))
        ->assertSessionHasNoErrors();

    Storage::disk('public')->assertMissing($old);
    $new = $plan->fresh()->image_path;
    Storage::disk('public')->assertExists($new);

    $this->actingAs($admin)
        ->put(route('admin.floor-plans.update', $plan), floorPlanPayload($plan->campusLocation, ['remove_image' => '1']))
        ->assertSessionHasNoErrors();

    Storage::disk('public')->assertMissing($new);
    expect($plan->fresh()->image_path)->toBeNull();
});

test('removing a floor plan sends offices back to the building', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $plan = FloorPlan::factory()->create();
    $office = DirectoryEntry::factory()->create(['campus_location_id' => $plan->campus_location_id, 'floor_room' => 'registrar']);

    $this->actingAs($admin)
        ->delete(route('admin.floor-plans.destroy', $plan))
        ->assertRedirect(route('admin.floor-plans.index'));

    expect(FloorPlan::count())->toBe(0)
        ->and($office->fresh()->floor_room)->toBeNull()
        ->and($office->fresh()->campus_location_id)->toBe($plan->campus_location_id);
});

test('the kiosk and the directory get the drawn floor plans', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $plan = FloorPlan::factory()->create();

    $this->get(route('home'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('floorPlans', 1)
            ->where('floorPlans.0.campusLocationId', $plan->campus_location_id)
            ->where('floorPlans.0.building', $plan->campusLocation->name)
            ->where('floorPlans.0.site.x1', 50)
            ->where('floorPlans.0.rooms.0.key', 'registrar')
            ->where('floorPlans.0.entrances.0.inward', 'north'));

    $this->actingAs($admin)
        ->get(route('admin.directory-entries.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('floorPlans.0.campus_location_id', $plan->campus_location_id)
            ->where('floorPlans.0.rooms.0', ['key' => 'registrar', 'name' => 'Registrar', 'kind' => 'office']));
});

test('the traced school floor signs carry over', function () {
    CampusLocation::factory()->create(['name' => 'Main Building']);
    CampusLocation::factory()->create(['name' => 'AIT Building']);

    (new FloorPlanSeeder)->run();
    (new FloorPlanSeeder)->run();

    expect(FloorPlan::count())->toBe(2);
    $main = FloorPlan::whereRelation('campusLocation', 'name', 'Main Building')->sole();
    expect($main->roomKeys())->toContain('registrar', 'cashier', 'clinic')
        ->and($main->entrances)->toHaveCount(3);
});

test('deleting a building removes its floor plan picture', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $plan = FloorPlan::factory()->create();
    $plan->forceFill(['image_path' => UploadedFile::fake()->image('sign.jpg')->store('floor-plans', 'public')])->save();

    $this->actingAs($admin)
        ->delete(route('admin.campus-locations.destroy', $plan->campus_location_id))
        ->assertRedirect();

    expect(FloorPlan::count())->toBe(0);
    Storage::disk('public')->assertMissing($plan->image_path);
});
