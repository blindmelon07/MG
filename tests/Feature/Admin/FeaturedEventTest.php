<?php

use App\Models\Announcement;
use App\Models\Media;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

function featuredEventPayload(array $overrides = []): array
{
    return [
        'title' => 'Foundation Day',
        'content' => 'Join us for the college foundation day celebration.',
        'type' => 'event',
        'event_start_at' => now()->addWeek()->format('Y-m-d H:i'),
        'status' => 'published',
        'audience' => 'all',
        'skip_sms' => '1',
        'is_featured' => '1',
        ...$overrides,
    ];
}

test('admin can feature an event when creating it', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->post(route('admin.announcements.store'), featuredEventPayload())
        ->assertRedirect(route('admin.announcements.index'));

    expect(Announcement::firstOrFail()->is_featured)->toBeTrue();
});

test('an event is not featured when the box is left unticked', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $payload = featuredEventPayload();
    unset($payload['is_featured']);

    $this->actingAs($admin)->post(route('admin.announcements.store'), $payload);

    expect(Announcement::firstOrFail()->is_featured)->toBeFalse();
});

test('admin can feature and unfeature an existing event', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $event = Announcement::factory()->event()->published()->create(['created_by' => $admin->id]);

    $this->actingAs($admin)->put(route('admin.announcements.update', $event), featuredEventPayload())
        ->assertRedirect(route('admin.announcements.index'));

    expect($event->fresh()->is_featured)->toBeTrue();

    $payload = featuredEventPayload();
    unset($payload['is_featured']);

    $this->actingAs($admin)->put(route('admin.announcements.update', $event), $payload);

    expect($event->fresh()->is_featured)->toBeFalse();
});

test('plain announcements cannot be featured', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->post(route('admin.announcements.store'), featuredEventPayload([
        'type' => 'announcement',
        'event_start_at' => null,
    ]));

    expect(Announcement::firstOrFail()->is_featured)->toBeFalse();
});

test('the featured flag must be a yes or no value', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->post(route('admin.announcements.store'), featuredEventPayload(['is_featured' => 'maybe']))
        ->assertSessionHasErrors('is_featured');
});

test('the edit page receives the featured flag', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $event = Announcement::factory()->event()->featured()->create(['created_by' => $admin->id]);

    $this->actingAs($admin)->get(route('admin.announcements.edit', $event))
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/announcements/edit')
            ->where('announcement.is_featured', true));
});

test('the kiosk home page shows upcoming featured events, soonest first', function () {
    $later = Announcement::factory()->event()->published()->featured()->create([
        'title' => 'Sports Fest',
        'event_start_at' => now()->addDays(10),
        'event_end_at' => null,
    ]);
    $sooner = Announcement::factory()->event()->published()->featured()->create([
        'title' => 'Foundation Day',
        'event_start_at' => now()->addDays(2),
        'event_end_at' => null,
    ]);

    $this->get(route('home'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('kiosk/home')
            ->has('featuredEvents', 2)
            ->where('featuredEvents.0.id', $sooner->id)
            ->where('featuredEvents.1.id', $later->id)
            ->where('featuredEvents.0.cover_url', null));
});

test('the kiosk home page hides events that are not featured, not published, or already over', function () {
    Announcement::factory()->event()->published()->create(['title' => 'Not featured']);
    Announcement::factory()->event()->featured()->create(['title' => 'Still a draft']);
    Announcement::factory()->published()->featured()->create(['title' => 'Plain announcement']);
    Announcement::factory()->event()->published()->featured()->create([
        'title' => 'Last week',
        'event_start_at' => now()->subWeek(),
        'event_end_at' => now()->subWeek()->addHours(2),
    ]);

    $this->get(route('home'))
        ->assertInertia(fn (Assert $page) => $page->has('featuredEvents', 0));
});

test('a featured event stays on the home page until the end of the day it ends', function () {
    $event = Announcement::factory()->event()->published()->featured()->create([
        'event_start_at' => today()->setTime(7, 0),
        'event_end_at' => today()->setTime(9, 0),
    ]);

    $this->travelTo(today()->setTime(23, 0));

    $this->get(route('home'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('featuredEvents', 1)
            ->where('featuredEvents.0.id', $event->id));
});

test('featured events use their first photo as the cover', function () {
    $event = Announcement::factory()->event()->published()->featured()->create();
    $event->media()->createMany([
        ['type' => 'video', 'path' => 'media/clip.mp4', 'sort_order' => 1],
        ['type' => 'image', 'path' => 'media/second.jpg', 'sort_order' => 3],
        ['type' => 'image', 'path' => 'media/first.jpg', 'sort_order' => 2],
    ]);

    $expected = Media::where('path', 'media/first.jpg')->firstOrFail()->url;

    $this->get(route('home'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('featuredEvents.0.cover_url', $expected));
});

test('the kiosk home page shows at most six featured events', function () {
    Announcement::factory()->count(8)->event()->published()->featured()->create();

    $this->get(route('home'))
        ->assertInertia(fn (Assert $page) => $page->has('featuredEvents', 6));
});
