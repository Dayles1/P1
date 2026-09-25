<?php

namespace App\Domain\Wallet\Models;

use App\Domain\Payment\Models\Payment;
use App\Domain\Wallet\Enums\WalletTransactionType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One movement of a wallet's balance. Written together with the change
 * it records and never edited afterwards.
 *
 * `amount` is signed (positive in, negative out), so a wallet's balance
 * is the sum of its transactions, and `balance_after` of the newest one.
 *
 * @property int $id
 * @property int $wallet_id
 * @property WalletTransactionType $type
 * @property int $amount
 * @property int $balance_before
 * @property int $balance_after
 * @property int|null $payment_id
 * @property string|null $description
 * @property array<string, mixed>|null $metadata
 * @property-read Wallet $wallet
 */
class WalletTransaction extends Model
{
    protected $fillable = [
        'wallet_id',
        'type',
        'amount',
        'balance_before',
        'balance_after',
        'payment_id',
        'description',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'type' => WalletTransactionType::class,
            'amount' => 'integer',
            'balance_before' => 'integer',
            'balance_after' => 'integer',
            'metadata' => 'array',
        ];
    }

    /** @return BelongsTo<Wallet, $this> */
    public function wallet(): BelongsTo
    {
        return $this->belongsTo(Wallet::class);
    }

    /** @return BelongsTo<Payment, $this> */
    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }
}
