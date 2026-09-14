<div
    class="dropdown"
    data-dropdown
    id="{{ $id }}"
    {{ $attributes }}
>

    <button
        type="button"
        class="dropdown__trigger"
        data-dropdown-trigger
        aria-haspopup="true"
        aria-expanded="false"
        aria-controls="{{ $id }}-menu"
    >
        {{ $trigger }}
    </button>

    <div
        class="dropdown__menu dropdown__menu--{{ $align }}"
        data-dropdown-menu
        id="{{ $id }}-menu"
        role="menu"
        hidden
    >
        {{ $slot }}
    </div>

</div>
