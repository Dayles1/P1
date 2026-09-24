{{--
    <x-blade.u-i.password-input name="password" :label="…" autocomplete="new-password" strength />
--}}
@props([
    'label' => null,
    'name' => 'password',
    'hint' => null,
    'error' => null,
    'required' => false,
    'strength' => false,
    'id' => null,
])

@php
    $inputId = $id ?? 'field-'.\Illuminate\Support\Str::random(8);
    $message = $error ?? ($name ? ($errors ?? null)?->first($name) : null);
@endphp

<x-blade.u-i.field :label="$label" :for="$inputId" :name="$name" :hint="$hint" :error="$message" :required="$required">
    <div class="field-box">
        <span class="field-box__icon"><x-blade.u-i.icon name="lock" size="18" /></span>
        <input
            type="password"
            id="{{ $inputId }}"
            name="{{ $name }}"
            @if ($required) required @endif
            @if ($message) aria-invalid="true" @endif
            {{ $attributes->class(['field-box__input'])->merge(['autocomplete' => 'current-password']) }}
        >
        <button type="button" class="field-box__action" data-password-reveal aria-pressed="false" aria-label="{{ __('ui.components.show_password') }}">
            <x-blade.u-i.icon name="eye" size="18" />
        </button>
    </div>

    @if ($strength)
        <div class="strength" data-strength-for="{{ $inputId }}" data-level="0" hidden aria-live="polite">
            <span class="strength__bars" aria-hidden="true">
                <span class="strength__bar"></span><span class="strength__bar"></span><span class="strength__bar"></span><span class="strength__bar"></span>
            </span>
            <span class="strength__label"></span>
        </div>
    @endif
</x-blade.u-i.field>
