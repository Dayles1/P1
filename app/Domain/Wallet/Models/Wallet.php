<?php

namespace App\Domain\Wallet\Models;

use App\Domain\Currency\Models\Currency;
use App\Domain\Identity\Models\User;
use App\Domain\Payment\Contracts\Payable;
use App\Domain\Payment\Models\Payment;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\Services\WalletLedger;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * A user's internal balance in one currency, in minor units.
 *
 * The balance is only ever changed through WalletLedger, which locks
 * the row and writes the ledger entry in the same transaction — never by
 * assigning `balance` directly, which is why it is not fillable.
 *
 * A wallet is also a Payable: topping it up is a payment *for* the
 * wallet, and it credits itself once that payment succeeds.
 *
 * @property int $id
 * @property int $user_id
 * @property int $currency_id
 * @property int $balance
 * @property-read Currency $currency
 */
class Wallet extends Model implements Payable
{
    protected $fillable = [
        'user_id',
        'currency_id',
    ];

    protected $attributes = [
        'balance' => 0,
    ];

    protected function casts(): array
    {
        return [
            'balance' => 'integer',
        ];
    }

    /**
     * The user's wallet in a currency, opened on first use.
     */
    public static function resolveFor(User $user, Currency $currency): self
    {
        return static::query()->firstOrCreate([
            'user_id' => $user->getKey(),
            'currency_id' => $currency->getKey(),
        ]);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Currency, $this> */
    public function currency(): BelongsTo
    {
        return $this->belongsTo(Currency::class);
    }

    /** @return HasMany<WalletTransaction, $this> */
    public function transactions(): HasMany
    {
        return $this->hasMany(WalletTransaction::class);
    }

    /**
     * Top-ups of this wallet.
     *
     * @return MorphMany<Payment, $this>
     */
    public function payments(): MorphMany
    {
        return $this->morphMany(Payment::class, 'payable');
    }

    public function onPaymentSucceeded(Payment $payment): void
    {
        app(WalletLedger::class)->credit(
            wallet: $this,
            amount: $payment->amount,
            type: WalletTransactionType::Deposit,
            payment: $payment,
        );
    }

    /**
     * The balance as written in its currency, e.g. "1500.50".
     *
     * @return numeric-string
     */
    public function decimalBalance(): string
    {
        return $this->currency->fromMinorUnits($this->balance);
    }
}
