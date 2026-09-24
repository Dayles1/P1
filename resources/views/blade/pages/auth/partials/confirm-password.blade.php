<div class="auth-card">

    <div class="auth-card__header">

        <h1>
            Confirm your password
        </h1>

        <p>
            This is a sensitive action. Please confirm your
            password before continuing.
        </p>

    </div>


    <form
        class="auth-form"
        data-auth-form="confirm-password"
        novalidate
    >

        @csrf


        {{-- PASSWORD --}}
        <div class="field-group">

            <label
                for="confirm-password-password"
                class="field-label"
            >
                Password
            </label>

            <div class="field-control">

                <input
                    id="confirm-password-password"
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
                    data-password-toggle="confirm-password-password"
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


        {{-- SUBMIT --}}
        <button
            type="submit"
            class="auth-button"
        >

            <span class="auth-button__text">
                Confirm
            </span>

            <span
                class="auth-button__loader"
                aria-hidden="true"
            ></span>

        </button>

    </form>


    <div class="auth-page-switch">

        <a
            href="/login"
            class="auth-link"
            data-auth-link="login"
        >
            Back to sign in
        </a>

    </div>

</div>