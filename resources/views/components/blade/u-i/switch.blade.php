{{--
    <x-blade.u-i.switch name="notify_email" :checked="$enabled" :hint="…">{{ … }}</x-blade.u-i.switch>
    A real checkbox with role="switch": it posts like one, reads like a toggle.
--}}
@props(['name' => null, 'checked' => false, 'hint' => null, 'value' => '1', 'id' => null])

@php($inputId = $id ?? 'switch-'.\Illuminate\Support\Str::random(8))

<label class="switch" for="{{ $inputId }}">
    <span class="switch__text">
        <span class="switch__label">{{ $slot }}</span>
        @if ($hint)
            <span class="switch__hint">{{ $hint }}</span>
        @endif
    </span>
    <input
        type="checkbox"
        role="switch"
        id="{{ $inputId }}"
        @if ($name) name="{{ $name }}" @endif
        value="{{ $value }}"
        @checked($checked)
        {{ $attributes->class(['switch__input']) }}
    >
    <span class="switch__track" aria-hidden="true"></span>
</label>
