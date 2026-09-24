@extends('blade.layouts.authenticated')

@php
    $sidebarMode = 'compact';

    /*
    | The two settings groups. Each is its own URL space (see
    | routes/web.php + SettingsPageController) and its own mini-app: the
    | page renders the nav of `$group` only, so /settings never lists
    | Application sections and /admin/settings never lists personal ones.
    | You cross between them from the main sidebar, not from here.
    |
    | `roles` gates the whole Application nav. It ships `hidden` and is
    | unhidden client-side by shared/site-chrome.js once the user is
    | resolved, because there is no server session to check here (bearer
    | tokens only) — the API enforces the same roles on every write, and
    | settings.js bounces a non-admin off these URLs entirely.
    */
    $groups = [
        'personal' => [
            'title' => __('ui.settings.title'),
            'subtitle' => __('ui.settings.subtitle'),
            'index' => route('settings'),
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
        'application' => [
            'title' => __('ui.settings.application_title'),
            'subtitle' => __('ui.settings.application_subtitle'),
            'index' => route('admin.settings'),
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

    $current = $groups[$group];

    /*
    | Section id -> URL for *both* groups, handed to settings.js. It
    | forwards an old `#section` hash to the route that replaced it and
    | sends a non-admin who landed on an Application URL back to their
    | own settings — neither of which can read the URL off a nav that no
    | longer lists the other group.
    */
    $routes = array_map(
        fn (array $item) => $item[0],
        array_merge(...array_column($groups, 'items')),
    );

    $activeLabel = $current['items'][$section][1] ?? null;
@endphp

@section('title', $activeLabel ? $activeLabel.' · '.$current['title'] : $current['title'])

@section('content')

    <div class="page-head">
        <div>
            <h1>{{ $current['title'] }}</h1>
            <p>{{ $current['subtitle'] }}</p>
        </div>
    </div>

    {{--
        `--detail` is the phone-only list/detail state (see the CSS): on
        a group's index you get the nav as a full-width menu, on a
        section you get that section plus a back link. It is a plain
        server-rendered class now that each state is its own URL.
    --}}
    <div @class(['settings-app', 'settings-app--detail' => (bool) $section])>

        @include('blade.sections.settings-nav', ['group' => $current, 'section' => $section])

        <div class="grow">
            <a class="settings-back-btn" href="{{ $current['index'] }}"><x-blade.u-i.icon name="back" size="16" /> {{ __('ui.common.back') }}</a>

            <div
                class="settings-panel"
                data-settings-panel
                data-settings-section="{{ $section }}"
                data-settings-default="{{ array_key_first($current['items']) }}"
                data-settings-routes="{{ json_encode($routes) }}"
            >
                <div class="skeleton skeleton-row"></div>
            </div>
        </div>

    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/settings.js')
@endpush
