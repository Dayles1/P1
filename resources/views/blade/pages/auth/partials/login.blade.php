<div class="auth-card">

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
        <div class="form-group">

            <label
                for="login-email"
                class="form-label"
            >
                Email address
            </label>

            <input
                id="login-email"
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
                for="login-password"
                class="form-label"
            >
                Password
            </label>


            <div class="form-input-wrapper">

                <input
                    id="login-password"
                    type="password"
                    name="password"
                    class="form-input"
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
                    ◉
                </button>

            </div>


            <span
                class="form-error"
                data-error-for="password"
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