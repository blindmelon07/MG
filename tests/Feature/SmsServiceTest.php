<?php

use App\Services\SmsService;
use Illuminate\Support\Facades\Http;

test('it posts the documented pinasSMS payload and headers', function () {
    config(['services.pinassms.key' => 'test-key', 'services.pinassms.url' => 'https://pinassms.com/api/sms/send']);

    Http::fake([
        'pinassms.com/*' => Http::response(['status' => 'ok'], 200),
    ]);

    $service = new SmsService;
    $result = $service->send('09171234567', 'Hello from PinasSMS!');

    expect($result)->toBeTrue();

    Http::assertSent(function ($request) {
        return $request->url() === 'https://pinassms.com/api/sms/send'
            && $request->hasHeader('X-API-KEY', 'test-key')
            && $request['recipient'] === '639171234567'
            && $request['message'] === 'Hello from PinasSMS!';
    });
});
