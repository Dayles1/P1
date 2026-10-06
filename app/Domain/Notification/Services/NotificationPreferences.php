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
    /**
     * The per-type switch (a key in `meta.notifications`) each notification
     * type answers to. A type missing here (mention) has no switch.
     *
     * @var array<string, string>
     */
    public const TYPE_SWITCHES = [
        'message' => 'message',
        'reply' => 'reply',
        'reaction' => 'reaction',
        'added_to_chat' => 'added_to_chat',
        'pinned' => 'pinned',
        'new_login' => 'security',
        'role_changed' => 'account',
        'system' => 'system',
        'user_report' => 'system',
    ];

    /**
     * @param  array<string, bool>  $switches  per-type switches (see TYPE_SWITCHES), missing ones on
     */
    public function __construct(
        public readonly bool $database = true,
        public readonly bool $browser = true,
        public readonly array $switches = [],
    ) {}

    public static function for(User $user): self
    {
        $meta = (array) ($user->settings?->meta['notifications'] ?? []);
        $switches = [];

        foreach (array_unique(array_values(self::TYPE_SWITCHES)) as $switch) {
            $switches[$switch] = (bool) ($meta[$switch] ?? true);
        }

        return new self(
            database: (bool) ($meta['database'] ?? true),
            browser: (bool) ($meta['browser'] ?? true),
            switches: $switches,
        );
    }

    /** Whether the user left this type's own switch on. */
    public function wants(string $type): bool
    {
        $switch = self::TYPE_SWITCHES[$type] ?? null;

        return $switch === null || ($this->switches[$switch] ?? true);
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
        return $this->database && $this->wants($type);
    }

    public function allowsBrowser(string $type): bool
    {
        return $this->browser && $this->wants($type);
    }
}
