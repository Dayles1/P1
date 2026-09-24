@extends('blade.layouts.authenticated')

@section('title', __('ui.dashboard.title'))

@section('content')

    <div class="dashboard">

        <div class="page-head">
            <div>
                {{--
                    The greeting needs the user's name and local time, so it
                    starts as a skeleton and is written once, never swapped
                    from one value to another (the old "BBBB -> AAAA" flicker).
                --}}
                <h1 class="dashboard__greeting" data-dashboard-greeting>
                    <span class="skeleton skeleton--text" aria-hidden="true"></span>
                    <span class="sr-only">{{ __('ui.dashboard.title') }}</span>
                </h1>
                <p data-dashboard-welcome>
                    <span data-dashboard-date></span>{{ __('ui.dashboard.overview_hint') }}
                </p>
            </div>

            <div class="page-head__actions">
                <x-blade.u-i.button size="sm" icon="plus" data-dashboard-new-chat>
                    {{ __('ui.dashboard.new_chat') }}
                </x-blade.u-i.button>
            </div>
        </div>

        {{--
            Like the greeting, the percentage and count start as skeletons
            and the call to action stays hidden until the summary says the
            profile is not complete yet.
        --}}
        <section class="card dashboard-profile" aria-labelledby="dashboard-profile-title" data-dashboard-profile>
            <div class="dashboard-profile__progress">
                <div class="dashboard-profile__head">
                    <h2 class="dashboard-profile__title" id="dashboard-profile-title" data-completeness-value>
                        <span class="skeleton skeleton--text" aria-hidden="true"></span>
                        <span class="sr-only">{{ __('ui.dashboard.profile_completeness') }}</span>
                    </h2>
                    <span class="dashboard-profile__count" data-completeness-count>
                        <span class="skeleton skeleton--text" aria-hidden="true"></span>
                    </span>
                </div>
                <progress class="progress__bar" max="100" value="0" aria-labelledby="dashboard-profile-title" data-completeness-bar></progress>
            </div>

            <ul class="dashboard-profile__checks" role="list">
                @foreach (['name', 'avatar', 'email', 'timezone'] as $check)
                    <li class="dashboard-check" data-profile-check="{{ $check }}">
                        <x-blade.u-i.icon name="check" size="14" class="dashboard-check__icon dashboard-check__icon--done" />
                        <x-blade.u-i.icon name="plus" size="14" class="dashboard-check__icon dashboard-check__icon--todo" />
                        {{ __("ui.dashboard.checks.{$check}") }}
                        <span class="sr-only" data-profile-check-state></span>
                    </li>
                @endforeach
            </ul>

            <a href="{{ route('settings.profile') }}" class="btn btn--outline btn--sm dashboard-profile__action dashboard-profile__action--pending" data-profile-fill aria-hidden="true" tabindex="-1">
                {{ __('ui.dashboard.profile_fill') }}
                <x-blade.u-i.icon name="arrow" size="16" />
            </a>
        </section>

        <div class="stat-grid" data-stat-grid aria-busy="true">
            @for ($i = 0; $i < 6; $i++)
                <x-blade.u-i.skeleton type="card" />
            @endfor
        </div>

        <div class="dashboard-grid">

            <section class="card dashboard-card" aria-labelledby="dashboard-chats-title">
                <div class="card__header dashboard-card__header">
                    <h2 class="card__title" id="dashboard-chats-title">{{ __('ui.dashboard.recent_chats') }}</h2>
                    <a href="{{ route('chat') }}" class="dashboard-card__link">{{ __('ui.dashboard.all_chats') }}</a>
                </div>
                <div class="dashboard-card__body" data-recent-conversations>
                    <x-blade.u-i.skeleton type="list" :rows="4" />
                </div>
            </section>

            <section class="card dashboard-card" aria-labelledby="dashboard-requests-title">
                <div class="card__header dashboard-card__header">
                    <h2 class="card__title" id="dashboard-requests-title">{{ __('ui.dashboard.recent_requests') }}</h2>
                    <a href="{{ route('sessions') }}" class="dashboard-card__link">{{ __('ui.dashboard.all_requests') }}</a>
                </div>
                <div class="dashboard-card__body" data-recent-requests>
                    <x-blade.u-i.skeleton :rows="4" class="dashboard-card__skeleton" />
                </div>
            </section>

            <section class="card dashboard-card" aria-labelledby="dashboard-actions-title">
                <div class="card__header dashboard-card__header">
                    <h2 class="card__title" id="dashboard-actions-title">{{ __('ui.dashboard.quick_actions') }}</h2>
                </div>
                <div class="dashboard-card__body">
                    <div class="dashboard-actions">
                        <button type="button" class="dashboard-action" data-dashboard-new-chat>
                            <span class="dashboard-action__icon"><x-blade.u-i.icon name="chat" size="18" /></span>
                            {{ __('ui.dashboard.new_chat') }}
                        </button>
                        <button type="button" class="dashboard-action" data-dashboard-toggle-theme>
                            <span class="dashboard-action__icon">
                                <x-blade.u-i.icon name="moon" size="18" class="dashboard-action__theme-icon--light" />
                                <x-blade.u-i.icon name="sun" size="18" class="dashboard-action__theme-icon--dark" />
                            </span>
                            {{ __('ui.dashboard.change_theme') }}
                        </button>
                        <a href="{{ route('settings.security') }}" class="dashboard-action">
                            <span class="dashboard-action__icon"><x-blade.u-i.icon name="shield" size="18" /></span>
                            {{ __('ui.dashboard.security') }}
                        </a>
                        <a href="{{ route('settings.language') }}" class="dashboard-action">
                            <span class="dashboard-action__icon"><x-blade.u-i.icon name="globe" size="18" /></span>
                            {{ __('ui.dashboard.language') }}
                        </a>
                    </div>
                </div>
            </section>

            <section class="card dashboard-card" aria-labelledby="dashboard-sessions-title">
                <div class="card__header dashboard-card__header">
                    <h2 class="card__title" id="dashboard-sessions-title">{{ __('ui.dashboard.recent_sessions') }}</h2>
                    <a href="{{ route('sessions') }}" class="dashboard-card__link">{{ __('ui.dashboard.manage_sessions') }}</a>
                </div>
                <div class="dashboard-card__body" data-recent-sessions>
                    <x-blade.u-i.skeleton type="list" :rows="3" />
                </div>
            </section>

        </div>

        <section
            class="card dashboard-card"
            aria-labelledby="dashboard-instance-title"
            data-instance-overview
            data-requires-role="SUPER_ADMIN,ADMIN"
            hidden
        >
            <div class="card__header dashboard-card__header">
                <div class="row gap-2">
                    <h2 class="card__title" id="dashboard-instance-title">{{ __('ui.dashboard.instance_overview') }}</h2>
                    <x-blade.u-i.badge variant="primary">{{ __('ui.dashboard.admin_badge') }}</x-blade.u-i.badge>
                </div>
                <a href="{{ route('admin.settings') }}" class="dashboard-card__link">{{ __('ui.dashboard.system_settings') }}</a>
            </div>
            <div class="dashboard-card__body">
                <div class="dashboard-instance" data-instance-stats>
                    @for ($i = 0; $i < 4; $i++)
                        <x-blade.u-i.skeleton type="card" />
                    @endfor
                </div>
            </div>
        </section>

    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/dashboard.js')
@endpush
