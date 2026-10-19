<!DOCTYPE html>
{{-- "Летопись города 3"'s HTML shell: a root for the game. Everything else
     lives in app/Games/City3/client. --}}
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="theme-color" content="#1b2448">
    <title>Летопись города 3</title>

    {{-- Geologica, the game's one family (ui-spec §3.3): Cyrillic-native, variable weight
         and the SHRP axis for the minted numerals; the plain request is the fallback. --}}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geologica:wght@400..800&display=swap">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geologica:wght,SHRP@400..800,0..100&display=swap">

    @viteReactRefresh
    @vite('app/Games/City3/client/main.tsx')
</head>

<body>
    <div id="city3-root" data-back-url="{{ url(config('city3.back_url')) }}"></div>
</body>

</html>
