<?php

use App\Domain\Identity\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

/**
 * Instance-wide presence channel: any authenticated user may join, and
 * simply being a member of it *is* the "online" signal (Reverb/Pusher
 * presence channels track join/leave natively) — no heartbeat endpoint,
 * no polling. "Last seen" for someone not currently a member comes from
 * `users.last_seen_at` (see TouchLastSeen middleware) instead.
 */
Broadcast::channel('online', function (User $user) {
    return ['id' => $user->id, 'name' => $user->name];
});
