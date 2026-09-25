<?php

namespace App\Domain\Payment\Models;

use App\Domain\Currency\Models\Currency;
use App\Domain\Identity\Models\User;
use App\Domain\Payment\Enums\PaymentProvider;
use App\Domain\Payment\Enums\PaymentStatus;
use App\Domain\Wallet\Models\WalletTransaction;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * One payment, for anything, by any means.
 *
 * `payable` is what the money is for — the Wallet itself when the user
 * is topping it up, a cargo or a service otherwise. `provider` is where
 * it comes from: the user's wallet balance, or an external provider.
 * A top-up is therefore just a payment whose payable is a wallet, and
 * spending the balance is just a payment whose provider is the wallet.
 *
 * Amounts are in the currency's minor units.
 *
 * @property int $id
 * @property string $uuid
 * @property int $user_id
 * @property string $payable_type
 * @property int $payable_id
 * @property PaymentProvider $provider
 * @property int|null $card_id
 * @property int $amount
 * @property int $currency_id
 * @property PaymentStatus $status
 * @property string|null $provider_transaction_id
 * @property string|null $idempotency_key
 * @property string|null $checkout_url
 * @property array<string, mixed>|null $provider_payload
 * @property string|null $description
 * @property string|null $failure_reason
 * @property array<string, mixed>|null $metadata
 * @property Carbon|null $paid_at
 * @property Carbon|null $cancelled_at
 * @property Carbon $created_at
 * @property-read Currency $currency
 * @property-read Model|null $payable a Payable, checked where it matters (CompletePayment)
 */
class Payment extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id',
        'payable_type',
        'payable_id',
        'provider',
        'card_id',
        'amount',
        'currency_id',
        'status',
        'provider_transaction_id',
        'idempotency_key',
        'checkout_url',
        'provider_payload',
        'description',
        'failure_reason',
        'metadata',
        'paid_at',
        'cancelled_at',
    ];

    protected $attributes = [
        'status' => 'pending',
    ];

    protected function casts(): array
    {
        return [
            'provider' => PaymentProvider::class,
            'status' => PaymentStatus::class,
            'amount' => 'integer',
            'provider_payload' => 'array',
            'metadata' => 'array',
            'paid_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    /**
     * Only the public uuid is generated; the id stays an auto-increment.
     *
     * @return list<string>
     */
    public function uniqueIds(): array
    {
        return ['uuid'];
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return MorphTo<Model, $this> */
    public function payable(): MorphTo
    {
        return $this->morphTo();
    }

    /** @return BelongsTo<Card, $this> */
    public function card(): BelongsTo
    {
        return $this->belongsTo(Card::class)->withTrashed();
    }

    /** @return BelongsTo<Currency, $this> */
    public function currency(): BelongsTo
    {
        return $this->belongsTo(Currency::class);
    }

    /** @return HasMany<WalletTransaction, $this> */
    public function walletTransactions(): HasMany
    {
        return $this->hasMany(WalletTransaction::class);
    }

    public function isPending(): bool
    {
        return $this->status === PaymentStatus::Pending;
    }

    public function isSucceeded(): bool
    {
        return $this->status === PaymentStatus::Succeeded;
    }

    /**
     * The amount as written in its currency, e.g. "1500.50".
     *
     * @return numeric-string
     */
    public function decimalAmount(): string
    {
        return $this->currency->fromMinorUnits($this->amount);
    }

    /**
     * Where the payer is sent back to after an external checkout.
     */
    public function returnUrl(): string
    {
        return str_replace('{payment}', $this->uuid, (string) config('payments.return_url'));
    }

    /**
     * One value a provider stored on this payment.
     */
    public function providerValue(string $key, mixed $default = null): mixed
    {
        return data_get($this->provider_payload, $key, $default);
    }

    /**
     * Merges values into what a provider has stored on this payment.
     *
     * @param  array<string, mixed>  $values
     */
    public function mergeProviderPayload(array $values): static
    {
        $this->provider_payload = array_merge($this->provider_payload ?? [], $values);

        return $this;
    }

    /**
     * @param  Builder<$this>  $query
     * @return Builder<$this>
     */
    public function scopeForProvider(Builder $query, PaymentProvider $provider): Builder
    {
        return $query->where('provider', $provider->value);
    }
}
