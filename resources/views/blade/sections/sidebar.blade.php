{{-- =====================================================
     AUTHENTICATED SIDEBAR
     ===================================================== --}}

<nav class="sidebar-nav" aria-label="Account">

    <span class="sidebar-nav__group-label">{{ __('ui.nav.dashboard') }}</span>

    <x-blade.navigation.sidebar-link :href="route('dashboard')" icon="&#9635;">
        {{ __('ui.nav.dashboard') }}
    </x-blade.navigation.sidebar-link>

    <x-blade.navigation.sidebar-link :href="route('chat')" icon="&#9993;">
        {{ __('ui.nav.chat') }}
    </x-blade.navigation.sidebar-link>

    <x-blade.navigation.sidebar-link :href="route('notifications')" icon="&#128276;">
        {{ __('ui.nav.notifications') }}
    </x-blade.navigation.sidebar-link>


    <span class="sidebar-nav__group-label">{{ __('ui.nav.profile') }}</span>

    {{-- Profile now lives inside Settings (Personal -> Profile) — see settings.js. --}}
    <x-blade.navigation.sidebar-link :href="route('settings')" icon="&#9881;">
        {{ __('ui.nav.settings') }}
    </x-blade.navigation.sidebar-link>

    <x-blade.navigation.sidebar-link :href="route('sessions')" icon="&#9673;">
        {{ __('ui.nav.sessions') }}
    </x-blade.navigation.sidebar-link>


    <span
        class="sidebar-nav__group-label"
        data-requires-role="SUPER_ADMIN,ADMIN"
        hidden
    >
        {{ __('ui.nav.admin') }}
    </span>

    <x-blade.navigation.sidebar-link
        :href="route('admin.users')"
        icon="&#9782;"
        data-requires-role="SUPER_ADMIN,ADMIN"
        hidden
    >
        {{ __('ui.nav.admin_users') }}
    </x-blade.navigation.sidebar-link>

    <x-blade.navigation.sidebar-link
        :href="route('admin.sessions')"
        icon="&#9673;"
        data-requires-role="SUPER_ADMIN,ADMIN"
        hidden
    >
        {{ __('ui.nav.admin_sessions') }}
    </x-blade.navigation.sidebar-link>

    <x-blade.navigation.sidebar-link
        :href="route('admin.request-logs')"
        icon="&#9776;"
        data-requires-role="SUPER_ADMIN,ADMIN"
        hidden
    >
        {{ __('ui.nav.admin_request_logs') }}
    </x-blade.navigation.sidebar-link>

    <x-blade.navigation.sidebar-link
        href="{{ route('settings') }}#system"
        icon="&#9881;"
        data-requires-role="SUPER_ADMIN,ADMIN"
        hidden
    >
        {{ __('ui.nav.admin_settings') }}
    </x-blade.navigation.sidebar-link>

</nav>
