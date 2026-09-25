<div class="auth-card">

    {{-- STEP 1: where to send the code --}}
    <div class="auth-step" data-auth-step="request">

        <span class="auth-card__icon">
            <x-blade.u-i.icon name="mail" size="26" />
        </span>

        <div class="auth-card__header">
            <h1 class="auth-card__title">{{ __('ui.auth.code.request_title') }}</h1>
            <p class="auth-card__subtitle">{{ __('ui.auth.code.request_subtitle') }}</p>
        </div>

        <form class="auth-form" data-auth-form="login-code-request" novalidate>
            @csrf

            <x-blade.u-i.input
                id="login-code-email"
                type="email"
                name="email"
                icon="mail"
                :label="__('ui.auth.email')"
                :placeholder="__('ui.auth.email_placeholder')"
                autocomplete="email"
                aria-required="true"
            />

            <x-blade.u-i.button type="submit" size="lg" block>
                {{ __('ui.auth.code.send') }}
            </x-blade.u-i.button>
        </form>

        <p class="auth-card__footer">
            <a href="/login" class="auth-link auth-link--back" data-auth-link="login">
                <x-blade.u-i.icon name="arrow" size="16" />
                {{ __('ui.auth.code.with_password') }}
            </a>
        </p>

    </div>


    {{-- STEP 2: the code from the e-mail --}}
    <div class="auth-step" data-auth-step="verify" hidden>

        <span class="auth-card__icon">
            <x-blade.u-i.icon name="mail" size="26" />
        </span>

        <div class="auth-card__header">
            <h1 class="auth-card__title" id="login-code-verify-title">{{ __('ui.auth.code.title') }}</h1>
            <p class="auth-card__subtitle" id="login-code-verify-text">
                @include('blade.pages.auth.partials._email-sentence', ['key' => 'ui.auth.code.text'])
            </p>
        </div>

        <form class="auth-form" data-auth-form="login-code-verify" novalidate>
            @include('blade.pages.auth.partials._code-input', [
                'labelledBy' => 'login-code-verify-title',
                'describedBy' => 'login-code-verify-text login-code-verify-code-error',
            ])

            <span class="field-error" id="login-code-verify-code-error" role="alert" data-field-error="code"></span>

            <div class="auth-form__resend">
                <button type="button" class="auth-resend" data-resend-code>{{ __('ui.auth.resend_code') }}</button>

                <button type="button" class="auth-link" data-back-to-request>{{ __('ui.auth.code.change_email') }}</button>
            </div>

            <x-blade.u-i.button type="submit" size="lg" block>
                {{ __('ui.auth.code.submit') }}
            </x-blade.u-i.button>
        </form>

        <p class="auth-card__footer">
            <a href="/login" class="auth-link auth-link--back" data-auth-link="login">
                <x-blade.u-i.icon name="arrow" size="16" />
                {{ __('ui.auth.code.with_password') }}
            </a>
        </p>

    </div>

</div>
