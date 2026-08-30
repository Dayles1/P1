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


    {{-- =====================================================
    THEME BOOTSTRAP
    ===================================================== --}}
    <script>
        (() => {
            const THEME_KEY = 'theme';

            const savedTheme =
                localStorage.getItem(THEME_KEY);

            if (
                savedTheme === 'light' ||
                savedTheme === 'dark'
            ) {
                document.documentElement.dataset.theme =
                    savedTheme;

                return;
            }

            const systemTheme =
                window.matchMedia(
                    '(prefers-color-scheme: dark)'
                ).matches
                    ? 'dark'
                    : 'light';

            document.documentElement.dataset.theme =
                systemTheme;
        })();
    </script>


    @vite([
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


                {{-- THEME TOGGLE --}}
                <button type="button" id="theme-toggle" class="theme-toggle" aria-label="Toggle theme"
                    title="Toggle theme">

                    <span class="theme-toggle__icon
                           theme-toggle__icon--sun" aria-hidden="true">
                        ☼
                    </span>

                    <span class="theme-toggle__icon
                           theme-toggle__icon--moon" aria-hidden="true">
                        ☾
                    </span>

                </button>

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