<div class="auth-card auth-card--centered">

    <div class="auth-card__icon">
        <x-blade.u-i.icon name="mail" size="28" />
    </div>


    <div class="auth-card__header">

        <h1>
            Verify your email
        </h1>

        <p>
            We've sent a verification link and a 6-digit code to your email.
            Click the link, or enter the code below — either one works.
        </p>

    </div>


    <form
        class="auth-form"
        data-auth-form="verify-email-code"
        novalidate
    >

        @include('blade.pages.auth.partials._code-input')

        <span class="field-error text-center" data-field-error="code"></span>

        <button type="submit" class="auth-button">
            <span class="auth-button__text">Verify email</span>
            <span class="auth-button__loader" aria-hidden="true"></span>
        </button>

    </form>


    <form
        class="auth-form"
        data-auth-form="verification-notification"
        novalidate
    >

        @csrf


        <div class="field-group">

            <label
                for="verification-email"
                class="field-label"
            >
                Email address
            </label>

            <input
                id="verification-email"
                type="email"
                name="email"
                class="field-input"
                placeholder="you@example.com"
                autocomplete="email"
                required
            >

            <span
                class="field-error"
                data-field-error="email"
            ></span>

        </div>


        <button
            type="submit"
            class="auth-button"
        >

            <span class="auth-button__text">
                Resend verification email
            </span>

            <span
                class="auth-button__loader"
                aria-hidden="true"
            ></span>

        </button>


        <div class="auth-page-switch">

            <a
                href="/login"
                class="auth-link"
                data-auth-link="login"
            >
                Back to sign in
            </a>

        </div>

    </form>

</div>