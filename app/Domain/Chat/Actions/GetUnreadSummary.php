<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Identity\Models\User;

/**
 * The member's unread totals for badges: `total` unread messages in chats
 * that are neither muted nor archived, `chats` = how many such chats have
 * something unread (or are marked unread), `archived_unread` in archived
 * chats, `muted` in muted ones (not part of `total`).
 */
class GetUnreadSummary
{
    /**
     * @return array{total: int, chats: int, archived_unread: int, muted: int}
     */
    public function handle(User $user): array
    {
        $summary = ['total' => 0, 'chats' => 0, 'archived_unread' => 0, 'muted' => 0];

        ConversationUser::query()
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->where('is_hidden', false)
            ->where(fn ($query) => $query->where('unread_count', '>', 0)->orWhere('marked_unread', true))
            ->get(['unread_count', 'marked_unread', 'archived_at', 'muted_until', 'notifications_enabled'])
            ->each(function (ConversationUser $membership) use (&$summary): void {
                $unread = (int) $membership->unread_count;

                if ($membership->archived_at !== null) {
                    $summary['archived_unread'] += $unread;
                } elseif ($membership->isMuted()) {
                    $summary['muted'] += $unread;
                } else {
                    $summary['total'] += $unread;
                    $summary['chats']++;
                }
            });

        return $summary;
    }
}
