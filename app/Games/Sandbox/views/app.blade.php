<!DOCTYPE html>
{{-- The Sandbox's HTML shell: a root for the game. Everything else lives
     in app/Games/Sandbox/client. --}}
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="theme-color" content="#cfd6dc">
    <title>{{ config('app.name', 'Laravel') }} · Sandbox</title>

    @vite('app/Games/Sandbox/client/main.ts')
</head>

<body>
    <div id="sandbox-root" data-back-url="{{ url(config('sandbox.back_url')) }}"></div>
    {{-- The hero rules (config/heroes.php), the same ones the server checks saves against. --}}
    <script type="application/json" id="sandbox-heroes">@json(config('sandbox.heroes'))</script>
</body>

</html>
