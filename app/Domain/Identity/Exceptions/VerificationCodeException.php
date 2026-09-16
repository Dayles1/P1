<?php

namespace App\Domain\Identity\Exceptions;

use RuntimeException;

class VerificationCodeException extends RuntimeException
{
    public function __construct(
        public readonly string $reason,
        string $message,
    ) {
        parent::__construct($message);
    }

    public static function invalid(): self
    {
        return new self('invalid_code', __('auth.verification_code.invalid'));
    }

    public static function expired(): self
    {
        return new self('code_expired', __('auth.verification_code.expired'));
    }

    public static function tooManyAttempts(): self
    {
        return new self('too_many_attempts', __('auth.verification_code.too_many_attempts'));
    }
}
