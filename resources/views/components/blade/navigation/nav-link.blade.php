<a
    href="{{ $href }}"
    @class([
        'nav-link',
        'nav-link--active' => $active,
    ])
    @if ($active) aria-current="page" @endif
    {{ $attributes }}
>
    {{ $slot }}
</a>
