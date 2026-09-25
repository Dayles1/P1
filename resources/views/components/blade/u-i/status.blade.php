{{-- <x-blade.u-i.status state="online">{{ __('…') }}</x-blade.u-i.status> · state: online | away | busy | offline | success | warning | danger --}}
@props(['state' => 'offline'])

<span {{ $attributes->class(['status', "status--{$state}"]) }}>{{ $slot }}</span>
