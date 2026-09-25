<div
    {{ $attributes->class(['dropdown']) }}
    data-dropdown
    id="{{ $id }}"
>

    <button
        type="button"
        @class(['dropdown__trigger', $triggerClass])
        data-dropdown-trigger
        aria-haspopup="{{ $menuRole === 'menu' ? 'true' : $menuRole }}"
        aria-expanded="false"
        aria-controls="{{ $id }}-menu"
        @if ($label) aria-label="{{ $label }}" title="{{ $label }}" @endif
    >
        {{ $trigger }}
    </button>

    <div
        @class(['dropdown__menu', "dropdown__menu--{$align}", $menuClass])
        data-dropdown-menu
        id="{{ $id }}-menu"
        role="{{ $menuRole }}"
        @if ($menuRole !== 'menu' && $label) aria-label="{{ $label }}" @endif
        hidden
    >
        {{ $slot }}
    </div>

</div>
