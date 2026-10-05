<?php

use App\Jobs\SendSmsJob;
use App\Models\Announcement;
use App\Models\CampusLocation;
use App\Models\Student;
use App\Models\User;
use App\Notifications\AnnouncementPublished;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

function eventPayload(array $overrides = []): array
{
    return [
        'title' => 'Faculty Meeting',
        'content' => 'Quarterly faculty meeting.',
        'type' => 'event',
        'event_start_at' => now()->addDay()->format('Y-m-d H:i'),
        'status' => 'published',
        'audience' => 'none',
        'personnel_roles' => ['teacher'],
        ...$overrides,
    ];
}

test('an event can go to faculty only, by sms and email', function () {
    Queue::fake();
    Notification::fake();

    $admin = User::factory()->create(['role' => 'admin']);
    $teacher = User::factory()->create(['role' => 'teacher', 'phone_number' => '09171234567']);
    $teacherWithoutPhone = User::factory()->create(['role' => 'teacher']);
    $registrar = User::factory()->create(['role' => 'registrar', 'phone_number' => '09181234567']);
    Student::factory()->create(['phone_number' => '09191234567']);

    $this->actingAs($admin)->post(route('admin.announcements.store'), eventPayload())
        ->assertRedirect(route('admin.announcements.index'));

    Queue::assertPushed(SendSmsJob::class, 1);
    Queue::assertPushed(fn (SendSmsJob $job) => $job->recipient === '09171234567');
    Notification::assertSentTo([$teacher, $teacherWithoutPhone], AnnouncementPublished::class);
    Notification::assertNotSentTo($registrar, AnnouncementPublished::class);
});

test('personnel are notified alongside students', function () {
    Queue::fake();
    Notification::fake();

    $admin = User::factory()->create(['role' => 'admin', 'phone_number' => '09181234567']);
    Student::factory()->create(['phone_number' => '09171234567']);

    $this->actingAs($admin)->post(route('admin.announcements.store'), eventPayload([
        'audience' => 'all',
        'personnel_roles' => ['admin'],
    ]));

    Queue::assertPushed(SendSmsJob::class, 2);
    Notification::assertSentTo($admin, AnnouncementPublished::class);
});

test('personnel-only announcements need at least one personnel group', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->post(route('admin.announcements.store'), eventPayload(['personnel_roles' => []]))
        ->assertSessionHasErrors('personnel_roles');
});

test('the sms for an event with a map area links to that spot on the campus map', function () {
    Queue::fake();
    Notification::fake();

    $admin = User::factory()->create(['role' => 'admin']);
    User::factory()->create(['role' => 'teacher', 'phone_number' => '09171234567']);
    $gym = CampusLocation::factory()->create(['name' => 'Gymnasium']);

    $this->actingAs($admin)->post(route('admin.announcements.store'), eventPayload([
        'campus_location_id' => $gym->id,
    ]));

    $announcement = Announcement::firstOrFail();
    $mapUrl = route('maps.index', ['location' => $gym->id, 'event' => $announcement->slug]);

    expect($announcement->campus_location_id)->toBe($gym->id)
        ->and($announcement->publicUrl())->toBe($mapUrl);
    Queue::assertPushed(fn (SendSmsJob $job) => str_contains($job->message, $mapUrl)
        && str_contains($job->message, 'Venue: Gymnasium'));
    Notification::assertSentTo(User::where('role', 'teacher')->first(), function (AnnouncementPublished $notification, array $channels, object $notifiable) use ($mapUrl) {
        return $notification->toMail($notifiable)->actionUrl === $mapUrl;
    });
});

test('a plain announcement does not keep a map area', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $gym = CampusLocation::factory()->create();

    $this->actingAs($admin)->post(route('admin.announcements.store'), eventPayload([
        'type' => 'announcement',
        'status' => 'draft',
        'campus_location_id' => $gym->id,
    ]));

    expect(Announcement::firstOrFail()->campus_location_id)->toBeNull();
});

test('photos and videos can be uploaded while creating an announcement', function () {
    Storage::fake('public');

    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->post(route('admin.announcements.store'), eventPayload([
        'status' => 'draft',
        'media' => [
            UploadedFile::fake()->image('poster.jpg'),
            UploadedFile::fake()->create('teaser.mp4', 500, 'video/mp4'),
        ],
    ]))->assertRedirect(route('admin.announcements.index'));

    $media = Announcement::firstOrFail()->media;
    expect($media)->toHaveCount(2)
        ->and($media->pluck('type')->all())->toBe(['image', 'video']);
    Storage::disk('public')->assertExists($media->first()->path);
});

test('the campus map opens at the area of an event link', function () {
    $gym = CampusLocation::factory()->create();
    $event = Announcement::factory()->published()->create([
        'type' => 'event',
        'event_start_at' => now()->addDay(),
        'campus_location_id' => $gym->id,
    ]);

    $this->get(route('maps.index', ['location' => $gym->id, 'event' => (string) $event->slug]))
        ->assertInertia(fn ($page) => $page
            ->component('kiosk/maps/index')
            ->where('focusLocationId', $gym->id)
            ->where('event.title', $event->title));
});
