<?php

use App\Domain\Identity\Models\User;
use App\Domain\Payment\Enums\PaymentProvider;
use App\Domain\Payment\Models\Payment;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\Exceptions\InsufficientFundsException;
use App\Domain\Wallet\Models\Wallet;
use App\Domain\Wallet\Services\WalletLedger;
use Illuminate\Database\UniqueConstraintViolationException;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->ledger = app(WalletLedger::class);
});

test('a wallet is opened once per user and currency', function () {
    $first = Wallet::resolveFor($this->user, currencyRow('UZS'));
    $again = Wallet::resolveFor($this->user, currencyRow('UZS'));
    $usd = Wallet::resolveFor($this->user, currencyRow('USD'));

    expect($again->id)->toBe($first->id)
        ->and($usd->id)->not->toBe($first->id)
        ->and($first->balance)->toBe(0);
});

test('every movement is recorded with the balance before and after it', function () {
    $wallet = fundedWallet($this->user, 0);

    $this->ledger->credit($wallet, 100_000, WalletTransactionType::Deposit);
    $this->ledger->debit($wallet, 30_000, WalletTransactionType::Payment);
    $this->ledger->credit($wallet, 5_000, WalletTransactionType::Refund);

    $rows = $wallet->transactions()->orderBy('id')->get();

    expect($wallet->balance)->toBe(75_000)
        ->and($wallet->fresh()->balance)->toBe(75_000)
        ->and($rows->pluck('amount')->all())->toBe([100_000, -30_000, 5_000])
        ->and($rows->pluck('balance_before')->all())->toBe([0, 100_000, 70_000])
        ->and($rows->pluck('balance_after')->all())->toBe([100_000, 70_000, 75_000])
        ->and((int) $wallet->transactions()->sum('amount'))->toBe(75_000);
});

test('a debit larger than the balance is refused and changes nothing', function () {
    $wallet = fundedWallet($this->user, 10_000);

    expect(fn () => $this->ledger->debit($wallet, 10_001, WalletTransactionType::Payment))
        ->toThrow(InsufficientFundsException::class);

    expect($wallet->fresh()->balance)->toBe(10_000)
        ->and($wallet->transactions()->count())->toBe(1);
});

test('a stale wallet instance cannot overspend: the balance is re-read under lock', function () {
    $wallet = fundedWallet($this->user, 10_000);

    // Two requests loaded the wallet while it still held 10 000.
    $firstRequest = Wallet::query()->find($wallet->id);
    $secondRequest = Wallet::query()->find($wallet->id);

    $this->ledger->debit($firstRequest, 8_000, WalletTransactionType::Payment);

    expect(fn () => $this->ledger->debit($secondRequest, 8_000, WalletTransactionType::Payment))
        ->toThrow(InsufficientFundsException::class);

    expect($wallet->fresh()->balance)->toBe(2_000);
});

test('the ledger refuses to apply the same payment twice', function () {
    $wallet = fundedWallet($this->user, 0);

    $payment = Payment::query()->create([
        'user_id' => $this->user->id,
        'payable_type' => $wallet->getMorphClass(),
        'payable_id' => $wallet->id,
        'provider' => PaymentProvider::Click,
        'amount' => 50_000,
        'currency_id' => $wallet->currency_id,
    ]);

    $this->ledger->credit($wallet, 50_000, WalletTransactionType::Deposit, $payment);

    expect(fn () => $this->ledger->credit($wallet, 50_000, WalletTransactionType::Deposit, $payment))
        ->toThrow(UniqueConstraintViolationException::class);

    expect($wallet->fresh()->balance)->toBe(50_000);
});

test('the balance is not mass assignable', function () {
    $wallet = Wallet::query()->create([
        'user_id' => $this->user->id,
        'currency_id' => currencyRow('UZS')->id,
        'balance' => 999_999,
    ]);

    expect($wallet->fresh()->balance)->toBe(0);
});
