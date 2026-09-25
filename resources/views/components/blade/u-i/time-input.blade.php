{{--
    Time of day with a slot list (shared/date-picker.js). Posts `HH:MM`;
    typing a time works too. `step` is the slot spacing in minutes.

    <x-blade.u-i.time-input name="remind_at" :label="…" value="07:00" step="30" />
--}}
@props([
    'label' => null,
    'name' => null,
    'value' => null,
    'step' => 30,
    'hint' => null,
    'error' => null,
    'required' => false,
    'id' => null,
])

@php
    $inputId = $id ?? 'field-'.\Illuminate\Support\Str::random(8);
    $message = $error ?? ($name ? ($errors ?? null)?->first($name) : null);
@endphp

<x-blade.u-i.field
    :label="$label"
    :for="$inputId"
    :name="$name"
    :hint="$hint"
    :error="$message"
    :required="$required"
    data-time-picker
    :data-step="$step"
>
    <div class="popover-anchor">
        <div class="field-box">
            <span class="field-box__icon"><x-blade.u-i.icon name="clock" size="18" /></span>
            <input
                type="text"
                id="{{ $inputId }}"
                class="field-box__input"
                inputmode="numeric"
                autocomplete="off"
                placeholder="00:00"
                value="{{ $value }}"
                data-time-display
                aria-haspopup="listbox"
                aria-expanded="false"
                @if ($required) required @endif
                @if ($message) aria-invalid="true" @endif
                {{ $attributes }}
            >
        </div>

        <div class="popover" data-time-popover hidden></div>
    </div>

    <input type="hidden" @if ($name) name="{{ $name }}" @endif value="{{ $value }}" data-time-value>
</x-blade.u-i.field>
