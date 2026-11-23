<?php

use App\Models\ChatbotLog;
use App\Services\ChatbotService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('asking the chatbot logs the question and answer', function () {
    $this->mock(ChatbotService::class)
        ->shouldReceive('ask')
        ->once()
        ->with('What are the enrollment requirements?', [])
        ->andReturn('You can find enrollment requirements in the registrar section.');

    $response = $this->postJson(route('chatbot.ask'), [
        'session_id' => 'kiosk-session-123',
        'message' => 'What are the enrollment requirements?',
    ]);

    $response->assertOk();
    $response->assertJson([
        'answer' => 'You can find enrollment requirements in the registrar section.',
    ]);

    expect(ChatbotLog::count())->toBe(1);

    $log = ChatbotLog::first();
    expect($log->session_id)->toBe('kiosk-session-123');
    expect($log->question)->toBe('What are the enrollment requirements?');
    expect($log->answer)->toBe('You can find enrollment requirements in the registrar section.');
    expect($log->was_helpful)->toBeNull();
});

test('chatbot message requires session_id and message', function () {
    $response = $this->postJson(route('chatbot.ask'), []);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors(['session_id', 'message']);
});

test('feedback updates the log', function () {
    $log = ChatbotLog::create([
        'session_id' => 'kiosk-session-123',
        'question' => 'When is the enrollment period?',
        'answer' => 'Enrollment is open from June to August.',
    ]);

    $response = $this->patchJson(route('chatbot.feedback', $log), [
        'helpful' => true,
    ]);

    $response->assertOk();
    expect($log->fresh()->was_helpful)->toBeTrue();
});
