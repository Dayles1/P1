<div class="field-group">
    @if ($label)
        <label class="field-label" for="{{ $inputId }}">{{ $label }}</label>
    @endif

    <div class="select-field">
        <select
            id="{{ $inputId }}"
            @if ($name) name="{{ $name }}" @endif
            {{ $attributes->class(['field-select']) }}
        >
            @if (count($options))
                @foreach ($options as $value => $label)
                    <option value="{{ $value }}" @selected((string) $value === (string) $selected)>{{ $label }}</option>
                @endforeach
            @else
                {{ $slot }}
            @endif
        </select>
    </div>

    @if ($name)
        <span class="field-error" data-field-error="{{ $name }}">{{ $error }}</span>
    @endif
</div>
