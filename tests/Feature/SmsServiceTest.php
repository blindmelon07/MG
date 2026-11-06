<?php

use App\Services\SmsService;
use Illuminate\Support\Facades\Http;

test('it posts the documented UniSMS payload with basic auth', function () {
    config([
        'services.unisms.key' => 'sk_test',
        'services.unisms.sender_id' => 'SCHOOL',
        'services.unisms.url' => 'https://unismsapi.com/api/sms',
    ]);

    Http::fake([
        'unismsapi.com/*' => Http::response(['message' => ['status' => 'pending']], 201),
    ]);

    $service = new SmsService;
    $result = $service->send('09171234567', 'Hello from UniSMS!');

    expect($result)->toBeTrue();

    Http::assertSent(function ($request) {
        return $request->url() === 'https://unismsapi.com/api/sms'
            && $request->hasHeader('Authorization', 'Basic '.base64_encode('sk_test:'))
            && $request['recipient'] === '+639171234567'
            && $request['content'] === 'Hello from UniSMS!'
            && $request['sender_id'] === 'SCHOOL';
    });
});

test('it reports a failed send', function () {
    Http::fake([
        'unismsapi.com/*' => Http::response(['errors' => 'Unauthorized'], 401),
    ]);

    expect((new SmsService)->send('09171234567', 'Hi'))->toBeFalse();
});
