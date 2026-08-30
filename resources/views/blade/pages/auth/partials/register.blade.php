<div class="auth-card">

    <div class="auth-card__header">

        <h1>
            Create your account
        </h1>

        <p>
            Start your workspace in a few seconds.
        </p>

    </div>


    <form
        class="auth-form"
        data-auth-form="register"
        novalidate
    >

        @csrf


        {{-- NAME --}}
        <div class="form-group">

            <label
                for="register-name"
                class="form-label"
            >
                Name
            </label>

            <input
                id="register-name"
                type="text"
                name="name"
                class="form-input"
                placeholder="Your name"
                autocomplete="name"
                required
            >

            <span
                class="form-error"
                data-error-for="name"
            ></span>

        </div>


        {{-- EMAIL --}}
        <div class="form-group">

            <label
                for="register-email"
                class="form-label"
            >
                Email address
            </label>

            <input
                id="register-email"
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


        {{-- PASSWORD --}}
        <div class="form-group">

            <label
                for="register-password"
                class="form-label"
            >
                Password
            </label>

            <div class="form-input-wrapper">

                <input
                    id="register-password"
                    type="password"
                    name="password"
                    class="form-input"
                    placeholder="Create a password"
                    autocomplete="new-password"
                    required
                >

                <button
                    type="button"
                    class="password-toggle"
                    data-password-toggle="register-password"
                    aria-label="Show password"
                >
                    ◉
                </button>

            </div>

            <span
                class="form-error"
                data-error-for="password"
            ></span>

        </div>


        {{-- CONFIRM PASSWORD --}}
        <div class="form-group">

            <label
                for="register-password-confirmation"
                class="form-label"
            >
                Confirm password
            </label>

            <input
                id="register-password-confirmation"
                type="password"
                name="password_confirmation"
                class="form-input"
                placeholder="Repeat your password"
                autocomplete="new-password"
                required
            >

            <span
                class="form-error"
                data-error-for="password_confirmation"
            ></span>

        </div>


        {{-- SUBMIT --}}
        <button
            type="submit"
            class="auth-button"
        >

            <span class="auth-button__text">
                Create account
            </span>

            <span
                class="auth-button__loader"
                aria-hidden="true"
            ></span>

        </button>


        {{-- LOGIN --}}
        <div class="auth-page-switch">

            Already have an account?

            <a
                href="/login"
                class="auth-link"
                data-auth-link="login"
            >
                Sign in
            </a>

        </div>

    </form>

</div>