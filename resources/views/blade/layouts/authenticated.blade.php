@php($appVersion = collect(require base_path('resources/data/changelog.php'))->first()['version'] ?? '')
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="app-shell-html">

<head>
    <meta charset="UTF-8">

    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">

    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>
        @yield('title', config('app.name', 'Laravel'))
        · {{ config('app.name', 'Laravel') }}
    </title>

    @include('blade.sections.favicon')

    @include('blade.sections.theme-bootstrap')
    @include('blade.sections.i18n-bootstrap')

    @fonts
    @vite([
        'resources/css/blade/app/app.css',
        'resources/js/blade/app/authenticated.js',
    ])

    @stack('styles')
</head>


<body data-app-version="{{ $appVersion }}">
    @include('blade.sections.icons')

    {{--
        A real fixed-viewport application shell: <html>/<body> never
        scroll (app-shell-html, set above), so every scrollable region
        (sidebar, main content, and — on the chat page — each of its three
        panes) manages its own scroll independently instead of one giant
        page-level scrollbar growing with whatever the current page holds.
    --}}
    <div class="app-shell">

        {{-- SIDEBAR (hidden on phones — the tab bar below replaces it) --}}
        <aside class="app-sidebar" id="app-sidebar" data-turbo-permanent>
            @include('blade.sections.sidebar')
        </aside>

        <div class="app-shell__main">

            {{-- HEADER --}}
            @include('blade.sections.app-header')

            <main class="app-main" @if($fullBleed ?? false) data-full-bleed @endif>

                <div @class([
                    'app-main__inner',
                    'app-main__inner--narrow' => $narrow ?? false,
                    'app-main__inner--full-bleed' => $fullBleed ?? false,
                ])>

                    @unless ($fullBleed ?? false)
                        {{-- BREADCRUMBS --}}
                        @include('blade.sections.breadcrumbs')
                    @endunless

                    {{-- NOTIFICATIONS (toasts are position:fixed — safe even full-bleed) --}}
                    @include('blade.sections.notifications')

                    {{-- CURRENT PAGE --}}
                    @yield('content')

                </div>

            </main>

            {{-- BOTTOM TAB BAR (phones only) --}}
            @include('blade.sections.tabbar')

        </div>

    </div>

    {{--
        Read by shared/layout-controller.js on every Turbo navigation
        (before the swap happens) so it can apply this page's sidebar
        mode straight onto the permanent sidebar node — the same
        $sidebarMode/$secondarySidebar convention as $fullBleed/$narrow
        above, just also readable client-side since the sidebar itself
        is no longer re-rendered per page under Turbo Drive.
    --}}
    <script type="application/json" id="page-layout-config">{!! json_encode([
        'sidebar' => $sidebarMode ?? 'default',
        'secondarySidebar' => $secondarySidebar ?? null,
    ]) !!}</script>

    @include('blade.sections.scripts')

</body>

</html>
