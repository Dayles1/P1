{{--
    Shared 6-digit code entry, included wherever this app asks for a
    verification code (login 2FA, passwordless login, email verification).
    Pass $name for the hidden field's form field name (defaults to "code").
--}}
<x-blade.u-i.code-input :name="$name ?? 'code'" />
