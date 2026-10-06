{{-- =====================================================
     BOTTOM TAB BAR (phones, < 640px)
     -----------------------------------------------------
     Stands in for the sidebar on a phone. Active state is kept in
     sync by shared/layout-controller.js (it is permanent, like the
     sidebar, so the server can't mark the active tab per page).
     ===================================================== --}}
<nav class="app-tabbar" id="app-tabbar" data-turbo-permanent aria-label="{{ __('ui.shell.tab_nav') }}">
    @foreach ([
        ['dashboard', 'home', 'ui.nav.home'],
        ['chat', 'chat', 'ui.nav.chat'],
        ['profile', 'user', 'ui.nav.profile'],
        ['notifications', 'bell', 'ui.nav.inbox'],
    ] as [$tabRoute, $tabIcon, $tabLabel])
        <a href="{{ route($tabRoute) }}" class="app-tabbar__link" data-nav-link="app-tabbar__link">
            <span class="app-tabbar__icon">
                <x-blade.u-i.icon :name="$tabIcon" size="22" />
                @if ($tabRoute === 'notifications')
                    <span class="app-tabbar__dot" data-notif-badge hidden></span>
                @endif
            </span>
            {{ __($tabLabel) }}
        </a>
    @endforeach
</nav>
