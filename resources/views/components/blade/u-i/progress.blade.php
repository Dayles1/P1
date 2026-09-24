{{--
    <x-blade.u-i.progress :value="64" :label="__('…')" />
    <x-blade.u-i.progress :value="86" variant="warning" :label="…" />
    variant: primary (default) | success | warning | danger. `thin` = 4px.
--}}
@props(['value' => 0, 'max' => 100, 'label' => null, 'variant' => null, 'thin' => false, 'showValue' => true])

@php($percent = $max > 0 ? (int) round($value / $max * 100) : 0)

<div {{ $attributes->class(['progress', "progress--{$variant}" => $variant, 'progress--thin' => $thin]) }}>
    @if ($label || $showValue)
        <div class="progress__head">
            @if ($label)
                <span class="progress__label">{{ $label }}</span>
            @endif
            @if ($showValue)
                <span class="progress__value">{{ $percent }}%</span>
            @endif
        </div>
    @endif

    <progress class="progress__bar" value="{{ $value }}" max="{{ $max }}" @if ($label) aria-label="{{ $label }}" @endif>{{ $percent }}%</progress>
</div>
