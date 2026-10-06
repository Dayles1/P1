@extends('blade.layouts.authenticated')

@section('title', __('ui.nav.profile'))

@php($appVersion = collect(require base_path('resources/data/changelog.php'))->first()['version'] ?? '')

@section('content')

    {{-- =====================================================
         PROFILE
         -----------------------------------------------------
         How the user looks to others: avatar, name, role and
         department, a few figures and their contact
         details. On a phone the page is also the way into settings:
         a list of sections under the card, as the account menu has
         them. Filled by resources/js/blade/app/profile.js from
         /api/profile, /api/dashboard and /api/conversations.
         ===================================================== --}}
    <div class="profile-page" data-profile-page>

        <div class="profile-head">
            <span class="avatar profile-head__avatar" data-profile-avatar>
                <span class="avatar__initials" aria-hidden="true">--</span>
            </span>

            <div class="profile-head__who">
                <div class="profile-head__line">
                    <h1 class="profile-head__name" data-profile-name>
                        <span class="skeleton skeleton--text" aria-hidden="true"></span>
                        <span class="sr-only">{{ __('ui.nav.profile') }}</span>
                    </h1>
                    <span class="badge badge--primary" data-profile-role hidden></span>
                </div>
                <span class="profile-head__meta" data-profile-meta></span>
            </div>

            <div class="profile-head__edit row gap-2">
                {{-- Filled with /users/{me} by profile.js — the page itself does not know the user. --}}
                <x-blade.u-i.button variant="ghost" size="sm" icon="eye" href="#" data-profile-public-link hidden>
                    {{ __('ui.user_profile.how_others_see') }}
                </x-blade.u-i.button>
                <x-blade.u-i.button variant="outline" size="sm" icon="edit" :href="route('settings.profile')">
                    {{ __('ui.profile_page.edit') }}
                </x-blade.u-i.button>
            </div>
        </div>

        <div class="profile-layout">

            <div class="profile-main">
                <div class="profile-stats" data-profile-stats aria-busy="true">
                    @foreach (['chats', 'groups', 'sessions'] as $stat)
                        <div class="profile-stat">
                            <span class="profile-stat__label">{{ __("ui.profile_page.stats.{$stat}") }}</span>
                            <span class="mono profile-stat__value" data-profile-stat="{{ $stat }}">
                                <span class="skeleton skeleton--text" aria-hidden="true"></span>
                            </span>
                        </div>
                    @endforeach
                </div>
            </div>

            <aside class="profile-side">
                <section class="profile-section" aria-labelledby="profile-contacts-title">
                    <div class="profile-section__head">
                        <h2 class="profile-section__title" id="profile-contacts-title">{{ __('ui.profile_page.contacts') }}</h2>
                    </div>
                    <dl class="profile-facts">
                        @foreach (['email', 'department', 'language', 'timezone', 'joined'] as $fact)
                            <div class="profile-fact">
                                <dt>{{ __("ui.profile_page.facts.{$fact}") }}</dt>
                                <dd @class(['mono' => in_array($fact, ['email', 'timezone'], true)]) data-profile-fact="{{ $fact }}">—</dd>
                            </div>
                        @endforeach
                    </dl>
                </section>
            </aside>

        </div>

        {{-- Phones: the way into settings, grouped as on the phone design. --}}
        <nav class="profile-menu" aria-label="{{ __('ui.nav.settings') }}">
            <span class="profile-menu__label">{{ __('ui.profile_page.menu_account') }}</span>
            <div class="profile-menu__group">
                <a href="{{ route('settings.security') }}" class="profile-menu__item">
                    <x-blade.u-i.icon name="shield" size="16" /> {{ __('ui.settings.nav.security') }}
                    <x-blade.u-i.icon name="chev" size="14" class="profile-menu__chev" />
                </a>
                <a href="{{ route('sessions') }}" class="profile-menu__item">
                    <x-blade.u-i.icon name="monitor" size="16" /> {{ __('ui.shell.sessions_devices') }}
                    <x-blade.u-i.icon name="chev" size="14" class="profile-menu__chev" />
                </a>
                <a href="{{ route('settings.notifications') }}" class="profile-menu__item">
                    <x-blade.u-i.icon name="bell" size="16" /> {{ __('ui.nav.notifications') }}
                    <span class="mono profile-menu__count" data-notif-badge data-notif-badge-count hidden></span>
                    <x-blade.u-i.icon name="chev" size="14" class="profile-menu__chev" />
                </a>
            </div>

            <span class="profile-menu__label">{{ __('ui.profile_page.menu_appearance') }}</span>
            <div class="profile-menu__group">
                <a href="{{ route('settings.appearance') }}" class="profile-menu__item">
                    <x-blade.u-i.icon name="sun" size="16" /> {{ __('ui.shell.theme') }}
                    <x-blade.u-i.icon name="chev" size="14" class="profile-menu__chev" />
                </a>
                <a href="{{ route('settings.language') }}" class="profile-menu__item">
                    <x-blade.u-i.icon name="globe" size="16" /> {{ __('ui.shell.language') }}
                    <x-blade.u-i.icon name="chev" size="14" class="profile-menu__chev" />
                </a>
            </div>

            <div class="profile-menu__group">
                <a href="{{ route('settings.developer') }}" class="profile-menu__item">
                    <x-blade.u-i.icon name="code" size="16" /> {{ __('ui.settings.nav.developer') }}
                    <x-blade.u-i.icon name="chev" size="14" class="profile-menu__chev" />
                </a>
                <a href="{{ route('changelog') }}" class="profile-menu__item">
                    <x-blade.u-i.icon name="spark" size="16" /> {{ __('ui.shell.whats_new') }}
                    @if ($appVersion)
                        <span class="badge">{{ $appVersion }}</span>
                    @endif
                    <x-blade.u-i.icon name="chev" size="14" class="profile-menu__chev" />
                </a>
            </div>

            <div class="profile-menu__group">
                <button type="button" class="profile-menu__item profile-menu__item--danger" data-logout>
                    <x-blade.u-i.icon name="logout" size="16" /> {{ __('ui.nav.log_out') }}
                </button>
            </div>
        </nav>

    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/profile.js')
@endpush
