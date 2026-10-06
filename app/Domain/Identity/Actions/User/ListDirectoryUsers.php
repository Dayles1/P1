<?php

namespace App\Domain\Identity\Actions\User;

use App\Domain\AccessControl\Models\Role;
use App\Domain\Identity\Models\User;
use Illuminate\Pagination\LengthAwarePaginator;

class ListDirectoryUsers
{
    public const DEFAULT_PER_PAGE = 50;

    /**
     * Everyone the requester can find in the people directory, by name. A
     * super admin sees banned accounts too; nobody else does.
     *
     * @param  array{q?: string|null, per_page?: int|string|null}  $filters
     * @return LengthAwarePaginator<int, User>
     */
    public function handle(User $requester, array $filters = []): LengthAwarePaginator
    {
        $query = User::query()
            ->with(['avatar', 'roles', 'ban'])
            ->whereKeyNot($requester->id);

        if (! $requester->hasRole(Role::SUPER_ADMIN)) {
            $query->notBanned();
        }

        $search = trim((string) ($filters['q'] ?? ''));

        if ($search !== '') {
            // "!" rather than "\" as the LIKE escape: it means the same thing
            // to every database driver, including SQLite.
            $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search).'%';

            $query->where(fn ($match) => $match
                ->whereRaw("name like ? escape '!'", [$pattern])
                ->orWhereRaw("email like ? escape '!'", [$pattern]));
        }

        return $query
            ->orderBy('name')
            ->orderBy('id')
            ->paginate((int) ($filters['per_page'] ?? self::DEFAULT_PER_PAGE));
    }
}
