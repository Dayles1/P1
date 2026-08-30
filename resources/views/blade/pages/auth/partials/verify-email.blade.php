<div class="auth-card auth-card--centered">

    <div class="auth-card__icon">
        ✉
    </div>


    <div class="auth-card__header">

        <h1>
            Verify your email
        </h1>

        <p>
            Check your inbox and click the verification
            link to activate your account.
        </p>

    </div>


    <form
        class="auth-form"
        data-auth-form="verification-notification"
        novalidate
    >

        @csrf


        <div class="form-group">

            <label
                for="verification-email"
                class="form-label"
            >
                Email address
            </label>

            <input
                id="verification-email"
                type="email"
                name="email"
                class="form-input"
                placeholder="you@example.com"
                autocomplete="email"
                required
            >

            <span
                class="form-error"
                data-error-for="email"
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