@extends('blade.layouts.authenticated')

@section('title', __('ui.admin.sessions_title'))

@section('content')

    <div class="page-head">
        <div>
            <h1>{{ __('ui.admin.sessions_title') }}</h1>
            <p>{{ __('ui.admin.sessions_subtitle') }}</p>
        </div>
    </div>

    <div class="field-row mb-4">
        <div class="field-group mw-lg">
            <label class="field-label" for="admin-sessions-search">{{ __('ui.common.search') }}</label>
            <input class="field-input" type="search" id="admin-sessions-search" data-sessions-search placeholder="{{ __('ui.admin.sessions_search_placeholder') }}">
        </div>

        <div class="field-group mw-md">
            <label class="field-label" for="admin-sessions-status">{{ __('ui.common.status') }}</label>
            <div class="select-field">
                <select class="field-select" id="admin-sessions-status" data-sessions-status>
                    <option value="all">{{ __('ui.common.all') }}</option>
                    <option value="active">{{ __('ui.common.active') }}</option>
                    <option value="expired">{{ __('ui.common.expired') }}</option>
                </select>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card__body card__body--flush">
            <div class="table-wrap">
                <table class="table">
                    <thead>
                        <tr>
                            <th>{{ __('ui.admin.user') }}</th>
                            <th>{{ __('ui.sessions.device') }}</th>
                            <th>{{ __('ui.sessions.ip_address') }}</th>
                            <th>{{ __('ui.common.status') }}</th>
                            <th>{{ __('ui.sessions.last_active') }}</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody data-sessions-rows>
                        <tr><td colspan="6"><div class="skeleton skeleton-row"></div></td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div class="card__footer">
            <div class="pagination" data-sessions-pagination hidden></div>
        </div>
    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/admin-sessions.js')
@endpush
