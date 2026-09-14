<?php

namespace App\Policies;

use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserSession;

/**
 * Governs the user-facing `/api/sessions/*` endpoints — a user may only
 * ever view or revoke their OWN sessions there, never someone else's by
 * guessing/incrementing an id. Admin oversight of every user's sessions is a
 * separate concern, gated by the `role:SUPER_ADMIN,ADMIN` route middleware
 * on `/api/admin/sessions/*` instead of by this policy.
 */
class UserSessionPolicy
{
    public function manage(User $user, UserSession $session): bool
    {
        return (int) $session->user_id === (int) $user->id;
    }
}
