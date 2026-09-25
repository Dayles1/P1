<?php

namespace App\Http\Controllers\Api\Payment;

use App\Domain\Payment\Actions\ListPayments;
use App\Domain\Payment\Enums\PaymentProvider;
use App\Domain\Payment\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\Payment\PaymentResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The caller's own payments, of every kind. `show` is what the frontend
 * polls after sending the payer to a checkout.
 */
class PaymentController extends Controller
{
    public function __construct(
        private readonly ListPayments $listPayments,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::enum(PaymentStatus::class)],
            'provider' => ['nullable', Rule::enum(PaymentProvider::class)],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $payments = $this->listPayments->handle($request->user(), $validated);

        return $this->responsePagination(
            $payments,
            PaymentResource::collection($payments)
        );
    }

    public function show(Request $request, string $payment): JsonResponse
    {
        $payment = $request->user()->payments()
            ->where('uuid', $payment)
            ->with(['currency', 'card'])
            ->firstOrFail();

        return $this->success(data: new PaymentResource($payment));
    }
}
