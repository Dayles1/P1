<?php

namespace App\Domain\Notification\Services;

use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserSession;
use App\Domain\Notification\Notifications\NewLoginNotification;
use App\Infrastructure\Broadcasting\LiveUpdates;

/**
 * Tells a user someone signed in to their account — but only from a
 * browser, platform and IP address combination this account has never
 * signed in from before, and never on the account's very first login.
 */
class LoginNotifier
{
    public function sessionIssued(User $user, UserSession $session): void
    {
        $previous = UserSession::query()
            ->where('user_id', $user->id)
            ->whereKeyNot($session->id);

        if (! (clone $previous)->exists()) {
            return;
        }

        $seenBefore = $previous
            ->where('browser', $session->browser)
            ->where('platform', $session->platform)
            ->where('ip_address', $session->ip_address)
            ->exists();

        if ($seenBefore) {
            return;
        }

        $user->loadMissing('settings');

        LiveUpdates::safely(fn () => $user->notify(new NewLoginNotification($session)));
    }
}
