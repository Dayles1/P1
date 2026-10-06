<?php

namespace App\Domain\Notification\Notifications;

use App\Domain\Identity\Models\User;
use App\Domain\Notification\Services\NotificationPreferences;
use Illuminate\Notifications\Messages\BroadcastMessage;
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

    /**
     * @return array<string, mixed>
     */
    abstract public function toDatabase(User $notifiable): array;

    /**
     * @return array<int, string>
     */
    public function via(User $notifiable): array
    {
        // Mentions are the one type that always lands in the database (and
        // broadcasts live), regardless of preferences — enforced here, not
        // by relying on every preference default happening to be true.
        if ($this->type() === 'mention') {
            return ['database', 'broadcast'];
        }

        $prefs = NotificationPreferences::for($notifiable);

        return $prefs->allowsDatabase($this->type()) ? ['database', 'broadcast'] : [];
    }

    /**
     * Pushed over the already-authorized `App.Models.User.{id}` private
     * channel (see User::receivesBroadcastNotificationsOn) the instant this
     * notification is sent — the header bell subscribes to it instead of
     * polling. Reuses toDatabase()'s payload so there's one place each type
     * defines its content; `type` is deliberately stripped here because
     * BroadcastNotificationCreated::broadcastWith() re-merges it in from
     * broadcastType() below — leaving it in `data` would just mean the
     * merge silently overwrites it with the same value, so this keeps the
     * two paths from quietly relying on that coincidence.
     */
    public function toBroadcast(User $notifiable): BroadcastMessage
    {
        $data = $this->toDatabase($notifiable);
        unset($data['type']);

        // Straight to Reverb in this request, not through the queue, so a
        // bell rings live without a queue worker.
        return (new BroadcastMessage($data))->onConnection('sync');
    }

    public function broadcastType(): string
    {
        return $this->type();
    }

    /** The language the recipient reads the app in. */
    protected function localeFor(User $notifiable): string
    {
        return $notifiable->settings?->locale ?: app()->getLocale();
    }

    /**
     * Who did it, as every type's `data.actor`.
     *
     * @return array{id: int, name: string, avatar: string|null}
     */
    public static function actorPayload(User $user): array
    {
        return [
            'id' => (int) $user->id,
            'name' => (string) $user->name,
            'avatar' => $user->avatar?->url,
        ];
    }

    // Deliberately no broadcastAs() override — Echo's channel.notification()
    // helper listens for the hardcoded wire event name
    // `Illuminate\Notifications\Events\BroadcastNotificationCreated`, which
    // is exactly what broadcastAs() defaults to when left alone. Overriding
    // it here would rename the actual event Reverb sends and silently break
    // that listener (see notification-bell.js).
}
