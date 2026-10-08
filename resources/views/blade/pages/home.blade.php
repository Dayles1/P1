@extends('blade.layouts.app')

@section('title', 'Home')

{{-- Someone already signed in has no business on the landing page: off
     to the dashboard before it paints. Only the token's presence is
     checked — a stale one is caught by the dashboard, which drops it and
     sends them to /login, so this cannot loop. --}}
@push('head')
    <script>
        (() => {
            try {
                if (localStorage.getItem('auth_token')) {
                    window.location.replace(@json(route('dashboard', absolute: false)));
                }
            } catch {
                // No storage (private mode, blocked): stay on the landing page.
            }
        })();
    </script>
@endpush

@section('content')

    <section class="hero">

        <span class="hero__badge">
            <span class="hero__badge-dot"></span>
            Now live
        </span>

        <h1 class="hero__title">
            Everything you need,
            <span>in one place.</span>
        </h1>

        <p class="hero__subtitle">
            A secure and simple way to manage your account, projects and personal workspace.
        </p>

        <div class="hero__actions">
            @guest
                <x-blade.u-i.button variant="primary" size="lg" :href="route('register')">
                    Get started
                </x-blade.u-i.button>

                <x-blade.u-i.button variant="outline" size="lg" :href="route('login')">
                    Sign in
                </x-blade.u-i.button>
            @else
                <x-blade.u-i.button variant="primary" size="lg" href="/">
                    Go to dashboard
                </x-blade.u-i.button>
            @endguest
        </div>

    </section>

@endsection
