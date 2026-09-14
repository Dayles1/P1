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

            {{-- THEME PICKER --}}
            <x-blade.u-i.dropdown align="right">
                <x-slot:trigger>
                    <span class="icon-btn" aria-label="{{ __('ui.theme.label') }}" title="{{ __('ui.theme.label') }}">
                        ◐
                    </span>
                </x-slot:trigger>

                <div class="dropdown__label">{{ __('ui.theme.label') }}</div>

                @foreach (['system', 'light', 'gray', 'dark', 'black', 'green', 'orange'] as $themeOption)
                    <button
                        type="button"
                        class="dropdown__item dropdown__item--picker"
                        role="menuitemradio"
                        data-theme-option="{{ $themeOption }}"
                    >
                        <span><span class="theme-swatch theme-swatch--{{ $themeOption }}"></span>{{ __('ui.theme.' . $themeOption) }}</span>
                        <span class="dropdown__check" aria-hidden="true">✓</span>
                    </button>
                @endforeach
            </x-blade.u-i.dropdown>

            {{-- LANGUAGE PICKER --}}
            <x-blade.u-i.dropdown align="right">
                <x-slot:trigger>
                    <span class="icon-btn" aria-label="{{ __('ui.locale.label') }}" title="{{ __('ui.locale.label') }}">
                        {{ strtoupper(app()->getLocale()) }}
                    </span>
                </x-slot:trigger>

                <div class="dropdown__label">{{ __('ui.locale.label') }}</div>

                @foreach (['en', 'ru', 'uz'] as $localeOption)
                    <button
                        type="button"
                        class="dropdown__item dropdown__item--picker"
                        role="menuitemradio"
                        data-locale-option="{{ $localeOption }}"
                    >
                        <span>{{ __('ui.locale.' . $localeOption) }}</span>
                        <span class="dropdown__check" aria-hidden="true">✓</span>
                    </button>
                @endforeach
            </x-blade.u-i.dropdown>


            {{-- =====================================================
                 AUTH STATE
                 -----------------------------------------------------
                 There is no server session for API logins here (auth
                 is a Sanctum bearer token only), so which of these two
                 blocks is shown is decided entirely client-side by
                 app.js after it asks GET /api/auth/me — never assume
                 login state from Blade.
                 ===================================================== --}}

            {{-- GUEST ACTIONS --}}
            <div class="site-header__guest" data-auth-guest hidden>
                <x-blade.u-i.button variant="ghost" size="sm" :href="route('login')">
                    {{ __('ui.nav.log_in') }}
                </x-blade.u-i.button>

                <x-blade.u-i.button variant="primary" size="sm" :href="route('register')">
                    {{ __('ui.nav.get_started') }}
                </x-blade.u-i.button>
            </div>

            {{-- USER MENU --}}
            <div class="site-header__user" data-auth-user hidden>
                <x-blade.u-i.dropdown align="right">
                    <x-slot:trigger>
                        <span class="avatar avatar--sm" data-user-avatar>
                            <span class="avatar__initials" data-user-initials aria-hidden="true">--</span>
                        </span>
                    </x-slot:trigger>

                    <div class="dropdown__label" data-user-name>&nbsp;</div>

                    <a href="{{ route('dashboard') }}" class="dropdown__item" role="menuitem">
                        {{ __('ui.nav.dashboard') }}
                    </a>

                    <a href="{{ route('profile') }}" class="dropdown__item" role="menuitem">
                        {{ __('ui.nav.profile') }}
                    </a>

                    <a href="{{ route('sessions') }}" class="dropdown__item" role="menuitem">
                        {{ __('ui.nav.sessions') }}
                    </a>

                    <a href="{{ route('settings') }}" class="dropdown__item" role="menuitem">
                        {{ __('ui.nav.settings') }}
                    </a>

                    <a
                        href="{{ route('admin.settings') }}"
                        class="dropdown__item"
                        role="menuitem"
                        data-requires-role="SUPER_ADMIN,ADMIN"
                        hidden
                    >
                        {{ __('ui.nav.admin') }}
                    </a>

                    <button type="button" class="dropdown__item dropdown__item--danger" data-logout role="menuitem">
                        {{ __('ui.nav.log_out') }}
                    </button>
                </x-blade.u-i.dropdown>
            </div>


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
