<?php

namespace App\Domain\Ban\Actions;

use App\Domain\Ban\Enums\BanStatus;
use App\Domain\Ban\Models\Ban;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class BanEntity
{
    public function handle(
        Model $bannable,
        ?int $bannedBy = null,
        ?string $reason = null,
        ?string $endsAt = null,
        array $meta = []
    ): Ban {
        return DB::transaction(function () use ($bannable, $bannedBy, $reason, $endsAt, $meta) {
            $ban = $bannable->ban()->updateOrCreate(
                [],
                [
                    'banned_by'   => $bannedBy,
                    'unbanned_by' => null,
                    'reason'      => $reason,
                    'banned_at'   => now(),
                    'ends_at'     => $endsAt,
                    'unbanned_at' => null,
                    'status'      => BanStatus::Active,
                    'meta'        => $meta,
                ]
            );

            return $ban;
        });
    }
}