{{-- =====================================================
     SITE HEADER
     ===================================================== --}}

<header class="site-header" data-site-header>

    <div class="site-header__inner">

        {{-- LOGO --}}
        <a href="{{ route('home') }}" class="site-logo">
            <span class="site-logo__mark">
                {{ strtoupper(substr(config('app.name', 'L'), 0, 1)) }}
            </span>

            <span class="site-logo__name">
                {{ config('app.name', 'Laravel') }}
            </span>
        </a>


        {{-- PRIMARY NAV (desktop) --}}
        @include('blade.sections.navbar')


        {{-- RIGHT SIDE --}}
        <div class="site-header__actions">

            {{-- THEME TOGGLE --}}
            <button
                type="button"
                id="theme-toggle"
                class="theme-toggle"
                aria-label="Toggle theme"
                title="Toggle theme"
            >
                <span class="theme-toggle__icon theme-toggle__icon--sun" aria-hidden="true">☼</span>
                <span class="theme-toggle__icon theme-toggle__icon--moon" aria-hidden="true">☾</span>
            </button>


            @auth
                {{-- USER MENU --}}
                <x-blade.u-i.dropdown align="right">
                    <x-slot:trigger>
                        <x-blade.u-i.avatar :name="auth()->user()->name" size="sm" />
                    </x-slot:trigger>

                    <a href="{{ route('home') }}" class="dropdown__item" role="menuitem">
                        Profile
                    </a>

                    <button type="button" class="dropdown__item dropdown__item--danger" data-logout role="menuitem">
                        Log out
                    </button>
                </x-blade.u-i.dropdown>
            @else
                {{-- GUEST ACTIONS --}}
                <x-blade.u-i.button variant="ghost" size="sm" :href="route('login')">
                    Log in
                </x-blade.u-i.button>

                <x-blade.u-i.button variant="primary" size="sm" :href="route('register')">
                    Get started
                </x-blade.u-i.button>
            @endauth


            {{-- MOBILE MENU TOGGLE --}}
            <button
                type="button"
                class="site-header__burger"
                data-nav-toggle
                aria-label="Toggle menu"
                aria-expanded="false"
                aria-controls="site-mobile-nav"
            >
                <span></span>
                <span></span>
                <span></span>
            </button>

        </div>

    </div>


    {{-- PRIMARY NAV (mobile) --}}
    <div class="site-mobile-nav" id="site-mobile-nav" data-mobile-nav hidden>
        @include('blade.sections.navbar')
    </div>

</header>
