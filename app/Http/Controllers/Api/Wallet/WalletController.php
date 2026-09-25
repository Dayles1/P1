<?php

namespace App\Http\Controllers\Api\Wallet;

use App\Domain\Payment\Actions\CreatePayment;
use App\Domain\Wallet\Actions\ListWallets;
use App\Domain\Wallet\Actions\ListWalletTransactions;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\Models\Wallet;
use App\Http\Controllers\Controller;
use App\Http\Requests\Wallet\TopUpWalletRequest;
use App\Http\Resources\Payment\PaymentResource;
use App\Http\Resources\Wallet\WalletResource;
use App\Http\Resources\Wallet\WalletTransactionResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The caller's own wallets. A wallet is opened the first time it is
 * topped up in a currency.
 */
class WalletController extends Controller
{
    public function __construct(
        private readonly ListWallets $listWallets,
        private readonly ListWalletTransactions $listTransactions,
        private readonly CreatePayment $createPayment,
    ) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success(
            data: WalletResource::collection($this->listWallets->handle($request->user()))
        );
    }

    public function transactions(Request $request, int $wallet): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['nullable', Rule::enum(WalletTransactionType::class)],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        /** @var Wallet $wallet */
        $wallet = $request->user()->wallets()->with('currency')->findOrFail($wallet);

        $transactions = $this->listTransactions->handle($wallet, $validated);
        $transactions->getCollection()->each->setRelation('wallet', $wallet);

        return $this->responsePagination(
            $transactions,
            WalletTransactionResource::collection($transactions)
        );
    }

    /**
     * Starts a top-up: charges the given saved card, or answers with a
     * checkout link / QR the payer completes with the provider.
     */
    public function topUp(TopUpWalletRequest $request): JsonResponse
    {
        $user = $request->user();
        $currency = $request->currency();

        $payment = $this->createPayment->handle(
            user: $user,
            payable: Wallet::resolveFor($user, $currency),
            amount: $currency->toMinorUnits($request->validated('amount')),
            currency: $currency,
            provider: $request->provider(),
            card: $request->card(),
            idempotencyKey: $request->validated('idempotency_key'),
            description: __('messages.wallet.top_up_description'),
        );

        return $this->success(
            data: new PaymentResource($payment->load(['currency', 'card'])),
            message: __('messages.payment.created'),
            status: 201
        );
    }
}
