@extends('blade.layouts.authenticated')

@section('title', __('ui.dashboard.title'))

@section('content')

    <div class="page-head">
        <div>
            <h1 data-dashboard-welcome>{{ __('ui.dashboard.title') }}</h1>
            <p>{{ __('ui.dashboard.profile_completeness') }}</p>
        </div>
    </div>

    <div style="margin-bottom:20px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; font-size:12.5px; color:var(--ui-text-secondary);">
            <span>{{ __('ui.dashboard.profile_completeness') }}</span>
            <span data-completeness-value>—</span>
        </div>
        <div class="progress-bar">
            <div class="progress-bar__fill" data-completeness-bar style="width:0%;"></div>
        </div>
    </div>

    <div class="stat-grid" data-stat-grid>
        @for ($i = 0; $i < 6; $i++)
            <div class="skeleton" style="height:96px;"></div>
        @endfor
    </div>

    <div class="dashboard-grid">

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

        <div style="display:flex; flex-direction:column; gap:16px;">

            <div class="card">
                <div class="card__header">
                    <h2 class="card__title">{{ __('ui.dashboard.quick_actions') }}</h2>
                </div>
                <div class="card__body" style="display:flex; flex-direction:column; gap:8px;">
                    <a href="{{ route('profile') }}" class="btn btn--outline btn--sm" style="justify-content:flex-start;">{{ __('ui.dashboard.go_to_profile') }}</a>
                    <a href="{{ route('sessions') }}" class="btn btn--outline btn--sm" style="justify-content:flex-start;">{{ __('ui.dashboard.go_to_sessions') }}</a>
                    <a href="{{ route('settings') }}" class="btn btn--outline btn--sm" style="justify-content:flex-start;">{{ __('ui.dashboard.go_to_settings') }}</a>
                    <a href="{{ route('chat') }}" class="btn btn--outline btn--sm" style="justify-content:flex-start;">{{ __('ui.dashboard.go_to_chat') }}</a>
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

    <div class="card" data-instance-overview hidden style="margin-top:16px;">
        <div class="card__header">
            <h2 class="card__title">{{ __('ui.dashboard.instance_overview') }}</h2>
        </div>
        <div class="card__body">
            <div class="stat-grid" data-instance-stats style="margin-bottom:0;"></div>
        </div>
    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/dashboard.js')
@endpush
