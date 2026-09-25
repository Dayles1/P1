@extends('blade.layouts.auth')

@php
    /*
     * Every auth screen lives in this one view; auth-pages.js switches
     * between them without a reload. The server already knows which one
     * the URL asks for, so that page starts out active — nothing flashes
     * blank while the script loads. Each section carries its tab title
     * for the script to show when it switches to it.
     */
    $authPages = [
        'login' => __('ui.auth.login.title'),
        'login-code' => __('ui.auth.code.request_title'),
        'register' => __('ui.auth.register.title'),
        'forgot-password' => __('ui.auth.forgot.title'),
        'reset-password' => __('ui.auth.reset.title'),
        'verify-email' => __('ui.auth.verify.title'),
        'confirm-password' => __('ui.auth.confirm.title'),
    ];
@endphp

@section('title', $authPages[$currentPage] ?? __('ui.auth.page_title'))

@section('content')

<div
    class="auth-spa"
    id="auth-spa"
    data-current-page="{{ $currentPage }}"
    data-reset-token="{{ $resetToken ?? '' }}"
    data-reset-email="{{ $resetEmail ?? '' }}"
>
    <div class="auth-spa__viewport" id="auth-spa-viewport">
        @foreach ($authPages as $authPage => $authPageTitle)
            <section
                @class(['auth-page', 'is-active' => $authPage === $currentPage]) data-auth-page="{{ $authPage }}"
                data-auth-title="{{ $authPageTitle }} · {{ config('app.name', 'Laravel') }}"
            >
                @include('blade.pages.auth.partials.'.$authPage)
            </section>
        @endforeach
    </div>
</div>

@endsection
