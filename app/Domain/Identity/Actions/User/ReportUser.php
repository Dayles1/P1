<?php

namespace App\Domain\Identity\Actions\User;

use App\Domain\AccessControl\Models\Role;
use App\Domain\Identity\Models\User;
use App\Domain\Notification\Notifications\UserReportedNotification;
use Illuminate\Support\Facades\Notification;

class ReportUser
{
    public function __construct(
        protected ShowUserProfile $showUserProfile,
    ) {}

    /**
     * Tells the super admins and admins (but not the reporter or the
     * reported person themselves) that `$user` was reported.
     *
     * @return int how many people were notified
     */
    public function handle(User $reporter, User $user, string $reason, ?string $comment = null): int
    {
        $this->showUserProfile->ensureVisible($reporter, $user);

        $recipients = User::query()
            ->notBanned()
            ->whereKeyNot([$reporter->id, $user->id])
            ->whereHas('roles', fn ($roles) => $roles->whereIn('code', [Role::SUPER_ADMIN, Role::ADMIN]))
            ->with('settings')
            ->get();

        $reporter->loadMissing('avatar');

        Notification::send($recipients, new UserReportedNotification($reporter, $user, $reason, $comment));

        return $recipients->count();
    }
}
