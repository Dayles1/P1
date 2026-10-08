<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="UTF-8">

    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>
        @yield('title', config('app.name', 'Laravel'))
        @hasSection('title')
            · {{ config('app.name', 'Laravel') }}
        @endif
    </title>

    @include('blade.sections.favicon')

    {{-- Inline scripts a page needs before its first paint. --}}
    @stack('head')

    @include('blade.sections.theme-bootstrap')
    @include('blade.sections.i18n-bootstrap')

    @fonts
    @vite([
        'resources/css/blade/app/app.css',
        'resources/js/blade/app/app.js',
    ])

    @stack('styles')
</head>


<body>
    @include('blade.sections.icons')

    <div class="site-layout">

        {{-- =====================================================
        HEADER
        ===================================================== --}}
        @include('blade.sections.header')


        {{-- =====================================================
        MAIN
        ===================================================== --}}
        <main class="site-main">

            <div class="site-main__inner">

                {{-- BREADCRUMBS --}}
                @include('blade.sections.breadcrumbs')


                {{-- NOTIFICATIONS --}}
                @include('blade.sections.notifications')


                {{-- CURRENT PAGE --}}
                @yield('content')

            </div>

        </main>


        {{-- =====================================================
        FOOTER
        ===================================================== --}}
        @include('blade.sections.footer')

    </div>


    @include('blade.sections.scripts')

</body>

</html>
