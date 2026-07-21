<?php

use App\Services\SmsService;

test('it normalizes philippine mobile numbers to the 63 format', function (string $input, string $expected) {
    $service = new SmsService;

    expect($service->normalize($input))->toBe($expected);
})->with([
    ['09171234567', '639171234567'],
    ['+639171234567', '639171234567'],
    ['639171234567', '639171234567'],
]);
