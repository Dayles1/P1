<?php

namespace App\Http\Controllers\Api\Payment;

use App\Domain\Payment\Actions\Card\BindCard;
use App\Domain\Payment\Actions\Card\RemoveCard;
use App\Domain\Payment\Actions\Card\VerifyCard;
use App\Domain\Payment\Models\Card;
use App\Http\Controllers\Controller;
use App\Http\Requests\Payment\StoreCardRequest;
use App\Http\Requests\Payment\VerifyCardRequest;
use App\Http\Resources\Payment\CardResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The caller's saved cards. Binding is two steps: `store` hands the card
 * to the provider, which texts a code; `verify` confirms it.
 */
class CardController extends Controller
{
    public function __construct(
        private readonly BindCard $bindCard,
        private readonly VerifyCard $verifyCard,
        private readonly RemoveCard $removeCard,
    ) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success(
            data: CardResource::collection($request->user()->cards()->latest('id')->get())
        );
    }

    public function store(StoreCardRequest $request): JsonResponse
    {
        $card = $this->bindCard->handle(
            user: $request->user(),
            provider: $request->provider(),
            cardNumber: $request->validated('card_number'),
            expiry: $request->validated('card_expiry'),
        );

        return $this->success(
            data: new CardResource($card),
            message: $card->isVerified()
                ? __('messages.payment.card_verified')
                : __('messages.payment.card_code_sent'),
            status: 201
        );
    }

    public function verify(VerifyCardRequest $request, int $card): JsonResponse
    {
        /** @var Card $card */
        $card = $request->user()->cards()->findOrFail($card);

        return $this->success(
            data: new CardResource($this->verifyCard->handle($card, $request->validated('code'))),
            message: __('messages.payment.card_verified')
        );
    }

    public function destroy(Request $request, int $card): JsonResponse
    {
        /** @var Card $card */
        $card = $request->user()->cards()->findOrFail($card);

        $this->removeCard->handle($card);

        return $this->success(message: __('messages.payment.card_removed'));
    }
}
