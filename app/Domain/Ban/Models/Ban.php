<?php

namespace App\Domain\Ban\Models;

use App\Domain\Ban\Enums\BanStatus;
use App\Domain\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Ban extends Model
{
    protected $fillable = [
        'banned_by',
        'unbanned_by',
        'reason',
        'banned_at',
        'ends_at',
        'unbanned_at',
        'status',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'banned_at' => 'datetime',
            'ends_at' => 'datetime',
            'unbanned_at' => 'datetime',
            'meta' => 'array',
            'status' => BanStatus::class,
        ];
    }

    public function bannable(): MorphTo
    {
        return $this->morphTo();
    }

    public function bannedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'banned_by');
    }

    public function unbannedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'unbanned_by');
    }

    public function isActive(): bool
    {
        if ($this->status !== BanStatus::Active) {
            return false;
        }

        if ($this->unbanned_at !== null) {
            return false;
        }

        if ($this->ends_at !== null && now()->greaterThanOrEqualTo($this->ends_at)) {
            return false;
        }

        return true;
    }

    public function isExpired(): bool
    {
        return $this->status === BanStatus::Expired
            || ($this->ends_at !== null && now()->greaterThanOrEqualTo($this->ends_at));
    }

    public function isRevoked(): bool
    {
        return $this->status === BanStatus::Revoked;
    }
}