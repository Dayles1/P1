{{--
    The frame every form control sits in: label on top, the control
    (slot), then a hint and the error slot [data-field-error="<name>"]
    that shared/forms.js fills from the API. Server-side errors for
    `name` come from the error bag automatically.

    <x-blade.u-i.field :label="…" for="bio" name="bio" :hint="…">
        <textarea id="bio" name="bio" class="field-input"></textarea>
    </x-blade.u-i.field>
--}}
@props([
    'label' => null,
    'for' => null,
    'name' => null,
    'hint' => null,
    'error' => null,
    'required' => false,
])

@php($message = $error ?? ($name ? ($errors ?? null)?->first($name) : null))

<div {{ $attributes->class(['field-group']) }}>
    @if ($label)
        <label class="field-label" @if ($for) for="{{ $for }}" @endif>{{ $label }}@if ($required)<span class="field-label__required" aria-hidden="true">*</span>@endif</label>
    @endif

    {{ $slot }}

    @isset($meta)
        {{ $meta }}
    @endisset

    @if ($hint)
        <span class="field-hint" @if ($for) id="{{ $for }}-hint" @endif>{{ $hint }}</span>
    @endif

    @if ($name)
        <span class="field-error" @if ($for) id="{{ $for }}-error" @endif data-field-error="{{ $name }}">@if ($message)<x-blade.u-i.icon name="alert" size="14" class="field-error__icon" />{{ $message }}@endif</span>
    @endif
</div>
