<?php

namespace App\Domain\Notification\Actions;

use App\Domain\Identity\Models\User;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Pagination\LengthAwarePaginator;

class ListNotifications
{
    /**
     * @return LengthAwarePaginator<int, DatabaseNotification>
     */
    public function handle(User $user, bool $unreadOnly = false, ?string $type = null, int $perPage = 20): LengthAwarePaginator
    {
        $query = $unreadOnly ? $user->unreadNotifications() : $user->notifications();

        if ($type !== null && $type !== '') {
            $query->where('data->type', $type);
        }

        return $query->paginate($perPage);
    }
}
