<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Authentication Language Lines
    |--------------------------------------------------------------------------
    */

    'failed' => 'These credentials do not match our records.',
    'password' => 'The provided password is incorrect.',
    'throttle' => 'Too many login attempts. Please try again in :seconds seconds.',

    // App-specific auth errors
    'invalid_credentials' => 'These credentials do not match our records.',
    'login_closed' => 'Sign in is currently disabled.',
    'registration_closed' => 'Registration is currently disabled.',
    'max_users_limit_reached' => 'The maximum number of accounts has been reached. Please try again later.',
    'daily_registration_limit_reached' => 'The daily registration limit has been reached. Please try again tomorrow.',
    'user_banned' => 'Your account has been suspended.',
    'department_banned' => 'Your department has been suspended.',
    'role_not_allowed' => 'Your account is not allowed to sign in.',
    'unauthenticated' => 'You need to sign in to continue.',

    'verification_code' => [
        'invalid' => 'That code is incorrect.',
        'expired' => 'That code has expired. Request a new one.',
        'too_many_attempts' => 'Too many incorrect attempts. Request a new code.',
        'login_subject' => 'Your sign-in verification code',
        'login_intro' => 'Enter this code to finish signing in:',
        'passwordless_subject' => 'Your one-time sign-in code',
        'passwordless_intro' => 'Enter this code to sign in:',
        'generic_subject' => 'Your verification code',
        'generic_intro' => 'Enter this code to continue:',
        'expires' => 'This code expires in :minutes minutes.',
    ],

    'verify_email' => [
        'subject' => 'Verify your email address',
        'intro' => 'Click the button below to verify your email address.',
        'action' => 'Verify Email Address',
        'or_code' => 'Or enter this code instead:',
        'expires' => 'This code expires in :minutes minutes.',
    ],

];
