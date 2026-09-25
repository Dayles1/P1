<div class="auth-card">

    <span class="auth-card__icon">
        <x-blade.u-i.icon name="shield" size="26" />
    </span>

    <div class="auth-card__header">
        <h1 class="auth-card__title">{{ __('ui.auth.confirm.title') }}</h1>
        <p class="auth-card__subtitle">{{ __('ui.auth.confirm.subtitle') }}</p>
    </div>

    <form class="auth-form" data-auth-form="confirm-password" novalidate>
        @csrf

        <x-blade.u-i.password-input
            id="confirm-password-password"
            aria-describedby="confirm-password-password-error"
            name="password"
            :label="__('ui.auth.password')"
            :placeholder="__('ui.auth.password_placeholder')"
            autocomplete="current-password"
            aria-required="true"
        />

        <x-blade.u-i.button type="submit" size="lg" block>
            {{ __('ui.auth.confirm.submit') }}
        </x-blade.u-i.button>
    </form>

    <p class="auth-card__footer">
        <a href="/forgot-password" class="auth-link" data-auth-link="forgot-password">{{ __('ui.auth.confirm.forgot') }}</a>
    </p>

</div>
