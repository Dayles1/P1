<?php

namespace App\Http\Requests\Payment;

use App\Domain\Payment\Enums\PaymentProvider;
use App\Domain\Payment\Services\PaymentGatewayRegistry;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The card number and expiry are only relayed to the provider. Both
 * field names are on the request log's redaction list, so they are not
 * written there either.
 */
class StoreCardRequest extends FormRequest
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
        $providers = array_map(
            fn (PaymentProvider $provider): string => $provider->value,
            app(PaymentGatewayRegistry::class)->cardProviders()
        );

        return [
            'provider' => ['required', Rule::in($providers)],
            'card_number' => ['required', 'digits_between:16,19'],

            /** MMYY, with or without a slash. */
            'card_expiry' => ['required', 'regex:/^(0[1-9]|1[0-2])\d{2}$/'],
        ];
    }

    public function provider(): PaymentProvider
    {
        return PaymentProvider::from($this->validated('provider'));
    }

    protected function prepareForValidation(): void
    {
        $this->merge(array_filter([
            'card_number' => preg_replace('/\D/', '', (string) $this->input('card_number')) ?: null,
            'card_expiry' => preg_replace('/\D/', '', (string) $this->input('card_expiry')) ?: null,
        ]));
    }
}
