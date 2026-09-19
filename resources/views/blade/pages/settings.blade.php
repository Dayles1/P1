@extends('blade.layouts.authenticated')

@php
    $sidebarMode = 'compact';

    /*
    | The secondary sidebar. Every entry is a real route (see
    | routes/web.php + SettingsPageController) — `$section` is the id of
    | the one this request is for, or null on /settings itself.
    |
    | `roles` gates a whole group: the Application group is only for
    | people who administer this instance, and sits below the personal
    | one. It ships `hidden` and is unhidden client-side by
    | shared/site-chrome.js once the user is resolved, because there is
    | no server session to check here (bearer tokens only) — the API
    | enforces the same roles server-side on every write.
    */
    $groups = [
        [
            'label' => __('ui.settings.group_personal'),
            'roles' => null,
            'items' => [
                'personal-profile' => [route('settings.profile'), __('ui.settings.nav.profile')],
                'personal-appearance' => [route('settings.appearance'), __('ui.settings.nav.appearance')],
                'personal-language' => [route('settings.language'), __('ui.settings.nav.language_region')],
                'personal-notifications' => [route('settings.notifications'), __('ui.settings.nav.notifications')],
                'personal-security' => [route('settings.security'), __('ui.settings.nav.security')],
                'personal-developer' => [route('settings.developer'), __('ui.settings.nav.developer')],
            ],
        ],
        [
            'label' => __('ui.settings.group_application'),
            'roles' => 'SUPER_ADMIN,ADMIN',
            'items' => [
                'application-general' => [route('admin.settings.general'), __('ui.settings.nav.general')],
                'application-authentication' => [route('admin.settings.authentication'), __('ui.settings.nav.authentication')],
                'application-localization' => [route('admin.settings.localization'), __('ui.settings.nav.localization')],
                'application-notifications' => [route('admin.settings.notifications'), __('ui.settings.nav.notifications')],
                'application-security' => [route('admin.settings.security'), __('ui.settings.nav.security')],
                'application-system' => [route('admin.settings.system'), __('ui.settings.nav.system')],
            ],
        ],
    ];

    $activeLabel = array_merge(...array_column($groups, 'items'))[$section][1] ?? null;
@endphp

@section('title', $activeLabel ? $activeLabel.' · '.__('ui.settings.title') : __('ui.settings.title'))

@section('content')

    <div class="page-head">
        <div>
            <h1>{{ __('ui.settings.title') }}</h1>
            <p>{{ __('ui.settings.subtitle') }}</p>
        </div>
    </div>

    {{--
        `--detail` is the phone-only list/detail state (see the CSS): on
        /settings you get the nav as a full-width menu, on a section you
        get that section plus a back link. It is a plain server-rendered
        class now that each state is its own URL.
    --}}
    <div @class(['settings-app', 'settings-app--detail' => (bool) $section])>

        @include('blade.sections.settings-nav', ['groups' => $groups, 'section' => $section])

        <div style="flex:1; min-width:0;">
            <a class="settings-back-btn" href="{{ route('settings') }}">&larr; {{ __('ui.common.back') }}</a>

            <div class="settings-panel" data-settings-panel data-settings-section="{{ $section }}">
                <div class="skeleton skeleton-row"></div>
            </div>
        </div>

    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/settings.js')
@endpush
