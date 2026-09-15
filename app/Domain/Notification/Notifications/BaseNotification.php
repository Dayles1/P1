<?php

namespace App\Domain\Notification\Notifications;

use App\Domain\Identity\Models\User;
use App\Domain\Notification\Services\NotificationPreferences;
use Illuminate\Notifications\Notification;

/**
 * Every notification type extends this instead of hand-rolling `via()` /
 * preference checks — add a new type by adding a subclass (type() +
 * toDatabase()), not by editing a growing if/else somewhere central.
 */
abstract class BaseNotification extends Notification
{
    /** Discriminator stored in `data.type` — what the frontend dispatches on. */
    abstract public function type(): string;

    abstract public function toDatabase(User $notifiable): array;

    public function via(User $notifiable): array
    {
        // Mentions are the one type that always lands in the database,
        // regardless of preferences — enforced here, not by relying on
        // every preference default happening to be true.
        if ($this->type() === 'mention') {
            return ['database'];
        }

        $prefs = NotificationPreferences::for($notifiable);

        return $prefs->allowsDatabase($this->type()) ? ['database'] : [];
    }
}
