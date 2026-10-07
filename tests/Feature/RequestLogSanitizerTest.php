<?php

use App\Infrastructure\Logging\RequestLogSanitizer;

test('truncating a large body never splits a multi-byte character', function () {
    config(['request-logging.max_body_bytes' => 101]);

    [$captured, $truncated] = app(RequestLogSanitizer::class)->capture(['text' => str_repeat('ж', 200)]);

    expect($truncated)->toBeTrue()
        ->and(mb_check_encoding($captured['_preview'], 'UTF-8'))->toBeTrue()
        ->and(json_encode($captured))->not->toBeFalse();
});
