<?php

namespace App\Infrastructure\Payment\Click;

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
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response as ClientResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Click.
 *
 * Checkout goes through the Shop API: the payer is sent to Click's pay
 * page, and Click calls our callback URL twice per payment — "prepare"
 * (action=0) and "complete" (action=1) — each signed with an md5 over the
 * request and our secret key. Saved cards go through the Merchant API
 * (card_token/*).
 *
 * Amounts on the wire are in sum, as decimals.
 */
class ClickGateway implements CardTokenGatewayInterface, PaymentGatewayInterface
{
    private const ACTION_PREPARE = 0;

    private const ACTION_COMPLETE = 1;

    private const OK = 0;

    private const ERROR_SIGN = -1;

    private const ERROR_AMOUNT = -2;

    private const ERROR_ACTION = -3;

    private const ERROR_ALREADY_PAID = -4;

    private const ERROR_ORDER_NOT_FOUND = -5;

    private const ERROR_TRANSACTION_NOT_FOUND = -6;

    private const ERROR_UPDATE_FAILED = -7;

    private const ERROR_BAD_REQUEST = -8;

    private const ERROR_CANCELLED = -9;

    private const PAYMENT_STATUS_PAID = 2;

    public function __construct(
        private readonly CompletePayment $completePayment,
        private readonly CancelPayment $cancelPayment,
    ) {}

    public function provider(): PaymentProvider
    {
        return PaymentProvider::Click;
    }

    public function createCheckout(Payment $payment): CheckoutData
    {
        $this->ensureSum($payment);

        return new CheckoutData(
            url: $this->config('checkout_url').'?'.http_build_query([
                'service_id' => $this->config('service_id'),
                'merchant_id' => $this->config('merchant_id'),
                'amount' => $payment->decimalAmount(),
                'transaction_param' => $payment->uuid,
                'return_url' => $payment->returnUrl(),
            ]),
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Shop API (callbacks)
    |--------------------------------------------------------------------------
    */

    public function handleCallback(Request $request): JsonResponse
    {
        $required = ['click_trans_id', 'service_id', 'merchant_trans_id', 'amount', 'action', 'sign_time', 'sign_string'];

        foreach ($required as $field) {
            if (! $request->filled($field)) {
                return $this->answer($request, self::ERROR_BAD_REQUEST, 'Error in request from click');
            }
        }

        $action = (int) $request->input('action');

        if (! in_array($action, [self::ACTION_PREPARE, self::ACTION_COMPLETE], true)) {
            return $this->answer($request, self::ERROR_ACTION, 'Action not found');
        }

        if (! $this->hasValidSignature($request, $action)) {
            return $this->answer($request, self::ERROR_SIGN, 'SIGN CHECK FAILED!');
        }

        $uuid = (string) $request->input('merchant_trans_id');

        $payment = Str::isUuid($uuid)
            ? Payment::query()->forProvider(PaymentProvider::Click)->where('uuid', $uuid)->with('currency')->first()
            : null;

        if ($payment === null) {
            return $this->answer($request, self::ERROR_ORDER_NOT_FOUND, 'Order does not exist');
        }

        if (bccomp($this->normalizeAmount((string) $request->input('amount')), $payment->decimalAmount(), 2) !== 0) {
            return $this->answer($request, self::ERROR_AMOUNT, 'Incorrect parameter amount');
        }

        return $action === self::ACTION_PREPARE
            ? $this->prepare($request, $payment)
            : $this->complete($request, $payment);
    }

    private function prepare(Request $request, Payment $payment): JsonResponse
    {
        if ($payment->isSucceeded()) {
            return $this->answer($request, self::ERROR_ALREADY_PAID, 'Already paid', $payment);
        }

        if (! $payment->isPending()) {
            return $this->answer($request, self::ERROR_CANCELLED, 'Transaction cancelled', $payment);
        }

        $payment->mergeProviderPayload(['click_trans_id' => (string) $request->input('click_trans_id')])->save();

        return $this->answer($request, self::OK, 'Success', $payment);
    }

    private function complete(Request $request, Payment $payment): JsonResponse
    {
        $clickTransId = (string) $request->input('click_trans_id');

        if ((string) $request->input('merchant_prepare_id') !== (string) $payment->getKey()) {
            return $this->answer($request, self::ERROR_TRANSACTION_NOT_FOUND, 'Transaction does not exist');
        }

        /*
         * The same complete, retried, gets the same success answer; a
         * different Click transaction for an order that is already paid
         * is refused.
         */
        if ($payment->isSucceeded()) {
            return $payment->provider_transaction_id === $clickTransId
                ? $this->answer($request, self::OK, 'Success', $payment)
                : $this->answer($request, self::ERROR_ALREADY_PAID, 'Already paid', $payment);
        }

        if (! $payment->isPending()) {
            return $this->answer($request, self::ERROR_CANCELLED, 'Transaction cancelled', $payment);
        }

        /*
         * Click reports a payment that failed on its side (e.g. the card
         * was declined) as a complete with a negative `error`.
         */
        if ((int) $request->input('error', 0) < 0) {
            $this->cancelPayment->handle(
                $payment,
                PaymentStatus::Failed,
                'click:'.$request->input('error').' '.$request->input('error_note'),
            );

            return $this->answer($request, self::ERROR_CANCELLED, 'Transaction cancelled', $payment);
        }

        try {
            $payment = $this->completePayment->handle($payment, $clickTransId);
        } catch (PaymentException) {
            return $this->answer($request, self::ERROR_CANCELLED, 'Transaction cancelled', $payment);
        }

        return $payment->isSucceeded()
            ? $this->answer($request, self::OK, 'Success', $payment)
            : $this->answer($request, self::ERROR_UPDATE_FAILED, 'Failed to update order', $payment);
    }

    private function hasValidSignature(Request $request, int $action): bool
    {
        $secret = $this->config('secret_key');

        if ($secret === '' || (string) $request->input('service_id') !== $this->config('service_id')) {
            return false;
        }

        $expected = md5(
            $request->input('click_trans_id')
            .$request->input('service_id')
            .$secret
            .$request->input('merchant_trans_id')
            .($action === self::ACTION_COMPLETE ? $request->input('merchant_prepare_id') : '')
            .$request->input('amount')
            .$request->input('action')
            .$request->input('sign_time')
        );

        return hash_equals($expected, (string) $request->input('sign_string'));
    }

    private function answer(Request $request, int $error, string $note, ?Payment $payment = null): JsonResponse
    {
        $answer = [
            'click_trans_id' => $request->input('click_trans_id'),
            'merchant_trans_id' => $request->input('merchant_trans_id'),
            'error' => $error,
            'error_note' => $note,
        ];

        if ($payment !== null) {
            $key = (int) $request->input('action') === self::ACTION_COMPLETE ? 'merchant_confirm_id' : 'merchant_prepare_id';
            $answer[$key] = $payment->getKey();
        }

        return response()->json($answer);
    }

    /*
    |--------------------------------------------------------------------------
    | Merchant API (cards)
    |--------------------------------------------------------------------------
    */

    public function requestCardToken(string $cardNumber, string $expiry): CardTokenData
    {
        $body = $this->merchantApi(fn (PendingRequest $http) => $http->post($this->apiUrl('card_token/request'), [
            'service_id' => (int) $this->config('service_id'),
            'card_number' => $cardNumber,
            'expire_date' => $expiry,
            'temporary' => 0,
        ]));

        if (empty($body['card_token'])) {
            throw PaymentProviderException::rejected('click', 'no card token in response');
        }

        return new CardTokenData(
            token: (string) $body['card_token'],
            maskedPan: $this->mask($cardNumber),
            expiry: $expiry,
            phone: isset($body['phone_number']) ? (string) $body['phone_number'] : null,
        );
    }

    public function verifyCardToken(Card $card, string $code): CardTokenData
    {
        $body = $this->merchantApi(fn (PendingRequest $http) => $http->post($this->apiUrl('card_token/verify'), [
            'service_id' => (int) $this->config('service_id'),
            'card_token' => $card->token,
            'sms_code' => $code,
        ]));

        return new CardTokenData(
            token: $card->token,
            maskedPan: (string) ($body['card_number'] ?? $card->masked_pan),
            expiry: $card->expiry,
            phone: $card->phone,
            verified: true,
        );
    }

    public function chargeCard(Payment $payment, Card $card): ChargeResult
    {
        $this->ensureSum($payment);

        try {
            $body = $this->merchantApi(fn (PendingRequest $http) => $http->post($this->apiUrl('card_token/payment'), [
                'service_id' => (int) $this->config('service_id'),
                'card_token' => $card->token,
                'amount' => $payment->decimalAmount(),
                'transaction_parameter' => $payment->uuid,
            ]));
        } catch (PaymentProviderException $e) {
            if ($e->wasRejected()) {
                return ChargeResult::failed($e->reason());
            }

            throw $e;
        }

        $paymentId = isset($body['payment_id']) ? (string) $body['payment_id'] : null;

        return (int) ($body['payment_status'] ?? 0) === self::PAYMENT_STATUS_PAID
            ? ChargeResult::succeeded($paymentId)
            : ChargeResult::pending($paymentId);
    }

    public function removeCardToken(Card $card): void
    {
        $this->merchantApi(fn (PendingRequest $http) => $http->delete(
            $this->apiUrl('card_token/'.$this->config('service_id').'/'.$card->token)
        ));
    }

    /**
     * @param  callable(PendingRequest): ClientResponse  $send
     * @return array<string, mixed>
     */
    private function merchantApi(callable $send): array
    {
        $timestamp = (string) now()->getTimestamp();
        $digest = sha1($timestamp.$this->config('secret_key'));

        try {
            $response = $send(
                Http::acceptJson()
                    ->withHeaders(['Auth' => $this->config('merchant_user_id').':'.$digest.':'.$timestamp])
                    ->timeout((int) config('payments.http.timeout'))
            );
        } catch (ConnectionException $e) {
            throw PaymentProviderException::unreachable('click', $e->getMessage());
        }

        if (! $response->successful()) {
            throw PaymentProviderException::unreachable('click', "HTTP {$response->status()}");
        }

        $body = (array) $response->json();

        if ((int) ($body['error_code'] ?? -1) !== self::OK) {
            throw PaymentProviderException::rejected('click', (string) ($body['error_note'] ?? 'unknown error'));
        }

        return $body;
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    /**
     * The first six and last four digits are all that is kept of a card
     * number, which is what Click itself shows.
     */
    private function mask(string $cardNumber): string
    {
        $digits = preg_replace('/\D/', '', $cardNumber) ?? '';

        return substr($digits, 0, 6).str_repeat('*', max(strlen($digits) - 10, 0)).substr($digits, -4);
    }

    /**
     * @return numeric-string
     */
    private function normalizeAmount(string $amount): string
    {
        return is_numeric($amount) ? $amount : '0';
    }

    private function ensureSum(Payment $payment): void
    {
        if ($payment->currency->code !== 'UZS') {
            throw PaymentException::unsupportedCurrency('click', $payment->currency->code);
        }

        if ($this->config('service_id') === '') {
            throw PaymentProviderException::notConfigured('click');
        }
    }

    private function apiUrl(string $path): string
    {
        return rtrim($this->config('api_url'), '/').'/'.$path;
    }

    private function config(string $key): string
    {
        return (string) config("payments.providers.click.{$key}");
    }
}
