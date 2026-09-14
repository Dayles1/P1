@php
    $icons = [
        'success' => '✓',
        'error' => '!',
        'warning' => '!',
        'info' => 'i',
    ];
@endphp

<div
    @class([
        'alert',
        "alert--{$type}",
    ])
    role="alert"
    {{ $attributes }}
>

    <span class="alert__icon" aria-hidden="true">
        {{ $icons[$type] ?? $icons['info'] }}
    </span>

    <div class="alert__content">
        {{ $slot }}
    </div>

    @if ($dismissible)
        <button
            type="button"
            class="alert__close"
            data-alert-close
            aria-label="Dismiss"
        >
            &times;
        </button>
    @endif

</div>
