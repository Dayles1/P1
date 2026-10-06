@extends('blade.layouts.authenticated')

@section('title', __('ui.dashboard.title'))
@section('header-title', __('ui.nav.home'))

@section('content')

    {{-- =====================================================
         HOME
         -----------------------------------------------------
         Top to bottom, as in the "Рабочая версия" design: the
         greeting, how complete the profile is, six figures, four
         cards (recent chats, recent requests, quick actions,
         sessions) and, for admins, the instance. The rows fold from
         six and four columns to three and two, then to one on a
         phone. Filled by resources/js/blade/app/dashboard.js from
         /api/dashboard; the markup here is the loading state.
         ===================================================== --}}
    <div class="dashboard">

        <div class="dashboard__head">
            <div class="dashboard__hello">
                {{--
                    The greeting needs the user's name and local time, so it
                    starts as a skeleton and is written once, never swapped
                    from one value to another.
                --}}
                <h1 class="dashboard__greeting" data-dashboard-welcome>
                    <span data-dashboard-greeting>
                        <span class="skeleton skeleton--text" aria-hidden="true"></span>
                        <span class="sr-only">{{ __('ui.dashboard.title') }}</span>
                    </span>
                </h1>
                <p class="dashboard__date">
                    <span data-dashboard-date></span><span data-dashboard-tail></span>
                </p>
            </div>

            <div class="dashboard__actions">
                <x-blade.u-i.button variant="primary" size="sm" icon="plus" data-dashboard-new-chat>
                    {{ __('ui.dashboard.new_chat') }}
                </x-blade.u-i.button>
            </div>
        </div>

        {{-- How complete the profile is, as one bar with a chip per step. --}}
        <section class="dashboard-card dashboard-profile" aria-labelledby="dashboard-profile-title" data-dashboard-profile>
            <div class="dashboard-profile__summary">
                <div class="dashboard-profile__line">
                    <h2 class="dashboard-profile__title" id="dashboard-profile-title" data-completeness-value>
                        <span class="skeleton skeleton--text" aria-hidden="true"></span>
                        <span class="sr-only">{{ __('ui.dashboard.profile') }}</span>
                    </h2>
                    <span class="mono dashboard-profile__count" data-completeness-count></span>
                </div>
                <progress class="dashboard-profile__bar" max="100" value="0" aria-hidden="true" data-completeness-bar></progress>
            </div>

            <ul class="dashboard-checks" role="list">
                @foreach (['avatar', 'email', 'two_factor', 'timezone'] as $check)
                    <li>
                        <a href="{{ route($check === 'two_factor' ? 'settings.security' : 'settings.profile') }}" class="dashboard-check" data-profile-check="{{ $check }}">
                            <span class="dashboard-check__icon dashboard-check__icon--done" aria-hidden="true"><x-blade.u-i.icon name="check" size="12" /></span>
                            <span class="dashboard-check__icon dashboard-check__icon--todo" aria-hidden="true"><x-blade.u-i.icon name="plus" size="12" /></span>
                            <span class="dashboard-check__label">{{ __("ui.dashboard.checks.{$check}") }}</span>
                            <span class="sr-only" data-profile-check-state></span>
                        </a>
                    </li>
                @endforeach
            </ul>

            <a href="{{ route('settings.profile') }}" class="btn btn--outline btn--sm dashboard-profile__go" data-completeness-go>
                {{ __('ui.dashboard.profile_fill') }}
                <x-blade.u-i.icon name="arrow" size="14" />
            </a>
        </section>

        <div class="dashboard-stats" data-stat-grid aria-busy="true">
            @for ($i = 0; $i < 6; $i++)
                <div class="dashboard-stat">
                    <span class="skeleton skeleton--text"></span>
                    <span class="skeleton dashboard-stat__skeleton"></span>
                </div>
            @endfor
        </div>

        <div class="dashboard-cards">

            <section class="dashboard-card" aria-labelledby="dashboard-chats-title">
                <div class="dashboard-card__head">
                    <h2 class="dashboard-card__title" id="dashboard-chats-title">{{ __('ui.dashboard.recent_chats') }}</h2>
                    <a href="{{ route('chat') }}" class="dashboard-card__link">{{ __('ui.dashboard.all_chats') }}</a>
                </div>
                <div data-recent-conversations>
                    <x-blade.u-i.skeleton type="list" :rows="4" />
                </div>
            </section>

            <section class="dashboard-card" aria-labelledby="dashboard-requests-title">
                <div class="dashboard-card__head">
                    <h2 class="dashboard-card__title" id="dashboard-requests-title">{{ __('ui.dashboard.recent_requests') }}</h2>
                    <a href="{{ route('sessions') }}" class="dashboard-card__link">{{ __('ui.dashboard.all_requests') }}</a>
                </div>
                <div data-recent-requests>
                    <x-blade.u-i.skeleton :rows="4" />
                </div>
            </section>

            <section class="dashboard-card" aria-labelledby="dashboard-actions-title">
                <div class="dashboard-card__head">
                    <h2 class="dashboard-card__title" id="dashboard-actions-title">{{ __('ui.dashboard.quick_actions') }}</h2>
                </div>
                <div class="dashboard-actions">
                    <button type="button" class="dashboard-action" data-dashboard-new-chat>
                        <span class="dashboard-action__icon"><x-blade.u-i.icon name="chat" size="16" /></span>
                        {{ __('ui.dashboard.new_chat') }}
                    </button>
                    <button type="button" class="dashboard-action" data-dashboard-toggle-theme>
                        <span class="dashboard-action__icon"><x-blade.u-i.icon name="moon" size="16" /></span>
                        {{ __('ui.dashboard.change_theme') }}
                    </button>
                    <a href="{{ route('settings.security') }}" class="dashboard-action">
                        <span class="dashboard-action__icon"><x-blade.u-i.icon name="shield" size="16" /></span>
                        {{ __('ui.dashboard.security') }}
                    </a>
                    <a href="{{ route('settings.language') }}" class="dashboard-action">
                        <span class="dashboard-action__icon"><x-blade.u-i.icon name="globe" size="16" /></span>
                        {{ __('ui.dashboard.language') }}
                    </a>
                </div>
            </section>

            <section class="dashboard-card" aria-labelledby="dashboard-sessions-title">
                <div class="dashboard-card__head">
                    <h2 class="dashboard-card__title" id="dashboard-sessions-title">{{ __('ui.dashboard.recent_sessions') }}</h2>
                    <a href="{{ route('sessions') }}" class="dashboard-card__link">{{ __('ui.dashboard.manage_sessions') }}</a>
                </div>
                <div data-recent-sessions>
                    <x-blade.u-i.skeleton type="list" :rows="3" />
                </div>
            </section>

        </div>

        <section
            class="dashboard-card"
            aria-labelledby="dashboard-instance-title"
            data-instance-overview
            data-requires-role="SUPER_ADMIN,ADMIN"
            hidden
        >
            <div class="dashboard-card__head">
                <h2 class="dashboard-card__title" id="dashboard-instance-title">
                    {{ __('ui.dashboard.instance_overview') }}
                    <span class="badge badge--primary">{{ __('ui.dashboard.admin_badge') }}</span>
                </h2>
                <span class="dashboard-section__note" data-instance-status></span>
                <a href="{{ route('admin.settings') }}" class="dashboard-card__link">{{ __('ui.dashboard.system_settings') }}</a>
            </div>
            <div data-instance-stats>
                <x-blade.u-i.skeleton :rows="2" />
            </div>
        </section>

    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/dashboard.js')
@endpush
