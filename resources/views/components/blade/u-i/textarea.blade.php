{{--
    <x-blade.u-i.textarea name="description" :label="…" :max="500" :hint="…" rows="4" />
    With `max` the field gets maxlength and a live "48 / 500" counter.
--}}
@props([
    'label' => null,
    'name' => null,
    'hint' => null,
    'error' => null,
    'required' => false,
    'max' => null,
    'value' => '',
    'id' => null,
])

@php
    $inputId = $id ?? 'field-'.\Illuminate\Support\Str::random(8);
    $message = $error ?? ($name ? ($errors ?? null)?->first($name) : null);
@endphp

<x-blade.u-i.field :label="$label" :for="$inputId" :name="$name" :error="$message" :required="$required" :hint="$max ? null : $hint">
    <textarea
        id="{{ $inputId }}"
        @if ($name) name="{{ $name }}" @endif
        @if ($required) required @endif
        @if ($max) maxlength="{{ $max }}" data-char-counter @endif
        @if ($message) aria-invalid="true" @endif
        {{ $attributes->class(['field-input'])->merge(['rows' => 4]) }}
    >{{ $value }}</textarea>

    @if ($max)
        <x-slot:meta>
            <span class="field-meta">
                @if ($hint)<span id="{{ $inputId }}-hint">{{ $hint }}</span>@endif
                <span class="field-meta__count" data-char-count aria-live="polite">{{ __('ui.components.char_count', ['count' => mb_strlen((string) $value), 'max' => $max]) }}</span>
            </span>
        </x-slot:meta>
    @endif
</x-blade.u-i.field>
