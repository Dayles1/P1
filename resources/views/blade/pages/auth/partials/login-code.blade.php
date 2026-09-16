<div class="auth-card">

    <div data-auth-step="request">

        <div class="auth-card__header">
            <h1>Login with one-time code</h1>
            <p>We'll email you a 6-digit code — no password needed.</p>
        </div>

        <form class="auth-form" data-auth-form="login-code-request" novalidate>

            @csrf

            <div class="form-group">
                <label for="login-code-email" class="form-label">Email address</label>

                <input
                    id="login-code-email"
                    type="email"
                    name="email"
                    class="form-input"
                    placeholder="you@example.com"
                    autocomplete="email"
                    required
                >

                <span class="form-error" data-error-for="email"></span>
            </div>

            <button type="submit" class="auth-button">
                <span class="auth-button__text">Send login code</span>
                <span class="auth-button__loader" aria-hidden="true"></span>
            </button>

            <div class="auth-page-switch">
                <a href="/login" class="auth-link" data-auth-link="login">Login with password instead</a>
            </div>

        </form>

    </div>


    <div data-auth-step="verify" hidden>

        <div class="auth-card__header">
            <h1>Enter your code</h1>
            <p>Enter the 6-digit code we sent to your email.</p>
        </div>

        <form class="auth-form" data-auth-form="login-code-verify" novalidate>

            @include('blade.pages.auth.partials._code-input')

            <span class="form-error" data-error-for="code" style="text-align:center;"></span>

            <button type="submit" class="auth-button">
                <span class="auth-button__text">Sign in</span>
                <span class="auth-button__loader" aria-hidden="true"></span>
            </button>

            <div class="auth-page-switch">
                <button type="button" class="auth-link" data-resend-code>Resend code</button>
            </div>

            <div class="auth-page-switch">
                <button type="button" class="auth-step-back" data-back-to-request>&larr; Use a different email</button>
            </div>

        </form>

    </div>

</div>
