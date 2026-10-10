<!DOCTYPE html>
{{-- The Sandbox's HTML shell: a root for the game. Everything else lives
     in app/Games/Sandbox/client. --}}
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="theme-color" content="#121518">
    <title>{{ config('app.name', 'Laravel') }} · Sandbox</title>

    {{-- The «Кремень» type: Unbounded for headings and numbers, Golos for text, JetBrains Mono for keys. --}}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&family=JetBrains+Mono:wght@700&family=Unbounded:wght@600;700;800&display=swap">

    @vite('app/Games/Sandbox/client/main.ts')
</head>

<body>
    <div id="sandbox-root" data-back-url="{{ url(config('sandbox.back_url')) }}" @if (config('sandbox.creative')) data-creative @endif></div>
    {{-- The hero rules (config/heroes.php), the same ones the server checks saves against. --}}
    <script type="application/json" id="sandbox-heroes">@json(config('sandbox.heroes'))</script>
</body>

</html>
