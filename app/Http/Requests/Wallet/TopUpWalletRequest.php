<?php

namespace App\Http\Requests\Wallet;

use App\Domain\Currency\Models\Currency;
use App\Domain\Payment\Enums\PaymentProvider;
use App\Domain\Payment\Models\Card;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TopUpWalletRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'currency_code' => ['required', 'string', 'size:3', Rule::exists('currencies', 'code')->where('is_active', true)],

            /** As written in the currency ("50000" or "50000.50"), not minor units. */
            'amount' => ['required', 'numeric', 'gt:0', 'max:1000000000'],

            'provider' => ['required', Rule::in(array_map(fn (PaymentProvider $provider): string => $provider->value, PaymentProvider::external()))],

            /** A saved, confirmed card of the caller's, charged instead of a checkout link. */
            'card_id' => [
                'nullable',
                'integer',
                Rule::exists('cards', 'id')
                    ->where('user_id', $this->user()?->getKey())
                    ->whereNotNull('verified_at')
                    ->whereNull('deleted_at'),
            ],

            /** Sent again on a retry, it returns the payment the first request made. */
            'idempotency_key' => ['nullable', 'string', 'max:100'],
        ];
    }

    public function currency(): Currency
    {
        return Currency::query()->byCode($this->validated('currency_code'))->firstOrFail();
    }

    public function provider(): PaymentProvider
    {
        return PaymentProvider::from($this->validated('provider'));
    }

    public function card(): ?Card
    {
        $cardId = $this->validated('card_id');

        return $cardId === null ? null : Card::query()->whereKey($cardId)->firstOrFail();
    }

    protected function prepareForValidation(): void
    {
        $this->merge(array_filter([
            'currency_code' => $this->string('currency_code')->upper()->value() ?: null,
        ]));
    }
}
