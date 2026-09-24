@php
    $appName = config('app.name', 'Laravel');
    $brandLetter = mb_strtoupper(mb_substr($appName, 0, 1));
    $showcaseFeatures = [
        ['icon' => 'chat', 'title' => __('ui.auth.showcase.chat_title'), 'text' => __('ui.auth.showcase.chat_text')],
        ['icon' => 'shield', 'title' => __('ui.auth.showcase.sessions_title'), 'text' => __('ui.auth.showcase.sessions_text')],
        ['icon' => 'globe', 'title' => __('ui.auth.showcase.languages_title'), 'text' => __('ui.auth.showcase.languages_text')],
    ];
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="UTF-8">

    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">

    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>
        @yield('title', __('ui.auth.page_title'))
        · {{ $appName }}
    </title>

    @include('blade.sections.favicon')

    @include('blade.sections.theme-bootstrap')
    @include('blade.sections.i18n-bootstrap')

    {{--
        app.css brings the tokens and the shared components (fields,
        buttons, segmented control, alerts, the theme picker modal);
        auth.css is the two-pane frame, auth-pages.css the form column.
    --}}
    @fonts
    @vite([
        'resources/css/blade/app/app.css',
        'resources/css/blade/auth/auth.css',
        'resources/css/blade/auth/auth-pages.css',
        'resources/js/blade/auth/auth.js',
        'resources/js/blade/auth/auth-pages.js',
    ])

    @stack('styles')
</head>


<body class="auth-body">
    @include('blade.sections.icons')

    <div class="auth-layout">

        {{-- SHOWCASE (desktop only, ≥ 1200px) --}}
        <aside class="auth-showcase">
            <a href="{{ route('home') }}" class="auth-brand auth-brand--inverse">
                <span class="auth-brand__mark" aria-hidden="true">{{ $brandLetter }}</span>
                <span class="auth-brand__name">{{ $appName }}</span>
            </a>

            <div class="auth-showcase__body">
                {{-- Not a heading: the page's own h1 is the first one a screen reader meets. --}}
                <p class="auth-showcase__title">{{ __('ui.auth.showcase.title') }}</p>

                <ul class="auth-features">
                    @foreach ($showcaseFeatures as $feature)
                        <li class="auth-feature">
                            <span class="auth-feature__icon">
                                <x-blade.u-i.icon :name="$feature['icon']" size="20" />
                            </span>
                            <span class="auth-feature__text">
                                <span class="auth-feature__title">{{ $feature['title'] }}</span>
                                <span class="auth-feature__desc">{{ $feature['text'] }}</span>
                            </span>
                        </li>
                    @endforeach
                </ul>
            </div>

            <span class="auth-showcase__copyright">© {{ date('Y') }} {{ $appName }}</span>
        </aside>


        <main class="auth-main">

            {{-- TOPBAR: brand (below 1200px), language + theme --}}
            <header class="auth-topbar">
                <a href="{{ route('home') }}" class="auth-brand auth-topbar__brand">
                    <span class="auth-brand__mark" aria-hidden="true">{{ $brandLetter }}</span>
                    <span class="auth-brand__name">{{ $appName }}</span>
                </a>

                <div class="auth-topbar__actions">
                    {{-- Named by what they show (RU / UZ / EN); the full name is the tooltip. --}}
                    <div class="segmented segmented--inline auth-locale" role="group" aria-label="{{ __('ui.locale.label') }}">
                        @foreach (['ru', 'uz', 'en'] as $localeOption)
                            <button
                                type="button"
                                class="segmented__option auth-locale__option"
                                lang="{{ $localeOption }}"
                                title="{{ __('ui.locale.' . $localeOption) }}"
                                aria-pressed="{{ app()->getLocale() === $localeOption ? 'true' : 'false' }}"
                                data-locale-option="{{ $localeOption }}"
                            >{{ mb_strtoupper($localeOption) }}</button>
                        @endforeach
                    </div>

                    <button
                        type="button"
                        class="icon-btn auth-theme-toggle"
                        aria-label="{{ __('ui.auth.change_theme') }}"
                        title="{{ __('ui.auth.change_theme') }}"
                        data-theme-picker-trigger
                    >
                        <x-blade.u-i.icon name="moon" size="18" class="auth-theme-toggle__moon" />
                        <x-blade.u-i.icon name="sun" size="18" class="auth-theme-toggle__sun" />
                    </button>
                </div>
            </header>


            {{-- FORM COLUMN (a card on tablets) --}}
            <div class="auth-main__body">
                <div class="auth-panel">

                    @if ($errors->any())
                        <x-blade.feedback.alert type="error" :dismissible="false" :title="__('ui.common.check_following')" class="auth-panel__alert">
                            <ul>
                                @foreach ($errors->all() as $error)
                                    <li>{{ $error }}</li>
                                @endforeach
                            </ul>
                        </x-blade.feedback.alert>
                    @endif

                    @if (session('status'))
                        <x-blade.feedback.alert type="success" :dismissible="false" class="auth-panel__alert">
                            {{ session('status') }}
                        </x-blade.feedback.alert>
                    @endif

                    @yield('content')

                    @hasSection('footer')
                        <footer class="auth-footer">
                            @yield('footer')
                        </footer>
                    @endif

                </div>
            </div>

        </main>

    </div>


    @stack('scripts')

</body>

</html>
