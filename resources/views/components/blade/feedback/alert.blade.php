{{--
    <x-blade.feedback.alert type="success" :title="__('ui.settings.saved')">…</x-blade.feedback.alert>
--}}
@php
    $icons = [
        'success' => 'check',
        'error' => 'alert',
        'warning' => 'clock',
        'info' => 'info',
    ];
@endphp

<div {{ $attributes->class(['alert', "alert--{$type}"]) }} role="{{ $type === 'error' ? 'alert' : 'status' }}">
    <span class="alert__icon">
        <x-blade.u-i.icon :name="$icons[$type] ?? $icons['info']" size="20" />
    </span>

    <div class="alert__content">
        @if ($title)
            <strong class="alert__title">{{ $title }}</strong>
            <div class="alert__text">{{ $slot }}</div>
        @else
            {{ $slot }}
        @endif
    </div>

    @if ($dismissible)
        <button type="button" class="alert__close" data-alert-close aria-label="{{ __('ui.common.close') }}">
            <x-blade.u-i.icon name="x" size="16" />
        </button>
    @endif
</div>
