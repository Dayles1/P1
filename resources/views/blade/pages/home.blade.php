@extends('blade.layouts.app')

@section('title', 'Home')

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
