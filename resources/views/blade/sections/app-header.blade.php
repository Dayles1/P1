{{-- =====================================================
     APP HEADER (authenticated shell)
     -----------------------------------------------------
     The current page's title on the left; "Create", the notification
     bell and the account menu on the right. Search lives in the
     sidebar; on phones the header carries the app name, a search
     button and the bell. Permanent under Turbo Drive: the title is
     swapped in by shared/layout-controller.js on every visit.
     ===================================================== --}}
<header class="app-header" id="app-header" data-turbo-permanent>

    {{-- BRAND (phone only — the sidebar carries it everywhere else) --}}
    <a href="{{ route('dashboard') }}" class="app-header__brand">
        <span class="sidebar-brand__mark" aria-hidden="true">{{ mb_strtoupper(mb_substr(config('app.name', 'L'), 0, 1)) }}</span>
        <span class="app-header__brand-name">{{ config('app.name', 'Laravel') }}</span>
    </a>

    <span class="app-header__title truncate" data-header-title></span>

    <div class="app-header__actions" data-auth-user>

        <button
            type="button"
            class="icon-btn icon-btn--sm app-header__search-btn"
            data-command-palette-trigger
            aria-label="{{ __('ui.shell.search_placeholder') }}"
        >
            <x-blade.u-i.icon name="search" size="18" />
        </button>

        {{-- CREATE --}}
        <x-blade.u-i.dropdown
            align="right"
            class="app-header__create"
            trigger-class="btn btn--ghost btn--sm"
        >
            <x-slot:trigger>
                <x-blade.u-i.icon name="plus" size="15" />
                <span>{{ __('ui.shell.create') }}</span>
            </x-slot:trigger>

            <button type="button" class="menu-item" role="menuitem" data-create="private">
                <x-blade.u-i.icon name="chat" size="16" class="menu-item__icon" />
                {{ __('ui.shell.new_chat') }}
                <kbd class="kbd menu-item__end">C</kbd>
            </button>

            <button type="button" class="menu-item" role="menuitem" data-create="group">
                <x-blade.u-i.icon name="users" size="16" class="menu-item__icon" />
                {{ __('ui.shell.new_group') }}
            </button>
        </x-blade.u-i.dropdown>

        {{-- NOTIFICATIONS --}}
        <x-blade.u-i.dropdown
            align="right"
            data-notif-dropdown
            trigger-class="icon-btn icon-btn--sm notif-bell"
            menu-class="notif-popover"
            menu-role="dialog"
            :label="__('ui.notifications.label')"
        >
            <x-slot:trigger>
                <x-blade.u-i.icon name="bell" size="16" />
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
        @include('blade.sections.account-menu')

    </div>

</header>
