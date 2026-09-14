<div class="field-group">
    @if ($label)
        <label class="field-label" for="{{ $inputId }}">{{ $label }}</label>
    @endif

    <input
        type="{{ $type }}"
        id="{{ $inputId }}"
        @if ($name) name="{{ $name }}" @endif
        {{ $attributes->class(['field-input']) }}
    >

    @if ($hint)
        <span class="field-hint">{{ $hint }}</span>
    @endif

    <span class="field-error" @if ($name) data-field-error="{{ $name }}" @endif>{{ $error }}</span>
</div>
