<?php

namespace App\Domain\Notification\Actions;

use App\Domain\Identity\Models\User;
use App\Domain\Notification\Events\NotificationsMarkedRead;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Notifications\DatabaseNotification;

/**
 * One place to flip notifications to read, whatever triggered it — an
 * explicit click in the bell/Notification Center, or reading the
 * underlying message in Chat (see MarkMessageRead) — so both paths
 * broadcast the same way instead of one updating the DB silently.
 *
 * Deliberately doesn't use ->toOthers(): the tab that just read a message
 * in Chat has no optimistic bell-badge update of its own (only explicit
 * bell/Notification-Center clicks do that locally), so its own header
 * needs the broadcast too. Applying it twice on the tab that *did* already
 * update optimistically is harmless — same end state either way.
 */
class MarkNotificationsRead
{
    /**
     * @param  Builder<DatabaseNotification>|MorphMany<DatabaseNotification, User>  $query
     *                                                                                      Already scoped to $user (e.g. $user->notifications()); any extra filter the caller needs.
     */
    public function handle(User $user, Builder|MorphMany $query): void
    {
        $ids = (clone $query)->whereNull('read_at')->pluck('id');

        if ($ids->isEmpty()) {
            return;
        }

        DatabaseNotification::query()->whereIn('id', $ids)->update(['read_at' => now()]);

        broadcast(new NotificationsMarkedRead(
            userId: $user->id,
            notificationIds: $ids->all(),
            unreadCount: $user->unreadNotifications()->count(),
        ));
    }
}
