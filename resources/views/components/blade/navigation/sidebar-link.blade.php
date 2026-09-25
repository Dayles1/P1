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
        <x-blade.u-i.icon :name="$icon" size="16" class="sidebar-link__icon" />
    @endif

    <span class="sidebar-link__label">{{ $slot }}</span>

    @if ($countKey === 'notifications')
        {{-- Kept in step with the bell by shared/notification-bell.js. --}}
        <span class="mono sidebar-link__count" data-notif-badge data-notif-badge-count hidden></span>
    @elseif ($countKey)
        <span class="mono sidebar-link__count" data-sidebar-count="{{ $countKey }}" hidden></span>
    @endif

    @if ($keys)
        <span class="kbd-group sidebar-link__keys" aria-hidden="true">
            @foreach (explode(' ', $keys) as $key)
                <kbd class="kbd">{{ $key }}</kbd>
            @endforeach
        </span>
    @endif
</a>
