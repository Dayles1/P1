{{--
    <x-blade.u-i.select name="locale" :label="__('ui.locale.label')" :options="$languages" :selected="$current" />
--}}
@php($message = $error ?? ($name ? ($errors ?? null)?->first($name) : null))

<x-blade.u-i.field :label="$label" :for="$inputId" :name="$name" :hint="$hint" :error="$message" :required="$required">
    <select
        id="{{ $inputId }}"
        @if ($name) name="{{ $name }}" @endif
        @if ($required) required @endif
        @if ($message) aria-invalid="true" @endif
        {{ $attributes->class(['field-select', "field-select--{$size}" => $size !== 'md']) }}
    >
        @if ($placeholder)
            <option value="" @selected($selected === null || $selected === '') disabled>{{ $placeholder }}</option>
        @endif

        @if (count($options))
            @foreach ($options as $value => $optionLabel)
                <option value="{{ $value }}" @selected((string) $value === (string) $selected)>{{ $optionLabel }}</option>
            @endforeach
        @else
            {{ $slot }}
        @endif
    </select>
</x-blade.u-i.field>
