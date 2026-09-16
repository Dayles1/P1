@extends('blade.layouts.auth')

@section('title', 'Authentication')

@section('content')

<div
    class="auth-spa"
    id="auth-spa"

    data-current-page="{{ $currentPage }}"

    data-reset-token="{{ $resetToken ?? '' }}"

    data-reset-email="{{ $resetEmail ?? '' }}"
>


    {{-- =====================================================
         PAGE VIEWPORT
         ===================================================== --}}

    <div
        class="auth-spa__viewport"
        id="auth-spa-viewport"
    >


        {{-- =================================================
             LOGIN
             ================================================= --}}

        <section
            class="auth-page"
            data-auth-page="login"
        >
            @include(
                'blade.pages.auth.partials.login'
            )
        </section>


        {{-- =================================================
             LOGIN WITH ONE-TIME CODE
             ================================================= --}}

        <section
            class="auth-page"
            data-auth-page="login-code"
        >
            @include(
                'blade.pages.auth.partials.login-code'
            )
        </section>


        {{-- =================================================
             REGISTER
             ================================================= --}}

        <section
            class="auth-page"
            data-auth-page="register"
        >
            @include(
                'blade.pages.auth.partials.register'
            )
        </section>


        {{-- =================================================
             FORGOT PASSWORD
             ================================================= --}}

        <section
            class="auth-page"
            data-auth-page="forgot-password"
        >
            @include(
                'blade.pages.auth.partials.forgot-password'
            )
        </section>


        {{-- =================================================
             RESET PASSWORD
             ================================================= --}}

        <section
            class="auth-page"
            data-auth-page="reset-password"
        >
            @include(
                'blade.pages.auth.partials.reset-password'
            )
        </section>


        {{-- =================================================
             VERIFY EMAIL
             ================================================= --}}

        <section
            class="auth-page"
            data-auth-page="verify-email"
        >
            @include(
                'blade.pages.auth.partials.verify-email'
            )
        </section>


        {{-- =================================================
             CONFIRM PASSWORD
             ================================================= --}}

        <section
            class="auth-page"
            data-auth-page="confirm-password"
        >
            @include(
                'blade.pages.auth.partials.confirm-password'
            )
        </section>

    </div>

</div>

@endsection