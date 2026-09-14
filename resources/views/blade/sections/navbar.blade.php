{{-- =====================================================
     PRIMARY NAVIGATION
     ===================================================== --}}

<nav class="navbar" aria-label="Primary">

    <x-blade.navigation.nav-link :href="route('home')">
        {{ __('ui.nav.home') }}
    </x-blade.navigation.nav-link>

    <x-blade.navigation.nav-link :href="route('about')">
        {{ __('ui.nav.about') }}
    </x-blade.navigation.nav-link>

    <x-blade.navigation.nav-link :href="route('contact')">
        {{ __('ui.nav.contact') }}
    </x-blade.navigation.nav-link>

</nav>
