{{-- =====================================================
     PRIMARY NAVIGATION
     ===================================================== --}}

<nav class="navbar" aria-label="Primary">

    <x-blade.navigation.nav-link :href="route('home')">
        Home
    </x-blade.navigation.nav-link>

    <x-blade.navigation.nav-link :href="route('about')">
        About
    </x-blade.navigation.nav-link>

    <x-blade.navigation.nav-link :href="route('contact')">
        Contact
    </x-blade.navigation.nav-link>

</nav>
