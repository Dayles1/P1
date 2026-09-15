<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;

/**
 * The schema already has per-member, per-permission grants
 * (conversation_user_permissions) but nothing seeds or manages them yet —
 * so the real-world default is "no elevated permissions for anyone". The
 * rule that actually matters today, and the one the product spec asks
 * for, is simple: you can always edit/delete/pin your own messages; acting
 * on someone else's requires an explicit permission grant, which this
 * still checks so the schema isn't dead weight once such grants exist.
 */
class ChatPermissions
{
    public static function canModify(ConversationUser $membership, Message $message, string $permissionKey): bool
    {
        if ((int) $message->user_id === (int) $membership->user_id) {
            return true;
        }

        return $membership->permissions()
            ->where('permission_key', $permissionKey)
            ->where('is_allowed', true)
            ->exists();
    }
}
