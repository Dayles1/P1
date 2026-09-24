{{--
    <x-blade.u-i.empty-state icon="search" :title="__('ui.components.empty_title')" :hint="…">
        <x-slot:actions><x-blade.u-i.button variant="outline" size="sm">…</x-blade.u-i.button></x-slot:actions>
    </x-blade.u-i.empty-state>
--}}
@props(['title' => null, 'hint' => null, 'icon' => null, 'plain' => false])

<div {{ $attributes->class(['empty-state', 'empty-state--plain' => $plain]) }}>
    @if ($icon)
        <span class="empty-state__icon"><x-blade.u-i.icon :name="$icon" size="20" /></span>
    @endif

    <strong class="empty-state__title">{{ $title ?? __('ui.components.empty_title') }}</strong>

    @if ($hint)
        <span>{{ $hint }}</span>
    @endif

    @isset($actions)
        <div class="empty-state__actions">{{ $actions }}</div>
    @endisset
</div>
