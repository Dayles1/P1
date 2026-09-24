<a
    href="{{ $href }}"
    @class([
        'sidebar-link',
        'sidebar-link--active' => $active,
    ])
    data-nav-link="sidebar-link"
    title="{{ trim(strip_tags($slot)) }}"
    @if ($active) aria-current="page" @endif
    {{ $attributes }}
>
    @if ($icon)
        <x-blade.u-i.icon :name="$icon" size="20" class="sidebar-link__icon" />
    @endif

    <span class="sidebar-link__label">{{ $slot }}</span>
</a>
