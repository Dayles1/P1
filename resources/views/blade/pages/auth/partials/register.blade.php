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
        <div class="field-group">

            <label
                for="register-name"
                class="field-label"
            >
                Name
            </label>

            <input
                id="register-name"
                type="text"
                name="name"
                class="field-input"
                placeholder="Your name"
                autocomplete="name"
                required
            >

            <span
                class="field-error"
                data-field-error="name"
            ></span>

        </div>


        {{-- EMAIL --}}
        <div class="field-group">

            <label
                for="register-email"
                class="field-label"
            >
                Email address
            </label>

            <input
                id="register-email"
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
                for="register-password"
                class="field-label"
            >
                Password
            </label>

            <div class="field-control">

                <input
                    id="register-password"
                    type="password"
                    name="password"
                    class="field-input"
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
                    <x-blade.u-i.icon name="eye" size="18" />
                </button>

            </div>

            <span
                class="field-error"
                data-field-error="password"
            ></span>

        </div>


        {{-- CONFIRM PASSWORD --}}
        <div class="field-group">

            <label
                for="register-password-confirmation"
                class="field-label"
            >
                Confirm password
            </label>

            <input
                id="register-password-confirmation"
                type="password"
                name="password_confirmation"
                class="field-input"
                placeholder="Repeat your password"
                autocomplete="new-password"
                required
            >

            <span
                class="field-error"
                data-field-error="password_confirmation"
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