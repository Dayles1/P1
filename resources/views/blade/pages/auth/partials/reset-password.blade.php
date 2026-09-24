@php($knownResetEmail = filled($resetEmail ?? null) ? (string) $resetEmail : null)

<div class="auth-card">

    <span class="auth-card__icon">
        <x-blade.u-i.icon name="lock" size="26" />
    </span>

    <div class="auth-card__header">
        <h1 class="auth-card__title">{{ __('ui.auth.reset.title') }}</h1>
        <p class="auth-card__subtitle">
            @if ($knownResetEmail)
                @include('blade.pages.auth.partials._email-sentence', ['key' => 'ui.auth.reset.subtitle_for', 'email' => $knownResetEmail])
            @else
                {{ __('ui.auth.reset.subtitle') }}
            @endif
        </p>
    </div>

    <form class="auth-form" data-auth-form="reset-password" novalidate>
        @csrf

        {{--
            The reset link carries the address (?email=), so it is only
            asked for when the link did not.
        --}}
        @if ($knownResetEmail)
            <input id="reset-email" type="hidden" name="email" value="{{ $knownResetEmail }}">
            <span class="field-error" data-field-error="email"></span>
        @else
            <x-blade.u-i.input
                id="reset-email"
                type="email"
                name="email"
                icon="mail"
                :label="__('ui.auth.email')"
                :placeholder="__('ui.auth.email_placeholder')"
                autocomplete="email"
                aria-required="true"
            />
        @endif

        <x-blade.u-i.password-input
            id="reset-password"
            aria-describedby="reset-password-error"
            name="password"
            :label="__('ui.auth.reset.password')"
            :placeholder="__('ui.auth.reset.password_placeholder')"
            autocomplete="new-password"
            aria-required="true"
            strength
        />

        <x-blade.u-i.password-input
            id="reset-password-confirmation"
            aria-describedby="reset-password-confirmation-error"
            name="password_confirmation"
            :label="__('ui.auth.reset.password_confirmation')"
            autocomplete="new-password"
            aria-required="true"
        />

        <x-blade.u-i.button type="submit" size="lg" block>
            {{ __('ui.auth.reset.submit') }}
        </x-blade.u-i.button>
    </form>

    <p class="auth-card__footer">
        <a href="/login" class="auth-link auth-link--back" data-auth-link="login">
            <x-blade.u-i.icon name="arrow" size="16" />
            {{ __('ui.auth.back_to_login') }}
        </a>
    </p>

</div>
