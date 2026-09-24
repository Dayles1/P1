{{--
    Country dial code + local number.

    <x-blade.u-i.phone-input name="phone" country-name="phone_country"
                             :countries="$dialCodes" country="UZ" :label="…" />
--}}
@props([
    'label' => null,
    'name' => 'phone',
    'countryName' => 'phone_country',
    'countries' => [],
    'country' => null,
    'value' => null,
    'hint' => null,
    'error' => null,
    'required' => false,
    'id' => null,
])

@php
    $inputId = $id ?? 'field-'.\Illuminate\Support\Str::random(8);
    $message = $error ?? (($errors ?? null)?->first($name) ?: (($errors ?? null)?->first($countryName) ?: null));
@endphp

<x-blade.u-i.field :label="$label" :for="$inputId" :name="$name" :hint="$hint" :error="$message" :required="$required">
    <div class="field-box field-box--flush">
        <select class="field-box__addon field-box__addon--start" name="{{ $countryName }}" aria-label="{{ $label }}">
            @foreach ($countries as $code => $countryLabel)
                <option value="{{ $code }}" @selected((string) $code === (string) $country)>{{ $countryLabel }}</option>
            @endforeach
        </select>
        <input
            type="tel"
            id="{{ $inputId }}"
            name="{{ $name }}"
            value="{{ $value }}"
            autocomplete="tel-national"
            @if ($required) required @endif
            @if ($message) aria-invalid="true" @endif
            {{ $attributes->class(['field-box__input']) }}
        >
    </div>
</x-blade.u-i.field>
