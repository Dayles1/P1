<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="UTF-8">

    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>
        @yield('title', config('app.name', 'Laravel'))
        · {{ config('app.name', 'Laravel') }}
    </title>

    @include('blade.sections.favicon')

    @include('blade.sections.theme-bootstrap')
    @include('blade.sections.i18n-bootstrap')


    @vite([
        'resources/css/app.css',
        'resources/css/blade/app/app.css',
        'resources/js/blade/app/authenticated.js',
    ])

    @stack('styles')
</head>


<body>

    <div class="site-layout">

        {{-- =====================================================
        HEADER
        ===================================================== --}}
        @include('blade.sections.header')


        {{-- =====================================================
        SHELL (sidebar + content)
        ===================================================== --}}
        <div class="app-shell">

            <aside class="app-sidebar">
                @include('blade.sections.sidebar')
            </aside>

            <main class="app-content">

                <div @class(['app-content__inner', 'app-content__inner--wide' => $wide ?? false])>

                    {{-- BREADCRUMBS --}}
                    @include('blade.sections.breadcrumbs')


                    {{-- NOTIFICATIONS --}}
                    @include('blade.sections.notifications')


                    {{-- CURRENT PAGE --}}
                    @yield('content')

                </div>

            </main>

        </div>

    </div>


    @include('blade.sections.scripts')

</body>

</html>
