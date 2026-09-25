{{--
    <x-blade.u-i.button>Save</x-blade.u-i.button>
    <x-blade.u-i.button variant="outline" icon="plus">Add</x-blade.u-i.button>
    <x-blade.u-i.button variant="ghost" icon="more" :label="__('ui.components.more')" />
    <x-blade.u-i.button :loading="true">Saving…</x-blade.u-i.button>
--}}
@php
    $iconOnly = $slot->isEmpty();
    $iconSize = ['sm' => 16, 'md' => 18, 'lg' => 20][$size] ?? 18;
    $classes = [
        'btn',
        "btn--{$variant}",
        "btn--{$size}",
        'btn--icon' => $iconOnly && $icon,
        'btn--block' => $block,
    ];
@endphp

@if ($href)
    <a
        href="{{ $href }}"
        {{ $attributes->class($classes) }}
        @if ($label) aria-label="{{ $label }}" @endif
    >
        @if ($icon)<x-blade.u-i.icon :name="$icon" :size="$iconSize" />@endif
        {{ $slot }}
    </a>
@else
    <button
        type="{{ $type }}"
        {{ $attributes->class($classes) }}
        @if ($label) aria-label="{{ $label }}" @endif
        @if ($loading) aria-busy="true" @endif
    >
        @if ($loading)
            <span class="spinner" aria-hidden="true"></span>
        @endif
        @if ($icon)<x-blade.u-i.icon :name="$icon" :size="$iconSize" />@endif
        {{ $slot }}
    </button>
@endif
