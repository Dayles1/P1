<div class="auth-card">

    <div class="auth-card__header">

        <h1>
            Reset your password
        </h1>

        <p>
            Create a new password for your account.
        </p>

    </div>


    <form
        class="auth-form"
        data-auth-form="reset-password"
        novalidate
    >

        @csrf


        {{-- EMAIL --}}
        <div class="form-group">

            <label
                for="reset-email"
                class="form-label"
            >
                Email address
            </label>

            <input
                id="reset-email"
                type="email"
                name="email"
                class="form-input"
                placeholder="you@example.com"
                autocomplete="email"
                value="{{ $resetEmail ?? '' }}"
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
                for="reset-password"
                class="form-label"
            >
                New password
            </label>

            <div class="form-input-wrapper">

                <input
                    id="reset-password"
                    type="password"
                    name="password"
                    class="form-input"
                    placeholder="Create a new password"
                    autocomplete="new-password"
                    required
                >

                <button
                    type="button"
                    class="password-toggle"
                    data-password-toggle="reset-password"
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


        {{-- CONFIRM --}}
        <div class="form-group">

            <label
                for="reset-password-confirmation"
                class="form-label"
            >
                Confirm password
            </label>

            <input
                id="reset-password-confirmation"
                type="password"
                name="password_confirmation"
                class="form-input"
                placeholder="Repeat your new password"
                autocomplete="new-password"
                required
            >

            <span
                class="form-error"
                data-error-for="password_confirmation"
            ></span>

        </div>


        <button
            type="submit"
            class="auth-button"
        >

            <span class="auth-button__text">
                Reset password
            </span>

            <span
                class="auth-button__loader"
                aria-hidden="true"
            ></span>

        </button>

    </form>

</div>