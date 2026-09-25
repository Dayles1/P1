{{--
    <x-blade.u-i.input name="email" type="email" :label="__('ui.auth.email')" required />
    <x-blade.u-i.input name="q" icon="search" clearable :placeholder="__('ui.common.search')" />
    <x-blade.u-i.input name="site" :label="…" prefix="https://" />
    <x-blade.u-i.input name="limit" type="number" :label="…" :suffix="…" />
    <x-blade.u-i.input :label="…" value="48213" readonly copyable />
--}}
@php
    $message = $error ?? ($name ? ($errors ?? null)?->first($name) : null);
    $describedBy = collect([
        $hint ? "{$inputId}-hint" : null,
        $name ? "{$inputId}-error" : null,
    ])->filter()->implode(' ');
@endphp

<x-blade.u-i.field :label="$label" :for="$inputId" :name="$name" :hint="$hint" :error="$message" :required="$required">
    @if ($boxed())
        <div @class(['field-box', "field-box--{$size}" => $size !== 'md', 'field-box--success' => $success])>
            @if ($icon)
                <span class="field-box__icon"><x-blade.u-i.icon :name="$icon" size="18" /></span>
            @endif

            @if ($prefix)
                <span class="field-box__prefix">{{ $prefix }}</span>
            @endif

            <input
                type="{{ $type }}"
                id="{{ $inputId }}"
                @if ($name) name="{{ $name }}" @endif
                @if ($required) required @endif
                @if ($message) aria-invalid="true" @endif
                @if ($describedBy) aria-describedby="{{ $describedBy }}" @endif
                {{ $attributes->class(['field-box__input']) }}
            >

            @if ($suffix)
                <span class="field-box__suffix">{{ $suffix }}</span>
            @endif

            @if ($loading)
                <span class="spinner field-box__spinner" aria-hidden="true"></span>
            @endif

            @if ($success)
                <span class="field-box__status"><x-blade.u-i.icon name="check" size="18" /></span>
            @endif

            @if ($clearable)
                <button type="button" class="field-box__action" data-field-clear aria-label="{{ __('ui.components.clear') }}">
                    <x-blade.u-i.icon name="x" size="16" />
                </button>
            @endif

            @if ($copyable)
                <button type="button" class="field-box__action field-box__action--framed" data-field-copy aria-label="{{ __('ui.components.copy') }}">
                    <x-blade.u-i.icon name="copy" size="16" />
                </button>
            @endif
        </div>
    @else
        <input
            type="{{ $type }}"
            id="{{ $inputId }}"
            @if ($name) name="{{ $name }}" @endif
            @if ($required) required @endif
            @if ($message) aria-invalid="true" @endif
            @if ($describedBy) aria-describedby="{{ $describedBy }}" @endif
            {{ $attributes->class(['field-input', "field-input--{$size}" => $size !== 'md']) }}
        >
    @endif
</x-blade.u-i.field>
