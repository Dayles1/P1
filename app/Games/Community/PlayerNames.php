<?php

namespace App\Games\Community;

use App\Domain\Identity\Models\User;

/**
 * Players' display names. They live in the main application's users table,
 * in another database, so they are looked up by id in a query of their own
 * rather than joined.
 */
class PlayerNames
{
    /**
     * @param  iterable<int>  $userIds
     * @return array<int, string> name by user id; a missing user gets «Игрок #id»
     */
    public function for(iterable $userIds): array
    {
        $ids = collect($userIds)->map(fn (mixed $id): int => (int) $id)->unique()->values();

        if ($ids->isEmpty()) {
            return [];
        }

        $names = User::query()->whereIn('id', $ids)->pluck('name', 'id');

        return $ids->mapWithKeys(fn (int $id): array => [
            $id => filled($names[$id] ?? null) ? (string) $names[$id] : __('games::messages.player_fallback', ['id' => $id]),
        ])->all();
    }
}
