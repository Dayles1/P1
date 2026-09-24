@extends('blade.layouts.authenticated')

@section('title', __('ui.sessions.detail_title'))

@section('content')

    <div class="page-head">
        <div>
            <a href="{{ route('admin.sessions') }}" class="btn btn--ghost btn--sm mb-3">
                <x-blade.u-i.icon name="back" size="16" /> {{ __('ui.admin.sessions_title') }}
            </a>
            <h1>{{ __('ui.sessions.detail_title') }}</h1>
        </div>

        <x-blade.u-i.button variant="outline" size="sm" type="button" data-revoke-session hidden>
            {{ __('ui.sessions.sign_out') }}
        </x-blade.u-i.button>
    </div>

    <div class="card mb-5">
        <div class="card__body" data-session-summary>
            <div class="skeleton skeleton-row"></div>
        </div>
    </div>

    <div class="card">
        <div class="card__header">
            <h2 class="card__title">{{ __('ui.sessions.request_log_history') }}</h2>
        </div>

        <div class="card__body card__body--flush">
            <div class="table-wrap">
                <table class="table" data-request-log-table>
                    <thead>
                        <tr>
                            <th>{{ __('ui.common.status') }}</th>
                            <th>{{ __('ui.sessions.method') }}</th>
                            <th>{{ __('ui.sessions.path') }}</th>
                            <th>{{ __('ui.sessions.duration') }}</th>
                            <th>{{ __('ui.sessions.time') }}</th>
                        </tr>
                    </thead>
                    <tbody data-request-log-rows>
                        <tr><td colspan="5"><div class="skeleton skeleton-row"></div></td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="card__footer">
            <div class="pagination" data-request-log-pagination hidden></div>
        </div>
    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/admin-session-detail.js')
@endpush
