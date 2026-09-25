@extends('blade.layouts.authenticated')

@section('title', __('ui.dashboard.title'))
@section('header-title', __('ui.nav.home'))

@php($fullBleed = true)

@section('content')

    {{-- =====================================================
         HOME
         -----------------------------------------------------
         Two columns, each scrolling on its own: the greeting, the
         figures, recent chats and requests; and beside it the profile
         checklist, the sessions and (for admins) the instance. Below
         1200px the side column follows the main one. Filled by
         resources/js/blade/app/dashboard.js from /api/dashboard; the
         markup here is the loading state.
         ===================================================== --}}
    <div class="dashboard">

        <div class="dashboard__main">

            <div class="dashboard__head">
                <div class="dashboard__hello">
                    <span class="dashboard__date" data-dashboard-date></span>
                    {{--
                        The greeting needs the user's name and local time, so it
                        starts as a skeleton and is written once, never swapped
                        from one value to another.
                    --}}
                    <h1 class="dashboard__greeting" data-dashboard-welcome>
                        <span data-dashboard-greeting>
                            <span class="skeleton skeleton--text" aria-hidden="true"></span>
                            <span class="sr-only">{{ __('ui.dashboard.title') }}</span>
                        </span><span class="dashboard__greeting-tail" data-dashboard-tail></span>
                    </h1>
                </div>

                <x-blade.u-i.button variant="primary" size="sm" icon="plus" data-dashboard-new-chat>
                    {{ __('ui.dashboard.new_chat') }}
                    <kbd class="kbd dashboard__kbd">C</kbd>
                </x-blade.u-i.button>
            </div>

            <div class="dashboard-stats" data-stat-grid aria-busy="true">
                @for ($i = 0; $i < 4; $i++)
                    <div class="dashboard-stat">
                        <span class="skeleton skeleton--text"></span>
                        <span class="skeleton dashboard-stat__skeleton"></span>
                    </div>
                @endfor
            </div>

            <section class="dashboard-section" aria-labelledby="dashboard-chats-title">
                <div class="dashboard-section__head">
                    <h2 class="dashboard-section__title" id="dashboard-chats-title">{{ __('ui.dashboard.recent_chats') }}</h2>
                    <a href="{{ route('chat') }}" class="btn btn--ghost btn--sm">
                        {{ __('ui.dashboard.all') }}
                        <span class="kbd-group"><kbd class="kbd">G</kbd><kbd class="kbd">C</kbd></span>
                    </a>
                </div>
                <div data-recent-conversations>
                    <x-blade.u-i.skeleton type="list" :rows="4" />
                </div>
            </section>

            <section class="dashboard-section" aria-labelledby="dashboard-requests-title">
                <div class="dashboard-section__head">
                    <h2 class="dashboard-section__title" id="dashboard-requests-title">{{ __('ui.dashboard.recent_requests') }}</h2>
                    <a href="{{ route('sessions') }}" class="btn btn--ghost btn--sm">{{ __('ui.dashboard.journal') }}</a>
                </div>
                <div data-recent-requests>
                    <x-blade.u-i.skeleton :rows="4" />
                </div>
            </section>

        </div>

        <aside class="dashboard__side">

            <section class="dashboard-section" aria-labelledby="dashboard-profile-title" data-dashboard-profile>
                <div class="dashboard-section__head">
                    <h2 class="dashboard-section__title" id="dashboard-profile-title">{{ __('ui.dashboard.profile') }}</h2>
                </div>

                <div class="dashboard-profile">
                    <svg class="dashboard-profile__ring" width="44" height="44" viewBox="0 0 36 36" aria-hidden="true">
                        <circle cx="18" cy="18" r="15" class="dashboard-profile__track"></circle>
                        <circle cx="18" cy="18" r="15" class="dashboard-profile__value" pathLength="100" stroke-dasharray="0 100" data-completeness-ring></circle>
                    </svg>
                    <div class="dashboard-profile__numbers">
                        <span class="mono dashboard-profile__percent" data-completeness-value>
                            <span class="skeleton skeleton--text" aria-hidden="true"></span>
                        </span>
                        <span class="dashboard-profile__left" data-completeness-count></span>
                    </div>
                </div>

                <ul class="dashboard-checks" role="list">
                    @foreach (['name', 'avatar', 'email', 'timezone'] as $check)
                        <li>
                            <a href="{{ route('settings.profile') }}" class="dashboard-check" data-profile-check="{{ $check }}">
                                <span class="dashboard-check__box" aria-hidden="true">
                                    <x-blade.u-i.icon name="check" size="11" />
                                </span>
                                <span class="dashboard-check__label">{{ __("ui.dashboard.checks.{$check}") }}</span>
                                <span class="sr-only" data-profile-check-state></span>
                                <x-blade.u-i.icon name="chev" size="13" class="dashboard-check__go" />
                            </a>
                        </li>
                    @endforeach
                </ul>
            </section>

            <section class="dashboard-section" aria-labelledby="dashboard-sessions-title">
                <div class="dashboard-section__head">
                    <h2 class="dashboard-section__title" id="dashboard-sessions-title">{{ __('ui.dashboard.recent_sessions') }}</h2>
                    <a href="{{ route('sessions') }}" class="btn btn--ghost btn--sm">
                        {{ __('ui.dashboard.all') }}
                        <span class="kbd-group"><kbd class="kbd">G</kbd><kbd class="kbd">S</kbd></span>
                    </a>
                </div>
                <div data-recent-sessions>
                    <x-blade.u-i.skeleton type="list" :rows="3" />
                </div>
            </section>

            <section
                class="dashboard-section"
                aria-labelledby="dashboard-instance-title"
                data-instance-overview
                data-requires-role="SUPER_ADMIN,ADMIN"
                hidden
            >
                <div class="dashboard-section__head">
                    <h2 class="dashboard-section__title" id="dashboard-instance-title">{{ __('ui.dashboard.system_admin') }}</h2>
                    <span class="dashboard-section__note" data-instance-status></span>
                </div>
                <div data-instance-stats>
                    <x-blade.u-i.skeleton :rows="4" />
                </div>
            </section>

        </aside>

    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/dashboard.js')
@endpush
