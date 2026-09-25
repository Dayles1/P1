{{-- =====================================================
     AUTHENTICATED SIDEBAR
     -----------------------------------------------------
     Product sections only — new modules get their link here. Anything
     personal or administrative (settings, sessions, notifications,
     admin, sign-out) lives in the account menu in the header instead.
     248px with labels ≥ 1200px, a 72px icon rail from 640px, and
     replaced by the bottom tab bar on phones.
     ===================================================== --}}

<a href="{{ route('dashboard') }}" class="sidebar-brand">
    <span class="sidebar-brand__mark" aria-hidden="true">{{ mb_strtoupper(mb_substr(config('app.name', 'L'), 0, 1)) }}</span>
    <span class="sidebar-brand__text">
        <span class="sidebar-brand__name truncate">{{ config('app.name', 'Laravel') }}</span>
        <span class="sidebar-brand__caption truncate">{{ __('ui.shell.workspace') }}</span>
    </span>
</a>

<nav class="sidebar-nav" aria-label="{{ __('ui.shell.main_nav') }}">

    <x-blade.navigation.sidebar-link :href="route('dashboard')" icon="home">
        {{ __('ui.nav.home') }}
    </x-blade.navigation.sidebar-link>

    <x-blade.navigation.sidebar-link :href="route('profile')" icon="user">
        {{ __('ui.nav.profile') }}
    </x-blade.navigation.sidebar-link>

    <x-blade.navigation.sidebar-link :href="route('chat')" icon="chat">
        {{ __('ui.nav.chat') }}
    </x-blade.navigation.sidebar-link>

    <x-blade.navigation.sidebar-link :href="route('currencies')" icon="coins">
        {{ __('ui.nav.currencies') }}
    </x-blade.navigation.sidebar-link>

</nav>
