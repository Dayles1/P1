{{--
    <x-blade.u-i.radio name="repeat" value="daily" checked>{{ … }}</x-blade.u-i.radio>
    Group several in <div class="choice-group" role="radiogroup" aria-label="…">.
--}}
@props(['name' => null, 'value' => '', 'checked' => false, 'hint' => null, 'id' => null])

@php($inputId = $id ?? 'radio-'.\Illuminate\Support\Str::random(8))

<label class="radio" for="{{ $inputId }}">
    <input
        type="radio"
        id="{{ $inputId }}"
        @if ($name) name="{{ $name }}" @endif
        value="{{ $value }}"
        @checked($checked)
        {{ $attributes->class(['radio__input']) }}
    >
    <span class="radio__dot" aria-hidden="true"></span>
    <span class="radio__text">
        <span class="radio__label">{{ $slot }}</span>
        @if ($hint)
            <span class="radio__hint">{{ $hint }}</span>
        @endif
    </span>
</label>
