<?php

namespace App\Infrastructure\Payment\Payme;

use App\Application\DTO\Payment\CardTokenData;
use App\Application\DTO\Payment\ChargeResult;
use App\Application\DTO\Payment\CheckoutData;
use App\Domain\Payment\Actions\CancelPayment;
use App\Domain\Payment\Actions\CompletePayment;
use App\Domain\Payment\Enums\PaymentProvider;
use App\Domain\Payment\Enums\PaymentStatus;
use App\Domain\Payment\Exceptions\PaymentException;
use App\Domain\Payment\Exceptions\PaymentProviderException;
use App\Domain\Payment\Models\Card;
use App\Domain\Payment\Models\Payment;
use App\Domain\Payment\Repository\CardTokenGatewayInterface;
use App\Domain\Payment\Repository\PaymentGatewayInterface;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Payme (Paycom).
 *
 * Checkout goes through the Merchant API: the payer is sent to Payme's
 * checkout page, and Payme calls our callback URL with JSON-RPC methods
 * (CheckPerformTransaction, CreateTransaction, PerformTransaction, ...)
 * authorised with HTTP Basic "Paycom:<key>". Saved cards go through the
 * Subscribe API (cards.* to tokenise, receipts.* to charge).
 *
 * Amounts on the wire are tiyin. Payme's own transaction state and its
 * millisecond timestamps are kept in the payment's provider_payload, so
 * every method can answer with exactly what it answered before.
 */
class PaymeGateway implements CardTokenGatewayInterface, PaymentGatewayInterface
{
    /** Payme cancels a transaction that is not performed within 12 hours. */
    private const TRANSACTION_TIMEOUT_MS = 43_200_000;

    private const STATE_CREATED = 1;

    private const STATE_PERFORMED = 2;

    private const STATE_CANCELLED = -1;

    private const STATE_CANCELLED_AFTER_PERFORM = -2;

    private const REASON_TIMEOUT = 4;

    private const ERROR_AUTH = -32504;

    private const ERROR_METHOD_NOT_FOUND = -32601;

    private const ERROR_INVALID_REQUEST = -32600;

    private const ERROR_INVALID_AMOUNT = -31001;

    private const ERROR_TRANSACTION_NOT_FOUND = -31003;

    private const ERROR_CANNOT_CANCEL = -31007;

    private const ERROR_CANNOT_PERFORM = -31008;

    private const ERROR_ORDER_NOT_FOUND = -31050;

    private const ERROR_ORDER_UNAVAILABLE = -31051;

    private const ERROR_ORDER_BUSY = -31099;

    private const RECEIPT_PAID = 4;

    public function __construct(
        private readonly CompletePayment $completePayment,
        private readonly CancelPayment $cancelPayment,
    ) {}

    public function provider(): PaymentProvider
    {
        return PaymentProvider::Payme;
    }

    public function createCheckout(Payment $payment): CheckoutData
    {
        $this->ensureSum($payment);

        $params = implode(';', [
            'm='.$this->config('merchant_id'),
            'ac.'.$this->accountKey().'='.$payment->uuid,
            'a='.$this->tiyin($payment),
            'c='.$payment->returnUrl(),
        ]);

        return new CheckoutData(
            url: rtrim($this->config('checkout_url'), '/').'/'.base64_encode($params),
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Merchant API (callbacks)
    |--------------------------------------------------------------------------
    */

    public function handleCallback(Request $request): JsonResponse
    {
        $id = $request->input('id');

        if (! $this->isAuthorized($request)) {
            return $this->error($id, self::ERROR_AUTH, 'Insufficient privileges');
        }

        $params = $request->input('params');

        if (! is_array($params)) {
            return $this->error($id, self::ERROR_INVALID_REQUEST, 'Invalid request');
        }

        try {
            $result = match ($request->input('method')) {
                'CheckPerformTransaction' => $this->checkPerformTransaction($params),
                'CreateTransaction' => $this->createTransaction($params),
                'PerformTransaction' => $this->performTransaction($params),
                'CancelTransaction' => $this->cancelTransaction($params),
                'CheckTransaction' => $this->checkTransaction($params),
                'GetStatement' => $this->getStatement($params),
                default => throw new PaymeError(self::ERROR_METHOD_NOT_FOUND, 'Method not found'),
            };
        } catch (PaymeError $e) {
            return $this->error($id, $e->getCode(), $e->getMessage(), $e->data);
        }

        return response()->json(['id' => $id, 'result' => $result]);
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function checkPerformTransaction(array $params): array
    {
        $this->payableOrder($params);

        return ['allow' => true];
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function createTransaction(array $params): array
    {
        $transactionId = (string) ($params['id'] ?? '');

        if ($existing = $this->findByTransaction($transactionId, orFail: false)) {
            if (! $existing->isPending()) {
                throw new PaymeError(self::ERROR_CANNOT_PERFORM, 'Transaction is not active');
            }

            if ($this->hasTimedOut($existing)) {
                $this->cancelForTimeout($existing);

                throw new PaymeError(self::ERROR_CANNOT_PERFORM, 'Transaction timed out');
            }

            return $this->transactionResult($existing, ['create_time']);
        }

        $order = $this->payableOrder($params);

        return DB::transaction(function () use ($order, $transactionId, $params): array {
            /** @var Payment $payment */
            $payment = Payment::query()->lockForUpdate()->findOrFail($order->getKey());

            if (! $payment->isPending()) {
                throw new PaymeError(self::ERROR_ORDER_UNAVAILABLE, 'Order is not awaiting payment', $this->accountKey());
            }

            if ($payment->provider_transaction_id !== null) {
                throw new PaymeError(self::ERROR_ORDER_BUSY, 'Order is awaiting another transaction', $this->accountKey());
            }

            $payment->forceFill(['provider_transaction_id' => $transactionId])
                ->mergeProviderPayload([
                    'create_time' => (int) ($params['time'] ?? $this->nowMs()),
                    'perform_time' => 0,
                    'cancel_time' => 0,
                    'reason' => null,
                ])
                ->save();

            return $this->transactionResult($payment, ['create_time']);
        });
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function performTransaction(array $params): array
    {
        $payment = $this->findByTransaction((string) ($params['id'] ?? ''));

        if ($payment->isPending()) {
            if ($this->hasTimedOut($payment)) {
                $this->cancelForTimeout($payment);

                throw new PaymeError(self::ERROR_CANNOT_PERFORM, 'Transaction timed out');
            }

            try {
                $payment = $this->completePayment->handle($payment, providerPayload: ['perform_time' => $this->nowMs()]);
            } catch (PaymentException) {
                throw new PaymeError(self::ERROR_CANNOT_PERFORM, 'Transaction cannot be performed');
            }
        }

        if (! $payment->isSucceeded()) {
            throw new PaymeError(self::ERROR_CANNOT_PERFORM, 'Transaction cannot be performed');
        }

        return $this->transactionResult($payment, ['perform_time']);
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function cancelTransaction(array $params): array
    {
        $payment = $this->findByTransaction((string) ($params['id'] ?? ''));

        /*
         * Once performed, the money has already been applied (a wallet
         * credited, a cargo paid), so it is not ours to hand back from
         * here. Payme's answer for that is "cannot cancel".
         */
        if ($payment->isSucceeded()) {
            throw new PaymeError(self::ERROR_CANNOT_CANCEL, 'Order is completed and cannot be cancelled');
        }

        if ($payment->isPending()) {
            $payment = $this->cancelPayment->handle(
                $payment,
                PaymentStatus::Cancelled,
                'payme:'.($params['reason'] ?? ''),
                ['cancel_time' => $this->nowMs(), 'reason' => isset($params['reason']) ? (int) $params['reason'] : null],
            );
        }

        return $this->transactionResult($payment, ['cancel_time']);
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function checkTransaction(array $params): array
    {
        $payment = $this->findByTransaction((string) ($params['id'] ?? ''));

        return $this->transactionResult($payment, ['create_time', 'perform_time', 'cancel_time', 'reason']);
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function getStatement(array $params): array
    {
        $transactions = Payment::query()
            ->forProvider(PaymentProvider::Payme)
            ->whereNotNull('provider_transaction_id')
            ->where('provider_payload->create_time', '>=', (int) ($params['from'] ?? 0))
            ->where('provider_payload->create_time', '<=', (int) ($params['to'] ?? 0))
            ->with('currency')
            ->orderBy('id')
            ->get()
            ->map(fn (Payment $payment): array => [
                'id' => $payment->provider_transaction_id,
                'time' => (int) $payment->providerValue('create_time'),
                'amount' => $this->tiyin($payment),
                'account' => [$this->accountKey() => $payment->uuid],
                ...$this->transactionResult($payment, ['create_time', 'perform_time', 'cancel_time', 'reason']),
            ]);

        return ['transactions' => $transactions->all()];
    }

    /**
     * The order a Check/Create call names, provided it can be paid for
     * the amount given.
     *
     * @param  array<string, mixed>  $params
     */
    private function payableOrder(array $params): Payment
    {
        $uuid = $params['account'][$this->accountKey()] ?? null;

        $payment = is_string($uuid) && Str::isUuid($uuid)
            ? Payment::query()->forProvider(PaymentProvider::Payme)->where('uuid', $uuid)->with('currency')->first()
            : null;

        if ($payment === null) {
            throw new PaymeError(self::ERROR_ORDER_NOT_FOUND, 'Order not found', $this->accountKey());
        }

        if (! $payment->isPending()) {
            throw new PaymeError(self::ERROR_ORDER_UNAVAILABLE, 'Order is not awaiting payment', $this->accountKey());
        }

        if ((int) ($params['amount'] ?? 0) !== $this->tiyin($payment)) {
            throw new PaymeError(self::ERROR_INVALID_AMOUNT, 'Incorrect amount');
        }

        return $payment;
    }

    /**
     * @return ($orFail is true ? Payment : Payment|null)
     */
    private function findByTransaction(string $transactionId, bool $orFail = true): ?Payment
    {
        $payment = $transactionId === '' ? null : Payment::query()
            ->forProvider(PaymentProvider::Payme)
            ->where('provider_transaction_id', $transactionId)
            ->first();

        if ($payment === null && $orFail) {
            throw new PaymeError(self::ERROR_TRANSACTION_NOT_FOUND, 'Transaction not found');
        }

        return $payment;
    }

    /**
     * @param  list<string>  $fields
     * @return array<string, mixed>
     */
    private function transactionResult(Payment $payment, array $fields): array
    {
        $result = [];

        foreach ($fields as $field) {
            $result[$field] = $field === 'reason'
                ? $payment->providerValue('reason')
                : (int) $payment->providerValue($field, 0);
        }

        return $result + [
            'transaction' => (string) $payment->getKey(),
            'state' => $this->stateOf($payment),
        ];
    }

    private function stateOf(Payment $payment): int
    {
        return match ($payment->status) {
            PaymentStatus::Pending => self::STATE_CREATED,
            PaymentStatus::Succeeded => self::STATE_PERFORMED,
            default => (int) $payment->providerValue('perform_time', 0) > 0
                ? self::STATE_CANCELLED_AFTER_PERFORM
                : self::STATE_CANCELLED,
        };
    }

    private function hasTimedOut(Payment $payment): bool
    {
        return $this->nowMs() - (int) $payment->providerValue('create_time', 0) > self::TRANSACTION_TIMEOUT_MS;
    }

    private function cancelForTimeout(Payment $payment): void
    {
        $this->cancelPayment->handle(
            $payment,
            PaymentStatus::Cancelled,
            'payme:'.self::REASON_TIMEOUT,
            ['cancel_time' => $this->nowMs(), 'reason' => self::REASON_TIMEOUT],
        );
    }

    private function isAuthorized(Request $request): bool
    {
        $header = (string) $request->header('Authorization');
        $key = (string) $this->config('key');

        if ($key === '' || ! str_starts_with($header, 'Basic ')) {
            return false;
        }

        $credentials = explode(':', (string) base64_decode(substr($header, 6), true), 2);

        return count($credentials) === 2 && hash_equals($key, $credentials[1]);
    }

    private function error(mixed $id, int $code, string $message, ?string $data = null): JsonResponse
    {
        return response()->json([
            'id' => $id,
            'error' => [
                'code' => $code,
                'message' => ['ru' => $message, 'uz' => $message, 'en' => $message],
                'data' => $data,
            ],
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Subscribe API (cards)
    |--------------------------------------------------------------------------
    */

    public function requestCardToken(string $cardNumber, string $expiry): CardTokenData
    {
        $card = $this->subscribe('cards.create', [
            'card' => ['number' => $cardNumber, 'expire' => $expiry],
            'save' => true,
        ])['card'] ?? [];

        $verification = $this->subscribe('cards.get_verify_code', ['token' => $card['token'] ?? '']);

        return $this->toCardToken($card, $verification['phone'] ?? null);
    }

    public function verifyCardToken(Card $card, string $code): CardTokenData
    {
        return $this->toCardToken(
            $this->subscribe('cards.verify', ['token' => $card->token, 'code' => $code])['card'] ?? []
        );
    }

    public function chargeCard(Payment $payment, Card $card): ChargeResult
    {
        $this->ensureSum($payment);

        $receipt = $this->subscribe('receipts.create', [
            'amount' => $this->tiyin($payment),
            'account' => [$this->accountKey() => $payment->uuid],
        ], withKey: true)['receipt'] ?? [];

        $receiptId = (string) ($receipt['_id'] ?? '');

        try {
            $paid = $this->subscribe('receipts.pay', ['id' => $receiptId, 'token' => $card->token], withKey: true)['receipt'] ?? [];
        } catch (PaymentProviderException $e) {
            if (! $e->wasRejected()) {
                throw $e;
            }

            return ChargeResult::failed($e->reason(), $receiptId);
        }

        return (int) ($paid['state'] ?? 0) === self::RECEIPT_PAID
            ? ChargeResult::succeeded($receiptId)
            : ChargeResult::pending($receiptId);
    }

    public function removeCardToken(Card $card): void
    {
        $this->subscribe('cards.remove', ['token' => $card->token], withKey: true);
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function subscribe(string $method, array $params, bool $withKey = false): array
    {
        $auth = $withKey
            ? $this->config('merchant_id').':'.$this->config('key')
            : $this->config('merchant_id');

        try {
            $response = Http::acceptJson()
                ->withHeaders(['X-Auth' => $auth])
                ->timeout((int) config('payments.http.timeout'))
                ->post($this->config('api_url'), [
                    'id' => random_int(1, PHP_INT_MAX),
                    'method' => $method,
                    'params' => $params,
                ]);
        } catch (ConnectionException $e) {
            throw PaymentProviderException::unreachable('payme', $e->getMessage());
        }

        if (! $response->successful()) {
            throw PaymentProviderException::unreachable('payme', "HTTP {$response->status()}");
        }

        if ($response->json('error') !== null) {
            throw PaymentProviderException::rejected('payme', (string) $response->json('error.message'));
        }

        return (array) $response->json('result', []);
    }

    /**
     * @param  array<string, mixed>  $card
     */
    private function toCardToken(array $card, ?string $phone = null): CardTokenData
    {
        if (empty($card['token'])) {
            throw PaymentProviderException::rejected('payme', 'no card token in response');
        }

        return new CardTokenData(
            token: (string) $card['token'],
            maskedPan: (string) ($card['number'] ?? ''),
            expiry: isset($card['expire']) ? (string) $card['expire'] : null,
            phone: $phone,
            verified: (bool) ($card['verify'] ?? false),
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    private function tiyin(Payment $payment): int
    {
        return (int) bcmul($payment->decimalAmount(), '100', 0);
    }

    private function ensureSum(Payment $payment): void
    {
        if ($payment->currency->code !== 'UZS') {
            throw PaymentException::unsupportedCurrency('payme', $payment->currency->code);
        }

        if ((string) $this->config('merchant_id') === '') {
            throw PaymentProviderException::notConfigured('payme');
        }
    }

    private function accountKey(): string
    {
        return (string) $this->config('account_key');
    }

    private function nowMs(): int
    {
        return (int) now()->getPreciseTimestamp(3);
    }

    private function config(string $key): string
    {
        return (string) config("payments.providers.payme.{$key}");
    }
}
