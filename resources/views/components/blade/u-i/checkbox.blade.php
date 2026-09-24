{{--
    <x-blade.u-i.checkbox name="remember">{{ __('ui.auth.remember_me') }}</x-blade.u-i.checkbox>
    <x-blade.u-i.checkbox name="private" :hint="…" checked>…</x-blade.u-i.checkbox>
--}}
<label class="checkbox" for="{{ $inputId }}">
    <input
        type="checkbox"
        id="{{ $inputId }}"
        @if ($name) name="{{ $name }}" @endif
        @checked($checked)
        @if ($indeterminate) data-indeterminate aria-checked="mixed" @endif
        {{ $attributes->class(['checkbox__input']) }}
    >
    <span class="checkbox__box" aria-hidden="true"></span>
    <span class="checkbox__text">
        <span class="checkbox__label">{{ $slot }}</span>
        @if ($hint)
            <span class="checkbox__hint">{{ $hint }}</span>
        @endif
    </span>
</label>
