{{-- =====================================================
     ADMINISTRATION SECONDARY NAV (stub — restyled in stage 4)
     -----------------------------------------------------
     Contract: @include('blade.sections.admin-nav', ['current' => …])
     where current is one of: users, sessions, request-logs,
     settings, settings.{general|authentication|localization|
     notifications|security|system}.
     ===================================================== --}}
@php($current ??= null)

<nav class="settings-nav" aria-label="{{ __('ui.nav.admin') }}" data-requires-role="SUPER_ADMIN,ADMIN" hidden>
    <a @class(['settings-nav__link', 'settings-nav__link--active' => $current === 'users']) href="{{ route('admin.users') }}">{{ __('ui.nav.admin_users') }}</a>
    <a @class(['settings-nav__link', 'settings-nav__link--active' => $current === 'sessions']) href="{{ route('admin.sessions') }}">{{ __('ui.nav.admin_sessions') }}</a>
    <a @class(['settings-nav__link', 'settings-nav__link--active' => $current === 'request-logs']) href="{{ route('admin.request-logs') }}">{{ __('ui.nav.admin_request_logs') }}</a>
    <a @class(['settings-nav__link', 'settings-nav__link--active' => str_starts_with((string) $current, 'settings')]) href="{{ route('admin.settings') }}">{{ __('ui.nav.admin_settings') }}</a>
</nav>
