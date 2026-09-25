<?php

namespace App\Domain\Payment\Models;

use App\Domain\Identity\Models\User;
use App\Domain\Payment\Enums\PaymentProvider;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * A card a user has bound through a provider, kept as that provider's
 * token. The token only means something to the provider that issued it,
 * so a card is always charged through its own provider.
 *
 * The full card number and CVV are never stored: they go to the
 * provider when the card is bound, and only the masked number and
 * expiry it answers with are kept.
 *
 * @property int $id
 * @property int $user_id
 * @property PaymentProvider $provider
 * @property string $token
 * @property string $masked_pan
 * @property string|null $expiry
 * @property string|null $phone
 * @property Carbon|null $verified_at
 * @property Carbon|null $last_used_at
 */
class Card extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'provider',
        'token',
        'masked_pan',
        'expiry',
        'phone',
        'verified_at',
        'last_used_at',
    ];

    protected $hidden = [
        'token',
    ];

    protected function casts(): array
    {
        return [
            'provider' => PaymentProvider::class,
            'token' => 'encrypted',
            'verified_at' => 'datetime',
            'last_used_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isVerified(): bool
    {
        return $this->verified_at !== null;
    }

    /**
     * @param  Builder<$this>  $query
     * @return Builder<$this>
     */
    public function scopeVerified(Builder $query): Builder
    {
        return $query->whereNotNull('verified_at');
    }
}
