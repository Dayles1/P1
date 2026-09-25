<?php

namespace App\Infrastructure\Payment\OneQr;

use App\Application\DTO\Payment\CheckoutData;
use App\Domain\Payment\Actions\CancelPayment;
use App\Domain\Payment\Actions\CompletePayment;
use App\Domain\Payment\Enums\PaymentProvider;
use App\Domain\Payment\Enums\PaymentStatus;
use App\Domain\Payment\Exceptions\PaymentException;
use App\Domain\Payment\Exceptions\PaymentProviderException;
use App\Domain\Payment\Models\Payment;
use App\Domain\Payment\Repository\PaymentGatewayInterface;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * OneQR — checkout by QR / payment link only, no saved cards.
 *
 * An invoice is created over the API and its link (which the QR code
 * encodes) is handed to the payer. OneQR then notifies our callback URL
 * with the outcome, signed with an HMAC-SHA256 of the raw body under our
 * secret in the `X-Signature` header.
 *
 * The endpoint path (`/invoices`), field names and the signature header
 * are not from a published spec and must be checked against the OneQR
 * merchant documentation before going live. They are the only
 * OneQR-specific details and all of them live in this class.
 */
class OneQrGateway implements PaymentGatewayInterface
{
    private const STATUS_PAID = 'paid';

    private const STATUSES_FAILED = ['failed', 'cancelled', 'expired'];

    public function __construct(
        private readonly CompletePayment $completePayment,
        private readonly CancelPayment $cancelPayment,
    ) {}

    public function provider(): PaymentProvider
    {
        return PaymentProvider::OneQr;
    }

    public function createCheckout(Payment $payment): CheckoutData
    {
        if ($payment->currency->code !== 'UZS') {
            throw PaymentException::unsupportedCurrency('oneqr', $payment->currency->code);
        }

        if ($this->config('api_url') === '' || $this->config('api_key') === '') {
            throw PaymentProviderException::notConfigured('oneqr');
        }

        try {
            $response = Http::acceptJson()
                ->withToken($this->config('api_key'))
                ->timeout((int) config('payments.http.timeout'))
                ->post(rtrim($this->config('api_url'), '/').'/invoices', [
                    'order_id' => $payment->uuid,
                    'amount' => $payment->decimalAmount(),
                    'currency' => $payment->currency->code,
                    'description' => $payment->description,
                    'callback_url' => route('payments.callback', ['provider' => PaymentProvider::OneQr->value]),
                    'return_url' => $payment->returnUrl(),
                ]);
        } catch (ConnectionException $e) {
            throw PaymentProviderException::unreachable('oneqr', $e->getMessage());
        }

        if (! $response->successful()) {
            throw PaymentProviderException::rejected('oneqr', (string) ($response->json('message') ?? "HTTP {$response->status()}"));
        }

        $url = (string) ($response->json('payment_url') ?? $response->json('qr_url') ?? '');

        if ($url === '') {
            throw PaymentProviderException::rejected('oneqr', 'no payment link in response');
        }

        return new CheckoutData(
            url: $url,
            providerTransactionId: $response->json('id') !== null ? (string) $response->json('id') : null,
        );
    }

    public function handleCallback(Request $request): JsonResponse
    {
        $secret = $this->config('secret');
        $expected = hash_hmac('sha256', $request->getContent(), $secret);

        if ($secret === '' || ! hash_equals($expected, (string) $request->header('X-Signature'))) {
            return response()->json(['success' => false, 'message' => 'Invalid signature'], 401);
        }

        $uuid = (string) $request->input('order_id');

        $payment = Str::isUuid($uuid)
            ? Payment::query()->forProvider(PaymentProvider::OneQr)->where('uuid', $uuid)->with('currency')->first()
            : null;

        if ($payment === null) {
            return response()->json(['success' => false, 'message' => 'Order not found'], 404);
        }

        $amount = (string) $request->input('amount');

        if (! is_numeric($amount) || bccomp($amount, $payment->decimalAmount(), 2) !== 0) {
            return response()->json(['success' => false, 'message' => 'Incorrect amount'], 422);
        }

        $status = (string) $request->input('status');
        $transactionId = $request->filled('transaction_id') ? (string) $request->input('transaction_id') : null;

        if ($status === self::STATUS_PAID) {
            try {
                $this->completePayment->handle($payment, $transactionId);
            } catch (PaymentException $e) {
                return response()->json(['success' => false, 'message' => $e->getMessage()], 409);
            }
        } elseif (in_array($status, self::STATUSES_FAILED, true)) {
            $this->cancelPayment->handle($payment, PaymentStatus::Failed, 'oneqr:'.$status);
        }

        return response()->json(['success' => true]);
    }

    private function config(string $key): string
    {
        return (string) config("payments.providers.oneqr.{$key}");
    }
}
