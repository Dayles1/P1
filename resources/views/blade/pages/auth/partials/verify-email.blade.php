<div class="auth-card">

    <span class="auth-card__icon">
        <x-blade.u-i.icon name="mail" size="26" />
    </span>

    {{--
        Two versions of the text: the address in bold once auth-pages.js
        knows it (right after sign-up, or from the signed-in account),
        a generic one until then.
    --}}
    <div class="auth-card__header">
        <h1 class="auth-card__title" id="verify-email-title">{{ __('ui.auth.verify.title') }}</h1>
        <p class="auth-card__subtitle" data-verify-text="generic">{{ __('ui.auth.verify.text') }}</p>
        <p class="auth-card__subtitle" data-verify-text="email" hidden>
            @include('blade.pages.auth.partials._email-sentence', ['key' => 'ui.auth.verify.text_for'])
        </p>
    </div>

    <form class="auth-form" data-auth-form="verify-email-code" novalidate>
        {{-- Described by the error only: the text above comes in two versions, one of them hidden. --}}
        @include('blade.pages.auth.partials._code-input', [
            'labelledBy' => 'verify-email-title',
            'describedBy' => 'verify-email-code-error',
        ])

        <span class="field-error" id="verify-email-code-error" role="alert" data-field-error="code"></span>

        <x-blade.u-i.button type="submit" size="lg" block>
            {{ __('ui.auth.verify.submit') }}
        </x-blade.u-i.button>
    </form>

    {{-- Its banners ("sent again", errors) show under the heading, at the top of the first form. --}}
    <form class="auth-form" data-auth-form="verification-notification" data-auth-banners-in="verify-email-code" novalidate>
        @csrf

        {{-- Only asked for while the address is unknown; hidden (still posted) once it is. --}}
        <div data-verify-email-field>
            <x-blade.u-i.input
                id="verification-email"
                type="email"
                name="email"
                icon="mail"
                :label="__('ui.auth.email')"
                :placeholder="__('ui.auth.email_placeholder')"
                autocomplete="email"
                aria-required="true"
            />
        </div>

        <x-blade.u-i.button type="submit" variant="outline" size="lg" block>
            {{ __('ui.auth.verify.resend') }}
        </x-blade.u-i.button>
    </form>

    <p class="auth-card__footer">
        {{ __('ui.auth.verify.wrong_account') }}
        <a href="/login" class="auth-link" data-auth-link="login">{{ __('ui.auth.verify.login') }}</a>
    </p>

</div>
