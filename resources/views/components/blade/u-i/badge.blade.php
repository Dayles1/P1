{{-- <x-blade.u-i.badge variant="success">{{ __('ui.common.active') }}</x-blade.u-i.badge> --}}
<span {{ $attributes->class(['badge', "badge--{$variant}" => $variant !== 'neutral']) }}>{{ $slot }}</span>
