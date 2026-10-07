<!DOCTYPE html>
{{-- The games SPA's HTML shell: nothing but a root for React. All UI lives
     in resources/games/src. --}}
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="theme-color" content="#14161c">
    <title>{{ config('app.name', 'Laravel') }} · Games</title>

    @fonts
    @viteReactRefresh
    @vite('resources/games/src/main.tsx')
</head>

<body>
    <div id="games-root" data-app-name="{{ config('app.name', 'Laravel') }}" data-home-url="{{ route('dashboard') }}"></div>
</body>

</html>
