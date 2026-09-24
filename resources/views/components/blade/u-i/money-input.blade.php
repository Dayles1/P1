{{--
    Amount + currency. Currencies come from the Currency domain
    (code => label); the amount is right-aligned in tabular figures.

    <x-blade.u-i.money-input name="amount" currency-name="currency" :currencies="$currencies"
                             :currency="$user->currency" :label="…" :hint="$conversionHint" />
--}}
@props([
    'label' => null,
    'name' => 'amount',
    'currencyName' => 'currency',
    'currencies' => [],
    'currency' => null,
    'value' => null,
    'hint' => null,
    'error' => null,
    'required' => false,
    'id' => null,
])

@php
    $inputId = $id ?? 'field-'.\Illuminate\Support\Str::random(8);
    $message = $error ?? (($errors ?? null)?->first($name) ?: (($errors ?? null)?->first($currencyName) ?: null));
@endphp

<x-blade.u-i.field :label="$label" :for="$inputId" :name="$name" :hint="$hint" :error="$message" :required="$required">
    <div class="field-box field-box--flush">
        <input
            type="text"
            inputmode="decimal"
            id="{{ $inputId }}"
            name="{{ $name }}"
            value="{{ $value }}"
            @if ($required) required @endif
            @if ($message) aria-invalid="true" @endif
            {{ $attributes->class(['field-box__input', 'field-box__input--end']) }}
        >
        <select class="field-box__addon field-box__addon--end" name="{{ $currencyName }}" aria-label="{{ $label }}">
            @foreach ($currencies as $code => $currencyLabel)
                <option value="{{ $code }}" @selected((string) $code === (string) $currency)>{{ $currencyLabel }}</option>
            @endforeach
        </select>
    </div>
</x-blade.u-i.field>
