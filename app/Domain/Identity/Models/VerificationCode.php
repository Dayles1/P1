<?php

namespace App\Domain\Identity\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VerificationCode extends Model
{
    public const PURPOSE_LOGIN_2FA = 'login_2fa';

    public const PURPOSE_PASSWORDLESS_LOGIN = 'passwordless_login';

    public const PURPOSE_EMAIL_VERIFICATION = 'email_verification';

    protected $fillable = [
        'user_id',
        'purpose',
        'code_hash',
        'challenge_token',
        'attempts',
        'expires_at',
        'consumed_at',
        'ip_address',
        'user_agent',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public function isConsumed(): bool
    {
        return $this->consumed_at !== null;
    }
}
