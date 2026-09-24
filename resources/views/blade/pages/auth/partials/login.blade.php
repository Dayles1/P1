<div class="auth-card">

    <div data-auth-step="password">

    <div class="auth-card__header">

        <h1>
            Welcome back
        </h1>

        <p>
            Sign in to your account to continue.
        </p>

    </div>


    <form
        class="auth-form"
        data-auth-form="login"
        novalidate
    >

        @csrf


        {{-- EMAIL --}}
        <div class="field-group">

            <label
                for="login-email"
                class="field-label"
            >
                Email address
            </label>

            <input
                id="login-email"
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


        {{-- PASSWORD --}}
        <div class="field-group">

            <label
                for="login-password"
                class="field-label"
            >
                Password
            </label>


            <div class="field-control">

                <input
                    id="login-password"
                    type="password"
                    name="password"
                    class="field-input"
                    placeholder="Enter your password"
                    autocomplete="current-password"
                    required
                >


                <button
                    type="button"
                    class="password-toggle"
                    data-password-toggle="login-password"
                    aria-label="Show password"
                >
                    <x-blade.u-i.icon name="eye" size="18" />
                </button>

            </div>


            <span
                class="field-error"
                data-field-error="password"
            ></span>

        </div>


        {{-- OPTIONS --}}
        <div class="auth-form__options">

            <label class="auth-checkbox">

                <input
                    type="checkbox"
                    name="remember"
                    value="1"
                >

                <span>
                    Remember me
                </span>

            </label>


            <a
                href="/forgot-password"
                class="auth-link"
                data-auth-link="forgot-password"
            >
                Forgot password?
            </a>

        </div>


        {{-- SUBMIT --}}
        <button
            type="submit"
            class="auth-button"
        >

            <span class="auth-button__text">
                Sign in
            </span>

            <span
                class="auth-button__loader"
                aria-hidden="true"
            ></span>

        </button>


        {{-- ONE-TIME CODE --}}
        <div class="auth-page-switch">

            <a
                href="/login/code"
                class="auth-link"
                data-auth-link="login-code"
            >
                Login with one-time code
            </a>

        </div>


        {{-- REGISTER --}}
        <div class="auth-page-switch">

            Don't have an account?

            <a
                href="/register"
                class="auth-link"
                data-auth-link="register"
            >
                Sign up
            </a>

        </div>

    </form>

    </div>


    {{-- =====================================================
         VERIFICATION STEP (shown after a correct password when
         the account has "require a code on every login" on)
         ===================================================== --}}

    <div data-auth-step="verify" hidden>

        <div class="auth-card__header">
            <h1>Enter verification code</h1>
            <p>We've sent a 6-digit code to your email.</p>
        </div>

        <form class="auth-form" data-auth-form="login-verify" novalidate>

            @include('blade.pages.auth.partials._code-input')

            <span class="field-error text-center" data-field-error="code"></span>

            <button type="submit" class="auth-button">
                <span class="auth-button__text">Verify &amp; sign in</span>
                <span class="auth-button__loader" aria-hidden="true"></span>
            </button>

            <div class="auth-page-switch">
                <button type="button" class="auth-link" data-resend-code>Resend code</button>
            </div>

            <div class="auth-page-switch">
                <button type="button" class="auth-step-back" data-back-to-password><x-blade.u-i.icon name="back" size="16" /> Back to sign in</button>
            </div>

        </form>

    </div>

</div>