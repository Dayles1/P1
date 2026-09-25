{{-- =====================================================
     ACCOUNT MENU
     -----------------------------------------------------
     The user's avatar, name and role as a trigger, and a menu with the
     account pages, theme, language, what's new, administration and
     sign-out. Painted by site-chrome.js (name, avatar, role, counts).
     ===================================================== --}}
@php($appVersion = collect(require base_path('resources/data/changelog.php'))->first()['version'] ?? '')

<x-blade.u-i.dropdown
    align="right"
    class="account"
    trigger-class="account-trigger"
    menu-class="account-menu"
    :label="__('ui.shell.account_menu')"
>
    <x-slot:trigger>
        <span class="avatar avatar--xs" data-user-avatar>
            <span class="avatar__initials" aria-hidden="true">--</span>
        </span>
        <x-blade.u-i.icon name="chevdown" size="14" class="account-trigger__chevron" />
    </x-slot:trigger>

    <div class="account-menu__profile">
        <span class="avatar avatar--sm" data-user-avatar>
            <span class="avatar__initials" aria-hidden="true">--</span>
        </span>
        <span class="account-menu__who">
            <span class="account-menu__name truncate" data-user-name>&nbsp;</span>
            <span class="account-menu__email truncate" data-user-email></span>
        </span>
    </div>

    <hr class="menu-divider">

    <a href="{{ route('profile') }}" class="menu-item" role="menuitem">
        <x-blade.u-i.icon name="user" size="16" class="menu-item__icon" />
        {{ __('ui.nav.profile') }}
        <span class="kbd-group menu-item__end"><kbd class="kbd">G</kbd><kbd class="kbd">P</kbd></span>
    </a>

    <a href="{{ route('settings.profile') }}" class="menu-item" role="menuitem">
        <x-blade.u-i.icon name="sliders" size="16" class="menu-item__icon" />
        {{ __('ui.nav.settings') }}
        <span class="kbd-group menu-item__end"><kbd class="kbd">Ctrl</kbd><kbd class="kbd">,</kbd></span>
    </a>

    <a href="{{ route('sessions') }}" class="menu-item" role="menuitem">
        <x-blade.u-i.icon name="monitor" size="16" class="menu-item__icon" />
        {{ __('ui.shell.sessions_devices') }}
    </a>

    <a href="{{ route('notifications') }}" class="menu-item" role="menuitem">
        <x-blade.u-i.icon name="bell" size="16" class="menu-item__icon" />
        {{ __('ui.nav.notifications') }}
        <span class="mono menu-item__count menu-item__end" data-notif-badge data-notif-badge-count hidden></span>
    </a>

    <hr class="menu-divider">

    <div class="account-menu__prefs">
        <span class="account-menu__label" id="account-menu-theme">{{ __('ui.shell.theme') }}</span>
        <div class="segmented segmented--sm" role="group" aria-labelledby="account-menu-theme">
            @foreach (['dark', 'light', 'auto'] as $themeOption)
                <button type="button" class="segmented__option" data-theme-set="{{ $themeOption }}" aria-pressed="false">
                    {{ __('ui.theme.' . $themeOption) }}
                </button>
            @endforeach
        </div>

        <span class="account-menu__label" id="account-menu-language">{{ __('ui.shell.language') }}</span>
        <div class="segmented segmented--sm" role="group" aria-labelledby="account-menu-language">
            @foreach (['ru', 'uz', 'en'] as $localeOption)
                <button type="button" class="segmented__option" data-locale-option="{{ $localeOption }}" aria-pressed="{{ app()->getLocale() === $localeOption ? 'true' : 'false' }}">
                    {{ mb_strtoupper($localeOption) }}
                </button>
            @endforeach
        </div>
    </div>

    <hr class="menu-divider">

    <a href="{{ route('changelog') }}" class="menu-item" role="menuitem">
        <x-blade.u-i.icon name="spark" size="16" class="menu-item__icon" />
        {{ __('ui.shell.whats_new') }}
        @if ($appVersion)
            <span class="badge menu-item__end">{{ $appVersion }}</span>
        @endif
    </a>

    <a
        href="{{ route('admin.users') }}"
        class="menu-item"
        role="menuitem"
        data-requires-role="SUPER_ADMIN,ADMIN"
        hidden
    >
        <x-blade.u-i.icon name="shield" size="16" class="menu-item__icon" />
        {{ __('ui.shell.administration') }}
    </a>

    <hr class="menu-divider">

    <button type="button" class="menu-item menu-item--danger" role="menuitem" data-logout>
        <x-blade.u-i.icon name="logout" size="16" class="menu-item__icon" />
        {{ __('ui.nav.log_out') }}
    </button>
</x-blade.u-i.dropdown>
