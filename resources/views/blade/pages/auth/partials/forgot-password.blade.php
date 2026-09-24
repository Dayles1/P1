<div class="auth-card">

    <div class="auth-card__header">

        <h1>
            Forgot your password?
        </h1>

        <p>
            Enter your email and we will send you
            instructions to reset your password.
        </p>

    </div>


    <form
        class="auth-form"
        data-auth-form="forgot-password"
        novalidate
    >

        @csrf


        <div class="field-group">

            <label
                for="forgot-email"
                class="field-label"
            >
                Email address
            </label>

            <input
                id="forgot-email"
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
                Send reset link
            </span>

            <span
                class="auth-button__loader"
                aria-hidden="true"
            ></span>

        </button>


        <div class="auth-page-switch">

            Remember your password?

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