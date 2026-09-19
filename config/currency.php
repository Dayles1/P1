<?php

return [

    /*
    |--------------------------------------------------------------------------
    | App currency
    |--------------------------------------------------------------------------
    |
    | Everything is quoted against this: rates are stored as "units per 1
    | base" and a price keeps a snapshot of its value in it. Administrators
    | change it through the `system.base_currency_code` setting; this is
    | only the fallback for before that row exists.
    |
    */

    'base' => env('CURRENCY_BASE', 'USD'),

    /*
    |--------------------------------------------------------------------------
    | Rate provider
    |--------------------------------------------------------------------------
    */

    'provider' => [
        'endpoint' => env('CURRENCY_PROVIDER_ENDPOINT', 'https://open.er-api.com/v6/latest'),
        'timeout' => env('CURRENCY_PROVIDER_TIMEOUT', 20),
        'retries' => env('CURRENCY_PROVIDER_RETRIES', 3),
        'retry_delay' => env('CURRENCY_PROVIDER_RETRY_DELAY', 500),
    ],

    /*
    |--------------------------------------------------------------------------
    | Conversion scale
    |--------------------------------------------------------------------------
    |
    | Working precision for the intermediate arithmetic, before a result is
    | rounded to the target currency's own decimals. Generous on purpose:
    | converting through the base divides and then multiplies, and the
    | divisor can be in the tens of thousands (UZS) or the thousandths.
    |
    */

    'scale' => 12,

];
