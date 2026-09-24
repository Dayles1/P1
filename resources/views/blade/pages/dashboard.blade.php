@extends('blade.layouts.authenticated')

@section('title', __('ui.dashboard.title'))

@section('content')

    <div class="page-head">
        <div>
            <h1>{{ __('ui.dashboard.title') }}</h1>
            {{--
                The heading itself never changes — only this subline swaps a
                skeleton for the personalized greeting once the user loads,
                so nothing ever visibly overwrites a value the user already
                read (the old "BBBB -> AAAA" flicker).
            --}}
            <p data-dashboard-welcome>
                <span class="skeleton skeleton--text"></span>
            </p>
        </div>
    </div>

    <div class="mb-5">
        <div class="progress-bar__header">
            <span>{{ __('ui.dashboard.profile_completeness') }}</span>
            <span data-completeness-value>—</span>
        </div>
        <div class="progress-bar">
            <div class="progress-bar__fill" data-completeness-bar></div>
        </div>
    </div>

    <div class="stat-grid" data-stat-grid>
        @for ($i = 0; $i < 6; $i++)
            <div class="skeleton skeleton--card"></div>
        @endfor
    </div>

    <div class="dashboard-grid">

        <div class="stack gap-4">

            <div class="card">
                <div class="card__header">
                    <h2 class="card__title">{{ __('ui.dashboard.recent_conversations') }}</h2>
                    <a href="{{ route('chat') }}" class="btn btn--ghost btn--sm">{{ __('ui.common.view') }}</a>
                </div>
                <div class="card__body card__body--flush" data-recent-conversations>
                    <div class="skeleton skeleton-row m-3"></div>
                </div>
            </div>

            <div class="card">
                <div class="card__header">
                    <h2 class="card__title">{{ __('ui.dashboard.recent_requests') }}</h2>
                    <a href="{{ route('sessions') }}" class="btn btn--ghost btn--sm">{{ __('ui.common.view') }}</a>
                </div>
                <div class="card__body">
                    <div class="timeline" data-recent-requests>
                        <div class="skeleton skeleton-row"></div>
                    </div>
                </div>
            </div>

        </div>

        <div class="stack gap-4">

            <div class="card">
                <div class="card__header">
                    <h2 class="card__title">{{ __('ui.dashboard.quick_actions') }}</h2>
                </div>
                <div class="card__body stack gap-2">
                    <a href="{{ route('settings.profile') }}" class="btn btn--outline btn--sm row--start">{{ __('ui.dashboard.go_to_profile') }}</a>
                    <a href="{{ route('sessions') }}" class="btn btn--outline btn--sm row--start">{{ __('ui.dashboard.go_to_sessions') }}</a>
                    <a href="{{ route('chat') }}" class="btn btn--outline btn--sm row--start">{{ __('ui.dashboard.go_to_chat') }}</a>
                    <a href="{{ route('notifications') }}" class="btn btn--outline btn--sm row--start">{{ __('ui.dashboard.go_to_notifications') }}</a>
                    <a href="{{ route('settings') }}" class="btn btn--outline btn--sm row--start">{{ __('ui.dashboard.go_to_settings') }}</a>
                    <a
                        href="{{ route('admin.users') }}"
                        class="btn btn--outline btn--sm row--start"
                       
                        data-requires-role="SUPER_ADMIN,ADMIN"
                        hidden
                    >{{ __('ui.dashboard.go_to_admin') }}</a>
                </div>
            </div>

            <div class="card">
                <div class="card__header">
                    <h2 class="card__title">{{ __('ui.dashboard.recent_sessions') }}</h2>
                </div>
                <div class="card__body" data-recent-sessions>
                    <div class="skeleton skeleton-row"></div>
                </div>
            </div>

        </div>

    </div>

    <div class="card mt-4" data-instance-overview hidden>
        <div class="card__header">
            <h2 class="card__title">{{ __('ui.dashboard.instance_overview') }}</h2>
        </div>
        <div class="card__body">
            <div class="stat-grid mb-0" data-instance-stats></div>
        </div>
    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/dashboard.js')
@endpush
