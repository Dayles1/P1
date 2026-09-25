{{--
    Verification code — one box per digit and a hidden `name` field kept
    in sync by shared/code-input.js (paste, backspace, auto-advance).

    <x-blade.u-i.code-input name="code" />
--}}
@props(['name' => 'code', 'length' => 6])

<div {{ $attributes->class(['code-input']) }} data-code-input>
    @for ($i = 0; $i < $length; $i++)
        <input
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="1"
            autocomplete="{{ $i === 0 ? 'one-time-code' : 'off' }}"
            class="code-input__box"
            data-code-box
            aria-label="{{ __('ui.components.digit', ['n' => $i + 1]) }}"
        >
    @endfor

    <input type="hidden" name="{{ $name }}" data-code-value>
</div>
