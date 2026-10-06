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

        // One type, or several separated by commas ("message,reply").
        $types = array_values(array_filter(array_map('trim', explode(',', (string) $type))));

        if (count($types) === 1) {
            $query->where('data->type', $types[0]);
        } elseif ($types !== []) {
            $query->where(function ($query) use ($types): void {
                foreach ($types as $one) {
                    $query->orWhere('data->type', $one);
                }
            });
        }

        return $query->paginate($perPage);
    }
}
