{{--
    <x-blade.u-i.number-input name="seats" :label="…" :value="12" min="1" max="99" />
--}}
@props([
    'label' => null,
    'name' => null,
    'hint' => null,
    'error' => null,
    'required' => false,
    'value' => null,
    'id' => null,
])

@php
    $inputId = $id ?? 'field-'.\Illuminate\Support\Str::random(8);
    $message = $error ?? ($name ? ($errors ?? null)?->first($name) : null);
@endphp

<x-blade.u-i.field :label="$label" :for="$inputId" :name="$name" :hint="$hint" :error="$message" :required="$required">
    <div class="field-box field-box--flush">
        <button type="button" class="field-box__step" data-step="-1" aria-label="{{ __('ui.components.decrease') }}">
            <x-blade.u-i.icon name="minus" size="18" />
        </button>
        <input
            type="number"
            id="{{ $inputId }}"
            @if ($name) name="{{ $name }}" @endif
            value="{{ $value }}"
            @if ($required) required @endif
            @if ($message) aria-invalid="true" @endif
            {{ $attributes->class(['field-box__input', 'field-box__input--center']) }}
        >
        <button type="button" class="field-box__step" data-step="1" aria-label="{{ __('ui.components.increase') }}">
            <x-blade.u-i.icon name="plus" size="18" />
        </button>
    </div>
</x-blade.u-i.field>
