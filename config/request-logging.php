<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Enabled
    |--------------------------------------------------------------------------
    */
    'enabled' => env('REQUEST_LOGGING_ENABLED', true),

    /*
    |--------------------------------------------------------------------------
    | Max stored bytes
    |--------------------------------------------------------------------------
    |
    | Request/response bodies are JSON-encoded then hard-truncated to this
    | many bytes before being persisted, so a handful of huge uploads or
    | responses can't blow up the table.
    |
    */
    'max_body_bytes' => env('REQUEST_LOGGING_MAX_BODY_BYTES', 8192),

    /*
    |--------------------------------------------------------------------------
    | Redacted keys
    |--------------------------------------------------------------------------
    |
    | Case-insensitive body/query field names and header names that get
    | replaced with "[REDACTED]" instead of their real value before a log
    | row is ever written to the database.
    |
    */
    'redacted_keys' => [
        'password',
        'password_confirmation',
        'current_password',
        'new_password',
        'token',
        'access_token',
        'refresh_token',
        'plaintext_token',
        'secret',
        'api_key',
        'apikey',
        'client_secret',
        'private_key',
        'credit_card',
        'card_number',
        'card_expiry',
        'cvv',
        'cvc',
    ],

    'redacted_headers' => [
        'authorization',
        'cookie',
        'set-cookie',
        'x-xsrf-token',
        'x-csrf-token',
        'proxy-authorization',
    ],

    /*
    |--------------------------------------------------------------------------
    | Excluded paths
    |--------------------------------------------------------------------------
    |
    | Request path patterns (matched against Request::is()) that are never
    | logged — mainly the request-log viewer endpoints themselves, so
    | browsing your own request history doesn't recursively spam it.
    |
    */
    'excluded_paths' => [
        'api/sessions/*/request-logs*',
        'api/admin/sessions/*/request-logs*',
        'api/up',
    ],
];
