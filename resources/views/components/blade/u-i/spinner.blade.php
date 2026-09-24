{{-- <x-blade.u-i.spinner size="md" :label="__('ui.common.loading')" /> · size: sm | md | lg --}}
@props(['size' => 'sm', 'label' => null])

<span
    {{ $attributes->class(['spinner', "spinner--{$size}" => $size !== 'sm']) }}
    @if ($label) role="status" aria-label="{{ $label }}" @else aria-hidden="true" @endif
></span>
