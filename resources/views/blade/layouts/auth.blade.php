<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="UTF-8">

    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>
        @yield('title', 'Authentication')
        · {{ config('app.name', 'Laravel') }}
    </title>


    @include('blade.sections.theme-bootstrap')
    @include('blade.sections.i18n-bootstrap')


    {{--
        app.css supplies the shared `--ui-*` design tokens (all themes) and
        generic components (icon buttons, dropdown, modal, theme picker) the
        theme/language pickers below need — auth.css/auth-pages.css layer
        the auth-specific showcase/card/form styling on top; the two share
        no class names, so there's nothing to reconcile.
    --}}
    @vite([
        'resources/css/blade/app/app.css',
        'resources/css/blade/auth/auth.css',
        'resources/css/blade/auth/auth-pages.css',
        'resources/js/blade/auth/auth.js',
        'resources/js/blade/auth/auth-pages.js',
    ])

    @stack('styles')
</head>


<body>

    <div class="auth-layout">

        {{-- =====================================================
        LEFT SIDE
        ===================================================== --}}
        <aside class="auth-showcase">

            <div class="auth-showcase__glow
                   auth-showcase__glow--one"></div>

            <div class="auth-showcase__glow
                   auth-showcase__glow--two"></div>


            <div class="auth-showcase__content">

                {{-- LOGO --}}
                <a href="{{ route('home') }}" class="auth-logo">
                    <span class="auth-logo__mark">
                        {{ strtoupper(substr(config('app.name', 'L'), 0, 1)) }}
                    </span>

                    <span class="auth-logo__name">
                        {{ config('app.name', 'Laravel') }}
                    </span>
                </a>


                {{-- MESSAGE --}}
                <div class="auth-showcase__message">

                    <span class="auth-showcase__badge">
                        <span class="auth-showcase__badge-dot"></span>
                        Secure workspace
                    </span>

                    <h1>
                        Everything you need,
                        <span>in one place.</span>
                    </h1>

                    <p>
                        A secure and simple way to manage your account,
                        projects and personal workspace.
                    </p>

                </div>


                {{-- BOTTOM --}}
                <div class="auth-showcase__bottom">

                    <div class="auth-security">

                        <span class="auth-security__icon">
                            ✓
                        </span>

                        <span>
                            Your data is protected
                        </span>

                    </div>

                    <span class="auth-copyright">
                        © {{ date('Y') }}
                        {{ config('app.name', 'Laravel') }}
                    </span>

                </div>

            </div>

        </aside>


        {{-- =====================================================
        RIGHT SIDE
        ===================================================== --}}
        <main class="auth-main">

            {{-- TOPBAR --}}
            <header class="auth-topbar">

                {{-- Mobile logo --}}
                <a href="{{ route('home') }}" class="auth-mobile-logo">
                    <span class="auth-logo__mark">
                        {{ strtoupper(substr(config('app.name', 'L'), 0, 1)) }}
                    </span>

                    <span class="auth-logo__name">
                        {{ config('app.name', 'Laravel') }}
                    </span>
                </a>


                <div class="auth-topbar__actions">

                    {{-- THEME PICKER --}}
                    <button
                        type="button"
                        class="icon-btn"
                        aria-label="{{ __('ui.theme.label') }}"
                        title="{{ __('ui.theme.label') }}"
                        data-theme-picker-trigger
                    >
                        ◐
                    </button>

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

                </div>

            </header>


            {{-- CONTENT --}}
            <div class="auth-main__scroll">

                <div class="auth-main__content">

                    <div class="auth-container">

                        {{-- VALIDATION ERRORS --}}
                        @if ($errors->any())

                            <div class="auth-alert auth-alert--error">

                                <div class="auth-alert__icon">
                                    !
                                </div>

                                <div class="auth-alert__content">

                                    <strong>
                                        Please check the following:
                                    </strong>

                                    <ul>
                                        @foreach ($errors->all() as $error)
                                            <li>
                                                {{ $error }}
                                            </li>
                                        @endforeach
                                    </ul>

                                </div>

                            </div>

                        @endif


                        {{-- SESSION STATUS --}}
                        @if (session('status'))

                            <div class="auth-alert auth-alert--success">

                                <div class="auth-alert__icon">
                                    ✓
                                </div>

                                <div class="auth-alert__content">
                                    {{ session('status') }}
                                </div>

                            </div>

                        @endif


                        {{-- CURRENT PAGE --}}
                        @yield('content')


                        {{-- FOOTER --}}
                        @hasSection('footer')

                            <footer class="auth-footer">
                                @yield('footer')
                            </footer>

                        @endif

                    </div>

                </div>

            </div>

        </main>

    </div>


    @stack('scripts')

</body>

</html>