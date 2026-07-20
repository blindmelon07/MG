<?php

use App\Models\Announcement;
use App\Models\Manual;
use App\Models\ManualCategory;
use App\Models\User;
use App\Services\ChatbotService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('offline search matches a published manual by keyword', function () {
    config(['services.anthropic.enabled' => false]);

    $user = User::factory()->create();
    $category = ManualCategory::factory()->create();
    Manual::factory()->published()->create([
        'manual_category_id' => $category->id,
        'created_by' => $user->id,
        'title' => 'Dress Code Policy',
        'content' => 'Students must wear the prescribed uniform on regular school days.',
    ]);

    $answer = app(ChatbotService::class)->ask('What is the dress code?');

    expect($answer)->toContain('Dress Code Policy');
    expect($answer)->toContain('uniform');
});

test('offline search matches a published event announcement and includes its date', function () {
    config(['services.anthropic.enabled' => false]);

    $user = User::factory()->create();
    Announcement::factory()->published()->event()->create([
        'created_by' => $user->id,
        'title' => 'Foundation Day Celebration',
        'content' => 'Join us for games, food, and performances celebrating the school anniversary.',
    ]);

    $answer = app(ChatbotService::class)->ask('When is the foundation day celebration?');

    expect($answer)->toContain('Foundation Day Celebration');
});

test('offline search falls back gracefully when nothing matches', function () {
    config(['services.anthropic.enabled' => false]);

    $answer = app(ChatbotService::class)->ask('What is the weather on Mars?');

    expect($answer)->toContain("couldn't find anything");
});

test('draft manuals are not matched by offline search', function () {
    config(['services.anthropic.enabled' => false]);

    $user = User::factory()->create();
    $category = ManualCategory::factory()->create();
    Manual::factory()->create([
        'manual_category_id' => $category->id,
        'created_by' => $user->id,
        'title' => 'Draft Grading Policy',
        'content' => 'This grading policy is still under review.',
        'status' => 'draft',
    ]);

    $answer = app(ChatbotService::class)->ask('What is the grading policy?');

    expect($answer)->not->toContain('Draft Grading Policy');
});
