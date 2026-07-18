<?php

namespace App\Domain\Ban\Actions;

use App\Domain\Ban\Enums\BanStatus;
use App\Domain\Ban\Models\Ban;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class UnbanEntity
{
    public function handle(
        Model $bannable,
        ?int $unbannedBy = null
    ): ?Ban {
        return DB::transaction(function () use ($bannable, $unbannedBy) {
            $ban = $bannable->ban;

            if (! $ban) {
                return null;
            }

            $ban->update([
                'unbanned_by' => $unbannedBy,
                'unbanned_at' => now(),
                'status'      => BanStatus::Revoked,
            ]);

            return $ban->refresh();
        });
    }
}