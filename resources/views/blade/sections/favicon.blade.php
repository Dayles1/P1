@php
    $__faviconUrl = app(\App\Domain\Setting\Services\SettingService::class)
        ->string('system.favicon', \App\Domain\Setting\Actions\StoreFavicon::DEFAULT_PATH);

    $__faviconType = match (strtolower(pathinfo($__faviconUrl, PATHINFO_EXTENSION))) {
        'svg' => 'image/svg+xml',
        'png' => 'image/png',
        default => 'image/x-icon',
    };
@endphp
<link rel="icon" href="{{ $__faviconUrl }}" type="{{ $__faviconType }}">
