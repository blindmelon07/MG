<?php

use App\Jobs\SendSmsJob;
use App\Models\Announcement;
use App\Models\Guardian;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

test('publishing an announcement to all texts every active student and guardian', function () {
    Queue::fake();

    $admin = User::factory()->create(['role' => 'admin']);
    $student = Student::factory()->create(['phone_number' => '09171234567']);
    Guardian::factory()->for($student)->create(['phone_number' => '09181234567']);
    Student::factory()->inactive()->create(['phone_number' => '09191234567']);

    $this->actingAs($admin)->post(route('admin.announcements.store'), [
        'title' => 'Foundation Day',
        'content' => 'No classes tomorrow.',
        'type' => 'announcement',
        'status' => 'published',
        'audience' => 'all',
    ])->assertRedirect(route('admin.announcements.index'));

    Queue::assertPushed(SendSmsJob::class, 2);
    Queue::assertPushed(fn (SendSmsJob $job) => $job->recipient === '09171234567');
    Queue::assertPushed(fn (SendSmsJob $job) => $job->recipient === '09181234567');
});

test('publishing a targeted announcement only texts the selected students', function () {
    Queue::fake();

    $admin = User::factory()->create(['role' => 'admin']);
    $targeted = Student::factory()->create(['phone_number' => '09171234567']);
    Student::factory()->create(['phone_number' => '09991234567']);

    $this->actingAs($admin)->post(route('admin.announcements.store'), [
        'title' => 'Class Suspended',
        'content' => 'Grade 8 classes suspended due to weather.',
        'type' => 'announcement',
        'status' => 'published',
        'audience' => 'targeted',
        'student_ids' => [$targeted->id],
    ])->assertRedirect(route('admin.announcements.index'));

    Queue::assertPushed(SendSmsJob::class, 1);
    Queue::assertPushed(fn (SendSmsJob $job) => $job->recipient === '09171234567');
});

test('saving an announcement as a draft does not send any sms', function () {
    Queue::fake();

    $admin = User::factory()->create(['role' => 'admin']);
    Student::factory()->create(['phone_number' => '09171234567']);

    $this->actingAs($admin)->post(route('admin.announcements.store'), [
        'title' => 'Draft Announcement',
        'content' => 'Not ready yet.',
        'type' => 'announcement',
        'status' => 'draft',
        'audience' => 'all',
    ]);

    Queue::assertNotPushed(SendSmsJob::class);
});

test('the skip sms checkbox suppresses sms even when publishing', function () {
    Queue::fake();

    $admin = User::factory()->create(['role' => 'admin']);
    Student::factory()->create(['phone_number' => '09171234567']);

    $this->actingAs($admin)->post(route('admin.announcements.store'), [
        'title' => 'Silent Announcement',
        'content' => 'No texts for this one.',
        'type' => 'announcement',
        'status' => 'published',
        'audience' => 'all',
        'skip_sms' => '1',
    ])->assertRedirect(route('admin.announcements.index'));

    Queue::assertNotPushed(SendSmsJob::class);
});

test('editing an already-published announcement does not resend sms', function () {
    Queue::fake();

    $admin = User::factory()->create(['role' => 'admin']);
    Student::factory()->create(['phone_number' => '09171234567']);
    $announcement = Announcement::factory()->published()->create();

    $this->actingAs($admin)->put(route('admin.announcements.update', $announcement), [
        'title' => 'Updated Title',
        'content' => $announcement->content,
        'type' => 'announcement',
        'status' => 'published',
        'audience' => 'all',
    ]);

    Queue::assertNotPushed(SendSmsJob::class);
});
