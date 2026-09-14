@php
    $size ??= 'md';
@endphp

<span
    @class([
        'avatar',
        "avatar--{$size}",
    ])
    {{ $attributes }}
>
    @if ($src)
        <img src="{{ $src }}" alt="{{ $name }}" class="avatar__image">
    @else
        <span class="avatar__initials" aria-hidden="true">
            {{ $initials }}
        </span>
    @endif

    <span class="sr-only">{{ $name }}</span>
</span>
