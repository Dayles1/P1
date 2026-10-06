<?php

namespace App\Domain\Identity\Actions\User;

use App\Domain\Identity\Models\User;
use Illuminate\Database\Eloquent\Collection;

class SearchUsers
{
    private const MAX_RESULTS = 10;

    public function handle(User $requester, string $query): Collection
    {
        if (mb_strlen($query) < 2) {
            return new Collection;
        }

        return User::query()
            ->whereKeyNot($requester->id)
            ->notBanned()
            ->where(function ($q) use ($query) {
                // Wildcards in what was typed are matched literally.
                $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $query).'%';

                $q->whereRaw("name like ? escape '!'", [$pattern])
                    ->orWhereRaw("email like ? escape '!'", [$pattern]);
            })
            ->orderBy('name')
            ->limit(self::MAX_RESULTS)
            ->get(['id', 'name', 'email']);
    }
}
