{{--
    One symbol from the sprite (resources/svg/icons.svg, inlined by
    blade.sections.icons). Decorative by default; pass `label` when the
    icon is the only thing that says what a control does.

    <x-blade.u-i.icon name="bell" />
    <x-blade.u-i.icon name="chat" size="16" class="muted" />
--}}
@props(['name', 'size' => 20, 'label' => null])

<svg {{ $attributes->class(['icon']) }} width="{{ $size }}" height="{{ $size }}"
     @if ($label) role="img" aria-label="{{ $label }}" @else aria-hidden="true" @endif>
    <use href="#i-{{ $name }}"></use>
</svg>
