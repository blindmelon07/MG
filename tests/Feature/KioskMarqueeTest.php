<?php

use App\Models\Announcement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

test('the kiosk home marquee lists upcoming events before announcements', function () {
    Announcement::factory()->published()->create(['title' => 'Enrollment is open']);
    Announcement::factory()->event()->published()->create([
        'title' => 'Foundation Day',
        'event_start_at' => now()->addDays(3),
    ]);

    $this->get(route('home'))->assertInertia(fn (Assert $page) => $page
        ->component('kiosk/home')
        ->has('ticker', 2)
        ->where('ticker.0.title', 'Foundation Day')
        ->where('ticker.1.title', 'Enrollment is open'));
});

test('the marquee leaves out drafts, past events and notices not meant for everyone', function () {
    Announcement::factory()->create(['title' => 'Draft notice']);
    Announcement::factory()->published()->create(['title' => 'Only some students', 'audience' => 'targeted']);
    Announcement::factory()->event()->published()->create([
        'title' => 'Last month',
        'event_start_at' => now()->subMonth(),
        'event_end_at' => now()->subMonth()->addHours(3),
    ]);

    $this->get(route('home'))->assertInertia(fn (Assert $page) => $page
        ->has('ticker', 0));
});

test('the on-screen keyboard follows the kiosk keyboard setting', function () {
    config(['kiosk.keyboard' => true]);

    $this->get(route('home'))->assertInertia(fn (Assert $page) => $page
        ->where('kioskKeyboard', true));

    config(['kiosk.keyboard' => false]);

    $this->get(route('home'))->assertInertia(fn (Assert $page) => $page
        ->where('kioskKeyboard', false));
});

test('the built-in keyboard is on by default', function () {
    expect(config('kiosk.keyboard'))->toBeTrue();
});
