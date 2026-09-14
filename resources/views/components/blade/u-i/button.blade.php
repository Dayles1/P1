@php
    $classes = [
        'btn',
        "btn--{$variant}",
        "btn--{$size}",
    ];
@endphp

@if ($href)
    <a href="{{ $href }}" @class($classes) {{ $attributes }}>
        {{ $slot }}
    </a>
@else
    <button type="{{ $type }}" @class($classes) {{ $attributes }}>
        {{ $slot }}
    </button>
@endif
