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
        <div class="field-group">

            <label
                for="reset-email"
                class="field-label"
            >
                Email address
            </label>

            <input
                id="reset-email"
                type="email"
                name="email"
                class="field-input"
                placeholder="you@example.com"
                autocomplete="email"
                value="{{ $resetEmail ?? '' }}"
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
                for="reset-password"
                class="field-label"
            >
                New password
            </label>

            <div class="field-control">

                <input
                    id="reset-password"
                    type="password"
                    name="password"
                    class="field-input"
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
                    <x-blade.u-i.icon name="eye" size="18" />
                </button>

            </div>

            <span
                class="field-error"
                data-field-error="password"
            ></span>

        </div>


        {{-- CONFIRM --}}
        <div class="field-group">

            <label
                for="reset-password-confirmation"
                class="field-label"
            >
                Confirm password
            </label>

            <input
                id="reset-password-confirmation"
                type="password"
                name="password_confirmation"
                class="field-input"
                placeholder="Repeat your new password"
                autocomplete="new-password"
                required
            >

            <span
                class="field-error"
                data-field-error="password_confirmation"
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