<a
    href="{{ $href }}"
    @class([
        'sidebar-link',
        'sidebar-link--active' => $active,
    ])
    @if ($active) aria-current="page" @endif
    {{ $attributes }}
>
    @if ($icon)
        <span class="sidebar-link__icon" aria-hidden="true">{!! $icon !!}</span>
    @endif

    <span>{{ $slot }}</span>
</a>
