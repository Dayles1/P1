{{-- =====================================================
     AUTHENTICATED SIDEBAR
     ===================================================== --}}

<nav class="sidebar-nav" aria-label="Account">

    <span class="sidebar-nav__group-label">Account</span>

    <x-blade.navigation.sidebar-link :href="route('profile')" icon="&#9679;">
        Profile
    </x-blade.navigation.sidebar-link>

    <x-blade.navigation.sidebar-link :href="route('settings')" icon="&#9881;">
        Settings
    </x-blade.navigation.sidebar-link>

    <x-blade.navigation.sidebar-link :href="route('sessions')" icon="&#9679;">
        Sessions
    </x-blade.navigation.sidebar-link>


    <span
        class="sidebar-nav__group-label"
        data-requires-role="SUPER_ADMIN,ADMIN"
        hidden
    >
        Administration
    </span>

    <x-blade.navigation.sidebar-link
        :href="route('admin.settings')"
        icon="&#9881;"
        data-requires-role="SUPER_ADMIN,ADMIN"
        hidden
    >
        App settings
    </x-blade.navigation.sidebar-link>

</nav>
