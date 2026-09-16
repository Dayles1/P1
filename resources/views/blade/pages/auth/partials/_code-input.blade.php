{{--
    Shared 6-digit code entry, included wherever this app asks for a
    verification code (login 2FA, passwordless login, email verification).
    Pass $name for the hidden field's form field name (defaults to "code").
--}}
@php($codeInputName = $name ?? 'code')

<div class="code-input" data-code-input>
    @for ($i = 0; $i < 6; $i++)
        <input
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="1"
            autocomplete="{{ $i === 0 ? 'one-time-code' : 'off' }}"
            class="code-input__box"
            data-code-box
            aria-label="Digit {{ $i + 1 }}"
        >
    @endfor

    <input type="hidden" name="{{ $codeInputName }}" data-code-value>
</div>
