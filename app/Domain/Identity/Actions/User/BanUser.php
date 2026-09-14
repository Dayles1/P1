<?php

namespace App\Domain\Identity\Actions\User;

use App\Domain\Ban\Actions\BanEntity;
use App\Domain\Ban\Models\Ban;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserSession;
use App\Domain\Identity\Services\SuperAdminGuard;

class BanUser
{
    public function __construct(
        private readonly BanEntity $banEntity,
        private readonly SuperAdminGuard $superAdminGuard,
    ) {}

    public function handle(User $actor, User $target, array $data): Ban
    {
        $this->superAdminGuard->assertCanModify($actor, $target);

        $ban = $this->banEntity->handle(
            bannable: $target,
            bannedBy: $actor->id,
            reason: $data['reason'] ?? null,
            endsAt: $data['ends_at'] ?? null,
        );

        $this->revokeActiveSessions($target);

        return $ban;
    }

    /**
     * `EnsureUserIsNotBanned` would catch this on the target's next
     * request regardless, but revoking here means the ban takes effect
     * immediately instead of on whatever they happen to click next.
     */
    private function revokeActiveSessions(User $target): void
    {
        $target->tokens()->delete();

        UserSession::query()
            ->where('user_id', $target->id)
            ->whereNull('logged_out_at')
            ->update(['logged_out_at' => now()]);
    }
}
