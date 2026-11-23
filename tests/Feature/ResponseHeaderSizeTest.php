<?php

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/*
 * Hostinger rejects responses whose headers pass about 8 KB with its own
 * 500 page, and nothing reaches Laravel's log. The Link preload header did
 * exactly that on the bigger pages, so keep headers well under the limit.
 */
test('pages keep their response headers small enough for the host', function (string $uri) {
    $response = $this->get($uri);

    $size = collect($response->headers->all())
        ->map(fn (array $values, string $name) => collect($values)->sum(fn ($value) => strlen($name) + strlen((string) $value) + 4))
        ->sum();

    expect($response->headers->has('Link'))->toBeFalse()
        ->and($size)->toBeLessThan(4096);
})->with(['/', '/maps', '/login', '/directory', '/student/login']);
