<div class="auth-card">

    <span class="auth-card__icon">
        <x-blade.u-i.icon name="key" size="26" />
    </span>

    <div class="auth-card__header">
        <h1 class="auth-card__title">{{ __('ui.auth.forgot.title') }}</h1>
        <p class="auth-card__subtitle">{{ __('ui.auth.forgot.subtitle') }}</p>
    </div>

    <form class="auth-form" data-auth-form="forgot-password" novalidate>
        @csrf

        <x-blade.u-i.input
            id="forgot-email"
            type="email"
            name="email"
            icon="mail"
            :label="__('ui.auth.email')"
            :placeholder="__('ui.auth.email_placeholder')"
            autocomplete="email"
            aria-required="true"
        />

        <x-blade.u-i.button type="submit" size="lg" block>
            {{ __('ui.auth.forgot.submit') }}
        </x-blade.u-i.button>
    </form>

    <p class="auth-card__footer">
        <a href="/login" class="auth-link auth-link--back" data-auth-link="login">
            <x-blade.u-i.icon name="arrow" size="16" />
            {{ __('ui.auth.back_to_login') }}
        </a>
    </p>

</div>
