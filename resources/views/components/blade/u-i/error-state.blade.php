{{--
    <x-blade.u-i.error-state :hint="…" data-retry-target="sessions" />
    The Retry button carries [data-retry]; the page wires it.
--}}
@props(['title' => null, 'hint' => null, 'retryLabel' => null])

<div {{ $attributes->class(['error-state']) }} role="alert">
    <span class="error-state__icon"><x-blade.u-i.icon name="alert" size="24" /></span>

    <strong class="error-state__title">{{ $title ?? __('ui.components.error_title') }}</strong>

    @if ($hint)
        <span>{{ $hint }}</span>
    @endif

    <div class="error-state__actions">
        <x-blade.u-i.button variant="outline" size="sm" icon="refresh" data-retry>
            {{ $retryLabel ?? __('ui.components.retry') }}
        </x-blade.u-i.button>
    </div>
</div>
