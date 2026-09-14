<label class="checkbox" for="{{ $inputId }}">
    <input
        type="checkbox"
        id="{{ $inputId }}"
        @if ($name) name="{{ $name }}" @endif
        @checked($checked)
        class="checkbox__input"
        {{ $attributes }}
    >
    <span class="checkbox__box" aria-hidden="true"></span>
    <span>{{ $slot }}</span>
</label>
