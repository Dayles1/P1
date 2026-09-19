<?php

namespace App\Http\Requests\Currency;

use Illuminate\Foundation\Http\FormRequest;

class ConvertCurrencyRequest extends FormRequest
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
            'amount' => ['required', 'numeric', 'min:0'],
            'from' => ['required', 'string', 'size:3', 'exists:currencies,code'],
            'to' => ['required', 'string', 'size:3', 'exists:currencies,code'],

            /** Which day's rate to use — the table keeps one per day. */
            'date' => ['nullable', 'date_format:Y-m-d'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge(array_filter([
            'from' => $this->string('from')->upper()->value() ?: null,
            'to' => $this->string('to')->upper()->value() ?: null,
        ]));
    }
}
