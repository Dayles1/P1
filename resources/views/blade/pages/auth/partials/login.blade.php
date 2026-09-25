<div class="auth-card">

    {{-- STEP 1: e-mail + password --}}
    <div class="auth-step" data-auth-step="password">

        <div class="auth-card__header">
            <h1 class="auth-card__title">{{ __('ui.auth.login.title') }}</h1>
            <p class="auth-card__subtitle">{{ __('ui.auth.login.subtitle') }}</p>
        </div>

        <form class="auth-form" data-auth-form="login" novalidate>
            @csrf

            <x-blade.u-i.input
                id="login-email"
                type="email"
                name="email"
                icon="mail"
                :label="__('ui.auth.email')"
                :placeholder="__('ui.auth.email_placeholder')"
                autocomplete="email"
                aria-required="true"
            />

            <x-blade.u-i.password-input
                id="login-password"
                aria-describedby="login-password-error"
                name="password"
                :label="__('ui.auth.password')"
                :placeholder="__('ui.auth.password_placeholder')"
                autocomplete="current-password"
                aria-required="true"
            />

            <div class="auth-form__options">
                <x-blade.u-i.checkbox name="remember" value="1">
                    {{ __('ui.auth.login.remember') }}
                </x-blade.u-i.checkbox>

                <a href="/forgot-password" class="auth-link" data-auth-link="forgot-password">
                    {{ __('ui.auth.login.forgot') }}
                </a>
            </div>

            <x-blade.u-i.button type="submit" size="lg" block>
                {{ __('ui.auth.login.submit') }}
            </x-blade.u-i.button>

            <div class="auth-divider" role="separator">{{ __('ui.auth.or') }}</div>

            <x-blade.u-i.button href="/login/code" variant="outline" size="lg" icon="mail" block data-auth-link="login-code">
                {{ __('ui.auth.login.with_code') }}
            </x-blade.u-i.button>
        </form>

        <p class="auth-card__footer">
            {{ __('ui.auth.login.no_account') }}
            <a href="/register" class="auth-link" data-auth-link="register">{{ __('ui.auth.login.register') }}</a>
        </p>

    </div>


    {{--
        STEP 2: the e-mailed code, shown after a correct password when
        the account asks for a code on every sign-in.
    --}}
    <div class="auth-step" data-auth-step="verify" hidden>

        <span class="auth-card__icon">
            <x-blade.u-i.icon name="mail" size="26" />
        </span>

        <div class="auth-card__header">
            <h1 class="auth-card__title" id="login-verify-title">{{ __('ui.auth.two_factor.title') }}</h1>
            <p class="auth-card__subtitle" id="login-verify-text">
                @include('blade.pages.auth.partials._email-sentence', ['key' => 'ui.auth.two_factor.text'])
            </p>
        </div>

        <form class="auth-form" data-auth-form="login-verify" novalidate>
            @include('blade.pages.auth.partials._code-input', [
                'labelledBy' => 'login-verify-title',
                'describedBy' => 'login-verify-text login-verify-code-error',
            ])

            <span class="field-error" id="login-verify-code-error" role="alert" data-field-error="code"></span>

            <div class="auth-form__resend">
                <button type="button" class="auth-resend" data-resend-code>{{ __('ui.auth.resend_code') }}</button>
            </div>

            <x-blade.u-i.button type="submit" size="lg" block>
                {{ __('ui.auth.two_factor.submit') }}
            </x-blade.u-i.button>
        </form>

        <p class="auth-card__footer">
            <button type="button" class="auth-link auth-link--back" data-back-to-password>
                <x-blade.u-i.icon name="arrow" size="16" />
                {{ __('ui.auth.back_to_login') }}
            </button>
        </p>

    </div>

</div>
