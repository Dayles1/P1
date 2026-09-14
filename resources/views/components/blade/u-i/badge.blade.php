@php
    $allowed = ['muted', 'primary', 'success', 'danger', 'warning', 'info'];
    $variant = in_array($variant, $allowed, true) ? $variant : 'muted';
@endphp

<span {{ $attributes->class(['pill', "pill--{$variant}"]) }}>
    {{ $slot }}
</span>
