{{-- =====================================================
     AUTHENTICATED SIDEBAR
     -----------------------------------------------------
     The app name, search and commands, the product sections (new
     modules get their link here) and the chats the user pinned; the
     account menu is in the header. 232px with labels ≥ 1200px, a 60px
     icon rail from 640px, and replaced by the bottom tab bar on phones. Permanent
     under Turbo Drive: counts and pinned chats are painted by
     shared/sidebar.js and site-chrome.js, never re-rendered.
     ===================================================== --}}

<a href="{{ route('dashboard') }}" class="sidebar-brand" title="{{ config('app.name', 'Laravel') }}">
    <span class="sidebar-brand__mark" aria-hidden="true">{{ mb_strtoupper(mb_substr(config('app.name', 'L'), 0, 1)) }}</span>
    <span class="sidebar-brand__name truncate">{{ config('app.name', 'Laravel') }}</span>
</a>

<button
    type="button"
    class="sidebar-search"
    data-command-palette-trigger
    aria-keyshortcuts="Control+K"
    title="{{ __('ui.shell.search_placeholder') }}"
>
    <x-blade.u-i.icon name="search" size="14" />
    <span class="sidebar-search__label">{{ __('ui.shell.search_placeholder') }}</span>
    <span class="kbd-group sidebar-search__keys"><kbd class="kbd">Ctrl</kbd><kbd class="kbd">K</kbd></span>
</button>

<nav class="sidebar-nav" aria-label="{{ __('ui.shell.main_nav') }}">

    <x-blade.navigation.sidebar-link :href="route('dashboard')" icon="home" keys="G H">
        {{ __('ui.nav.home') }}
    </x-blade.navigation.sidebar-link>

    <x-blade.navigation.sidebar-link :href="route('chat')" icon="chat" count-key="chat">
        {{ __('ui.nav.chat') }}
    </x-blade.navigation.sidebar-link>

    <x-blade.navigation.sidebar-link :href="route('profile')" icon="user">
        {{ __('ui.nav.profile') }}
    </x-blade.navigation.sidebar-link>

    <x-blade.navigation.sidebar-link :href="route('notifications')" icon="bell" count-key="notifications">
        {{ __('ui.nav.inbox') }}
    </x-blade.navigation.sidebar-link>

    <x-blade.navigation.sidebar-link :href="route('currencies')" icon="coins">
        {{ __('ui.nav.currencies') }}
    </x-blade.navigation.sidebar-link>

</nav>

{{-- Filled with the user's pinned conversations by shared/sidebar.js. --}}
<section class="sidebar-pinned" aria-labelledby="sidebar-pinned-title" data-sidebar-pinned hidden>
    <h2 class="sidebar-pinned__title" id="sidebar-pinned-title">{{ __('ui.shell.pinned') }}</h2>
    <div class="sidebar-pinned__list" data-sidebar-pinned-list></div>
</section>
