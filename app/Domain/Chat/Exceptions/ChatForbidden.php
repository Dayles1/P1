<?php

namespace App\Domain\Chat\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * The requester is a member but may not do this (403). `code` is a stable
 * machine-readable reason, e.g. `chat.blocked`, that the client can branch on.
 */
class ChatForbidden extends RuntimeException
{
    public function __construct(
        public readonly string $reason = 'chat.forbidden',
        ?string $message = null,
    ) {
        parent::__construct($message ?? __('messages.chat.not_allowed'));
    }

    public static function because(string $reason, string $translationKey = 'messages.chat.not_allowed'): self
    {
        return new self($reason, __($translationKey));
    }

    public function render(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $this->getMessage(),
            'data' => null,
            'code' => $this->reason,
        ], 403);
    }
}
