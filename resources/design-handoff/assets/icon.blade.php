{{-- resources/views/components/blade/u-i/icon.blade.php
     Использование: <x-blade.u-i.icon name="bell" />  <x-blade.u-i.icon name="chat" size="16" class="text-muted" />
     Спрайт resources/svg/icons.svg подключается один раз в layout: @include('blade.sections.icons') --}}
@props(['name', 'size' => 20, 'label' => null])
<svg {{ $attributes->class(['icon']) }} width="{{ $size }}" height="{{ $size }}"
     @if ($label) role="img" aria-label="{{ $label }}" @else aria-hidden="true" @endif>
    <use href="#i-{{ $name }}"></use>
</svg>
