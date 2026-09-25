{{--
    Shared 6-digit code entry, included wherever this app asks for a
    verification code (login 2FA, passwordless login, email verification).
    Pass $name for the hidden field's form field name (defaults to "code").

    The boxes form one group, named by the step's heading ($labelledBy)
    and described by its text and error slot ($describedBy, element ids).
--}}
<x-blade.u-i.code-input
    :name="$name ?? 'code'"
    role="group"
    :aria-labelledby="$labelledBy ?? null"
    :aria-describedby="$describedBy ?? null"
/>
