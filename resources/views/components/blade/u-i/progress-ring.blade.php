{{--
    <x-blade.u-i.progress-ring :value="86" variant="warning" :label="__('…')" />
    The arc is an SVG circle; its dash offset is computed here, not styled.
--}}
@props(['value' => 0, 'max' => 100, 'label' => null, 'variant' => null])

@php
    $percent = $max > 0 ? max(0, min(100, (int) round($value / $max * 100))) : 0;
    $radius = 30;
    $circumference = 2 * M_PI * $radius;
    $offset = $circumference * (1 - $percent / 100);
@endphp

<div {{ $attributes->class(['progress-ring', "progress-ring--{$variant}" => $variant]) }} role="img" aria-label="{{ $label ? "{$label}: {$percent}%" : "{$percent}%" }}">
    <span class="progress-ring__svg">
        <svg viewBox="0 0 68 68" width="68" height="68" aria-hidden="true">
            <circle class="progress-ring__track" cx="34" cy="34" r="{{ $radius }}" fill="none" stroke-width="6" />
            <circle
                class="progress-ring__fill"
                cx="34"
                cy="34"
                r="{{ $radius }}"
                fill="none"
                stroke-width="6"
                stroke-dasharray="{{ round($circumference, 2) }}"
                stroke-dashoffset="{{ round($offset, 2) }}"
            />
        </svg>
        <span class="progress-ring__value">{{ $percent }}%</span>
    </span>

    @if ($label)
        <span>{{ $label }}</span>
    @endif
</div>
