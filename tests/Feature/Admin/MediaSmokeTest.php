<?php

use App\Models\Announcement;
use App\Models\Manual;
use App\Models\ManualCategory;
use App\Models\Media;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

test('admin can upload and delete media on a manual', function () {
    Storage::fake('public');

    $user = User::factory()->create();
    $category = ManualCategory::factory()->create();
    $manual = Manual::factory()->create([
        'manual_category_id' => $category->id,
        'created_by' => $user->id,
    ]);

    $this->actingAs($user)
        ->post(route('admin.manuals.media.store', $manual), [
            'file' => UploadedFile::fake()->image('photo.jpg'),
            'caption' => 'Test caption',
        ])
        ->assertRedirect(route('admin.manuals.edit', $manual));

    $media = Media::first();
    expect($media)->not->toBeNull();
    expect($media->mediable_id)->toBe($manual->id);
    expect($media->type)->toBe('image');
    Storage::disk('public')->assertExists($media->path);

    $this->actingAs($user)
        ->delete(route('admin.manuals.media.destroy', [$manual, $media]))
        ->assertRedirect(route('admin.manuals.edit', $manual));

    expect(Media::count())->toBe(0);
    Storage::disk('public')->assertMissing($media->path);
});

test('kiosk manual show page exposes media url', function () {
    Storage::fake('public');

    $user = User::factory()->create();
    $category = ManualCategory::factory()->create();
    $manual = Manual::factory()->create([
        'manual_category_id' => $category->id,
        'created_by' => $user->id,
        'status' => 'published',
        'published_at' => now(),
    ]);
    $manual->media()->create([
        'type' => 'image',
        'path' => 'media/fake.jpg',
        'caption' => 'Hello',
        'sort_order' => 1,
    ]);

    $response = $this->get(route('manuals.show', $manual->slug));
    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('kiosk/manuals/show')
        ->has('manual.media.0.url')
    );
});

test('admin can upload media on an announcement', function () {
    Storage::fake('public');

    $user = User::factory()->create();
    $announcement = Announcement::factory()->create([
        'created_by' => $user->id,
    ]);

    $this->actingAs($user)
        ->post(route('admin.announcements.media.store', $announcement), [
            'file' => UploadedFile::fake()->create('clip.mp4', 100, 'video/mp4'),
        ])
        ->assertRedirect(route('admin.announcements.edit', $announcement));

    $media = Media::first();
    expect($media->type)->toBe('video');
});
