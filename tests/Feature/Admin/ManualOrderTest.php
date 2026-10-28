<?php

use App\Models\Manual;
use App\Models\ManualCategory;
use App\Models\User;

test('a new manual goes to the end of its category', function () {
    $admin = User::factory()->withTwoFactor()->create(['role' => 'admin']);
    $category = ManualCategory::factory()->create();
    Manual::factory()->for($category, 'category')->create(['sort_order' => 4]);

    $this->actingAs($admin)->post(route('admin.manuals.store'), [
        'manual_category_id' => $category->id,
        'title' => 'Library Rules',
        'content' => 'Keep quiet.',
        'status' => 'published',
    ]);

    expect(Manual::where('title', 'Library Rules')->value('sort_order'))->toBe(5);
});

test('admins can move a manual up or down within its category', function () {
    $admin = User::factory()->withTwoFactor()->create(['role' => 'admin']);
    $category = ManualCategory::factory()->create();
    [$first, $second, $third] = collect(['Alpha', 'Bravo', 'Charlie'])
        ->map(fn (string $title, int $i) => Manual::factory()->for($category, 'category')->create(['title' => $title, 'sort_order' => $i + 1]));

    $this->actingAs($admin)->post(route('admin.manuals.move', $third), ['direction' => 'up'])->assertRedirect();
    $this->post(route('admin.manuals.move', $first), ['direction' => 'up']);

    expect(Manual::inReadingOrder()->pluck('title')->all())->toBe(['Alpha', 'Charlie', 'Bravo']);

    $this->post(route('admin.manuals.move', $first), ['direction' => 'down']);

    expect(Manual::inReadingOrder()->pluck('title')->all())->toBe(['Charlie', 'Alpha', 'Bravo'])
        ->and($second->fresh()->sort_order)->toBe(3);
});

test('the kiosk lists manuals in order and links to the next and previous one', function () {
    $later = ManualCategory::factory()->create(['sort_order' => 2]);
    $earlier = ManualCategory::factory()->create(['sort_order' => 1]);

    Manual::factory()->for($later, 'category')->create(['title' => 'Zeta', 'slug' => 'zeta', 'status' => 'published', 'sort_order' => 1]);
    Manual::factory()->for($earlier, 'category')->create(['title' => 'Second', 'slug' => 'second', 'status' => 'published', 'sort_order' => 2]);
    Manual::factory()->for($earlier, 'category')->create(['title' => 'First', 'slug' => 'first', 'status' => 'published', 'sort_order' => 1]);

    $this->get(route('manuals.index'))
        ->assertInertia(fn ($page) => $page
            ->where('manuals.0.title', 'First')
            ->where('manuals.1.title', 'Second')
            ->where('manuals.2.title', 'Zeta'));

    $this->get(route('manuals.show', 'second'))
        ->assertInertia(fn ($page) => $page
            ->where('previous.slug', 'first')
            ->where('next.slug', 'zeta'));

    $this->get(route('manuals.show', 'first'))
        ->assertInertia(fn ($page) => $page->where('previous', null));
});
