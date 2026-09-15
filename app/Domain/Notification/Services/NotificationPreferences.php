<?php

namespace App\Domain\Notification\Services;

use App\Domain\Identity\Models\User;

/**
 * Reads a user's notification preferences from `user_settings.meta`
 * (no dedicated table — this is a handful of booleans, not a domain of its
 * own). Missing keys default to enabled, so a brand-new user receives
 * notifications until they explicitly opt out.
 */
class NotificationPreferences
{
    public function __construct(
        public readonly bool $database = true,
        public readonly bool $browser = true,
        public readonly bool $message = true,
        public readonly bool $system = true,
    ) {}

    public static function for(User $user): self
    {
        $meta = $user->settings?->meta['notifications'] ?? [];

        return new self(
            database: (bool) ($meta['database'] ?? true),
            browser: (bool) ($meta['browser'] ?? true),
            message: (bool) ($meta['message'] ?? true),
            system: (bool) ($meta['system'] ?? true),
        );
    }

    /**
     * Whether database persistence is allowed for a given notification
     * type — 'mention' is intentionally not handled here: mentions always
     * persist regardless of preferences, enforced by BaseNotification
     * rather than this check, so it can never be bypassed by adding a type
     * here that happens to always return true.
     */
    public function allowsDatabase(string $type): bool
    {
        if (! $this->database) {
            return false;
        }

        return match ($type) {
            'system' => $this->system,
            'message' => $this->message,
            default => true,
        };
    }

    public function allowsBrowser(string $type): bool
    {
        if (! $this->browser) {
            return false;
        }

        return match ($type) {
            'system' => $this->system,
            'message' => $this->message,
            default => true,
        };
    }
}
