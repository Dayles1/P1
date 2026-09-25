<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Where the payer lands after an external checkout
    |--------------------------------------------------------------------------
    |
    | `{payment}` is replaced with the payment's uuid, so the frontend can
    | poll the payment and show the outcome.
    |
    */

    'return_url' => env('PAYMENT_RETURN_URL', env('APP_URL').'/payments/{payment}'),

    'http' => [
        'timeout' => env('PAYMENT_HTTP_TIMEOUT', 20),
    ],

    /*
    |--------------------------------------------------------------------------
    | Providers
    |--------------------------------------------------------------------------
    */

    'providers' => [

        /*
         * Click — Shop API (prepare/complete callbacks) for checkout, and
         * the Merchant API for card tokens.
         */
        'click' => [
            'service_id' => env('CLICK_SERVICE_ID'),
            'merchant_id' => env('CLICK_MERCHANT_ID'),
            'merchant_user_id' => env('CLICK_MERCHANT_USER_ID'),
            'secret_key' => env('CLICK_SECRET_KEY'),
            'checkout_url' => env('CLICK_CHECKOUT_URL', 'https://my.click.uz/services/pay'),
            'api_url' => env('CLICK_API_URL', 'https://api.click.uz/v2/merchant'),
        ],

        /*
         * Payme — Merchant API (JSON-RPC callbacks) for checkout, and the
         * Subscribe API for card tokens and charging them.
         */
        'payme' => [
            'merchant_id' => env('PAYME_MERCHANT_ID'),
            'key' => env('PAYME_KEY'),
            'checkout_url' => env('PAYME_CHECKOUT_URL', 'https://checkout.paycom.uz'),
            'api_url' => env('PAYME_API_URL', 'https://checkout.paycom.uz/api'),

            /** The account field configured on the Payme cashbox. */
            'account_key' => env('PAYME_ACCOUNT_KEY', 'payment_id'),
        ],

        'oneqr' => [
            'api_url' => env('ONEQR_API_URL'),
            'api_key' => env('ONEQR_API_KEY'),
            'secret' => env('ONEQR_SECRET'),
        ],

    ],

];
