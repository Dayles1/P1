<?php

namespace App\Domain\Identity\Actions\User;

use App\Domain\Identity\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class ListUsers
{
    public function handle(array $filters = []): LengthAwarePaginator
    {
        $query = User::query()->with(['roles', 'ban', 'avatar']);

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if (! empty($filters['role'])) {
            $role = $filters['role'];
            $query->whereHas('roles', fn ($q) => $q->where('code', $role));
        }

        return $query->latest('id')->paginate($filters['per_page'] ?? 20);
    }
}
