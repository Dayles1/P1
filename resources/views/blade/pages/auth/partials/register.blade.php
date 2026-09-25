<div class="auth-card">

    <div class="auth-card__header">
        <h1 class="auth-card__title">{{ __('ui.auth.register.title') }}</h1>
        <p class="auth-card__subtitle">{{ __('ui.auth.register.subtitle') }}</p>
    </div>

    <form class="auth-form" data-auth-form="register" novalidate>
        @csrf

        <x-blade.u-i.input
            id="register-name"
            name="name"
            icon="user"
            :label="__('ui.auth.register.name')"
            :placeholder="__('ui.auth.register.name_placeholder')"
            autocomplete="name"
            aria-required="true"
        />

        <x-blade.u-i.input
            id="register-email"
            type="email"
            name="email"
            icon="mail"
            :label="__('ui.auth.email')"
            :placeholder="__('ui.auth.email_placeholder')"
            autocomplete="email"
            aria-required="true"
        />

        <x-blade.u-i.password-input
            id="register-password"
            aria-describedby="register-password-error"
            name="password"
            :label="__('ui.auth.password')"
            :placeholder="__('ui.auth.register.password_placeholder')"
            autocomplete="new-password"
            aria-required="true"
            strength
        />

        {{-- The API checks the password twice (`confirmed`), so the repeat stays. --}}
        <x-blade.u-i.password-input
            id="register-password-confirmation"
            aria-describedby="register-password-confirmation-error"
            name="password_confirmation"
            :label="__('ui.auth.register.password_confirmation')"
            :placeholder="__('ui.auth.register.password_confirmation_placeholder')"
            autocomplete="new-password"
            aria-required="true"
        />

        <x-blade.u-i.button type="submit" size="lg" block>
            {{ __('ui.auth.register.submit') }}
        </x-blade.u-i.button>
    </form>

    <p class="auth-card__footer">
        {{ __('ui.auth.register.have_account') }}
        <a href="/login" class="auth-link" data-auth-link="login">{{ __('ui.auth.register.login') }}</a>
    </p>

</div>
