{{--
    Filter chip (a toggle):   <x-blade.u-i.chip :pressed="$active" data-filter="expired">{{ … }}</x-blade.u-i.chip>
    Picked value with remove: <x-blade.u-i.chip removable :remove-label="…">Alisher Karimov</x-blade.u-i.chip>
--}}
@props(['pressed' => false, 'count' => null, 'removable' => false, 'removeLabel' => null])

@if ($removable)
    <span {{ $attributes->class(['chip', 'chip--tag']) }}>
        {{ $slot }}
        <button type="button" class="chip__remove" data-chip-remove aria-label="{{ $removeLabel ?? __('ui.components.remove') }}">
            <x-blade.u-i.icon name="x" size="12" />
        </button>
    </span>
@else
    <button type="button" {{ $attributes->class(['chip']) }} aria-pressed="{{ $pressed ? 'true' : 'false' }}">
        {{ $slot }}
        @if ($count !== null)
            <span class="chip__count">{{ $count }}</span>
        @endif
    </button>
@endif
