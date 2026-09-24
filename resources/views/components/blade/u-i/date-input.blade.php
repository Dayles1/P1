{{--
    Date or date range with a calendar popover (shared/date-picker.js).
    Values post as ISO `Y-m-d` from hidden inputs; the visible text is in
    the page locale's own numeric format.

    <x-blade.u-i.date-input name="birthday" :label="…" :value="$user->birthday?->toDateString()" />
    <x-blade.u-i.date-input range name-from="from" name-to="to" :from="$from" :to="$to" presets :label="…" />

    `min` / `max` (ISO) disable days outside the allowed span.
--}}
@props([
    'label' => null,
    'name' => null,
    'value' => null,
    'range' => false,
    'nameFrom' => 'from',
    'nameTo' => 'to',
    'from' => null,
    'to' => null,
    'presets' => false,
    'min' => null,
    'max' => null,
    'hint' => null,
    'error' => null,
    'required' => false,
    'placeholder' => null,
    'id' => null,
])

@php
    $inputId = $id ?? 'field-'.\Illuminate\Support\Str::random(8);
    $errorName = $range ? $nameFrom : $name;
    $message = $error ?? ($errorName ? ($errors ?? null)?->first($errorName) : null);
@endphp

<x-blade.u-i.field
    :label="$label"
    :for="$inputId"
    :name="$errorName"
    :hint="$hint"
    :error="$message"
    :required="$required"
    data-date-picker
    :data-mode="$range ? 'range' : 'single'"
    :data-presets="$presets ? '' : null"
    :data-min="$min"
    :data-max="$max"
>
    <div class="popover-anchor">
        <div class="field-box">
            <span class="field-box__icon"><x-blade.u-i.icon name="calendar" size="18" /></span>

            @if ($range)
                <button
                    type="button"
                    id="{{ $inputId }}"
                    class="field-box__input date-range-value"
                    data-date-display
                    data-placeholder="{{ $placeholder ?? __('ui.components.choose_date') }}"
                    aria-haspopup="dialog"
                    aria-expanded="false"
                ></button>
            @else
                <input
                    type="text"
                    id="{{ $inputId }}"
                    class="field-box__input"
                    inputmode="numeric"
                    autocomplete="off"
                    data-date-display
                    aria-haspopup="dialog"
                    aria-expanded="false"
                    @if ($placeholder) placeholder="{{ $placeholder }}" @endif
                    @if ($required) required @endif
                    @if ($message) aria-invalid="true" @endif
                    {{ $attributes }}
                >
            @endif
        </div>

        <div class="popover" data-date-popover hidden></div>
    </div>

    @if ($range)
        <input type="hidden" name="{{ $nameFrom }}" value="{{ $from }}" data-date-from>
        <input type="hidden" name="{{ $nameTo }}" value="{{ $to }}" data-date-to>
    @else
        <input type="hidden" @if ($name) name="{{ $name }}" @endif value="{{ $value }}" data-date-value>
    @endif
</x-blade.u-i.field>
