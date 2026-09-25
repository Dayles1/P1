{{-- =====================================================
     APP HEADER (authenticated shell)
     -----------------------------------------------------
     Search/command palette trigger, "Create", the notification bell
     and the account menu. Everything personal — theme, language,
     account pages, admin, sign-out — lives in the account menu, not
     in the sidebar. Permanent under Turbo Drive: painted once by
     site-chrome.js (name, avatar, role, counts), never re-rendered.
     ===================================================== --}}
<header class="app-header" id="app-header" data-turbo-permanent>

    {{-- BRAND (phone only — the sidebar carries it everywhere else) --}}
    <a href="{{ route('dashboard') }}" class="app-header__brand">
        <span class="sidebar-brand__mark">{{ mb_strtoupper(mb_substr(config('app.name', 'L'), 0, 1)) }}</span>
        <span class="app-header__brand-name">{{ config('app.name', 'Laravel') }}</span>
    </a>

    {{-- SEARCH + COMMANDS --}}
    <button type="button" class="app-search" data-command-palette-trigger aria-keyshortcuts="Control+K">
        <x-blade.u-i.icon name="search" size="18" />
        <span class="app-search__label">{{ __('ui.shell.search_placeholder') }}</span>
        <kbd class="app-search__kbd">Ctrl K</kbd>
    </button>

    <div class="app-header__actions" data-auth-user>

        <button
            type="button"
            class="icon-btn app-header__search-btn"
            data-command-palette-trigger
            aria-label="{{ __('ui.shell.search_placeholder') }}"
        >
            <x-blade.u-i.icon name="search" size="18" />
        </button>

        {{-- CREATE --}}
        <x-blade.u-i.dropdown
            align="right"
            class="app-header__create"
            trigger-class="btn btn--primary btn--sm"
        >
            <x-slot:trigger>
                <x-blade.u-i.icon name="plus" size="18" />
                <span>{{ __('ui.shell.create') }}</span>
            </x-slot:trigger>

            <button type="button" class="menu-item" role="menuitem" data-create="private">
                <x-blade.u-i.icon name="chat" size="18" class="menu-item__icon" />
                {{ __('ui.shell.new_chat') }}
            </button>

            <button type="button" class="menu-item" role="menuitem" data-create="group">
                <x-blade.u-i.icon name="users" size="18" class="menu-item__icon" />
                {{ __('ui.shell.new_group') }}
            </button>
        </x-blade.u-i.dropdown>

        {{-- NOTIFICATIONS --}}
        <x-blade.u-i.dropdown
            align="right"
            data-notif-dropdown
            trigger-class="icon-btn notif-bell"
            menu-class="notif-popover"
            menu-role="dialog"
            :label="__('ui.notifications.label')"
        >
            <x-slot:trigger>
                <x-blade.u-i.icon name="bell" size="18" />
                <span class="notif-bell__dot" data-notif-badge hidden></span>
            </x-slot:trigger>

            <div class="notif-popover__header">
                <h2 class="notif-popover__title">{{ __('ui.notifications.label') }}</h2>
                <span class="badge badge--primary" data-notif-new-count hidden></span>
                <button type="button" class="notif-popover__action" data-notif-mark-all>
                    {{ __('ui.notifications.read_all') }}
                </button>
            </div>

            <div class="notif-list" data-notif-list>
                <div class="skeleton skeleton-row m-3"></div>
            </div>

            <a href="{{ route('notifications') }}" class="notif-popover__footer" role="menuitem">
                {{ __('ui.notifications.all') }}
            </a>
        </x-blade.u-i.dropdown>

        {{-- ACCOUNT --}}
        <x-blade.u-i.dropdown
            align="right"
            trigger-class="account-trigger"
            menu-class="account-menu"
            :label="__('ui.shell.account_menu')"
        >
            <x-slot:trigger>
                <span class="avatar avatar--sm" data-user-avatar>
                    <span class="avatar__initials" aria-hidden="true">--</span>
                </span>
                <x-blade.u-i.icon name="chevdown" size="16" class="account-trigger__chevron" />
            </x-slot:trigger>

            <div class="account-menu__profile">
                <span class="avatar avatar--md account-menu__avatar" data-user-avatar>
                    <span class="avatar__initials" aria-hidden="true">--</span>
                </span>
                <span class="account-menu__who">
                    <span class="account-menu__name truncate" data-user-name>&nbsp;</span>
                    <span class="account-menu__email truncate" data-user-email></span>
                </span>
                <span class="badge badge--primary" data-user-role hidden></span>
            </div>

            <hr class="menu-divider">

            <a href="{{ route('settings.profile') }}" class="menu-item" role="menuitem">
                <x-blade.u-i.icon name="user" size="18" class="menu-item__icon" />
                {{ __('ui.shell.my_account') }}
            </a>

            <a href="{{ route('settings.security') }}" class="menu-item" role="menuitem">
                <x-blade.u-i.icon name="shield" size="18" class="menu-item__icon" />
                {{ __('ui.shell.security_sessions') }}
            </a>

            <a href="{{ route('notifications') }}" class="menu-item" role="menuitem">
                <x-blade.u-i.icon name="bell" size="18" class="menu-item__icon" />
                {{ __('ui.nav.notifications') }}
                <span class="badge badge--primary menu-item__end" data-notif-badge data-notif-badge-count hidden></span>
            </a>

            <hr class="menu-divider">

            <div class="account-menu__prefs">
                <span class="account-menu__label" id="account-menu-theme">{{ __('ui.shell.theme') }}</span>
                <div class="segmented" role="group" aria-labelledby="account-menu-theme">
                    @foreach (['light', 'dark', 'auto'] as $themeOption)
                        <button type="button" class="segmented__option" data-theme-set="{{ $themeOption }}" aria-pressed="false">
                            {{ __('ui.theme.' . $themeOption) }}
                        </button>
                    @endforeach
                </div>

                <span class="account-menu__label" id="account-menu-language">{{ __('ui.shell.language') }}</span>
                <div class="segmented" role="group" aria-labelledby="account-menu-language">
                    @foreach (['ru', 'uz', 'en'] as $localeOption)
                        <button type="button" class="segmented__option" data-locale-option="{{ $localeOption }}" aria-pressed="{{ app()->getLocale() === $localeOption ? 'true' : 'false' }}">
                            {{ __('ui.locale.' . $localeOption) }}
                        </button>
                    @endforeach
                </div>
            </div>

            <hr class="menu-divider">

            <a href="{{ route('changelog') }}" class="menu-item" role="menuitem">
                <x-blade.u-i.icon name="spark" size="18" class="menu-item__icon" />
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
                <x-blade.u-i.icon name="sliders" size="18" class="menu-item__icon" />
                {{ __('ui.shell.administration') }}
            </a>

            <hr class="menu-divider">

            <button type="button" class="menu-item menu-item--danger" role="menuitem" data-logout>
                <x-blade.u-i.icon name="logout" size="18" class="menu-item__icon" />
                {{ __('ui.nav.log_out') }}
            </button>
        </x-blade.u-i.dropdown>

    </div>

</header>
