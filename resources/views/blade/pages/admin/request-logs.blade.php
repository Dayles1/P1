@extends('blade.layouts.authenticated')

@section('title', __('ui.admin.request_logs_title'))

@section('content')

    <div class="page-head">
        <div>
            <h1>{{ __('ui.admin.request_logs_title') }}</h1>
            <p>{{ __('ui.admin.request_logs_subtitle') }}</p>
        </div>
    </div>

    <div class="field-row" style="margin-bottom:16px;">
        <div class="field-group" style="max-width:280px;">
            <label class="field-label" for="logs-search">{{ __('ui.common.search') }}</label>
            <input class="field-input" type="search" id="logs-search" data-logs-search placeholder="/api/...">
        </div>

        <div class="field-group" style="max-width:160px;">
            <label class="field-label" for="logs-method">{{ __('ui.sessions.method') }}</label>
            <div class="select-field">
                <select class="field-select" id="logs-method" data-logs-method>
                    <option value="">{{ __('ui.common.all') }}</option>
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PATCH">PATCH</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                </select>
            </div>
        </div>

        <div class="field-group" style="max-width:160px;">
            <label class="field-label" for="logs-status">{{ __('ui.common.status') }}</label>
            <div class="select-field">
                <select class="field-select" id="logs-status" data-logs-status>
                    <option value="">{{ __('ui.common.all') }}</option>
                    <option value="2xx">2xx</option>
                    <option value="3xx">3xx</option>
                    <option value="4xx">4xx</option>
                    <option value="5xx">5xx</option>
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
                            <th>{{ __('ui.common.status') }}</th>
                            <th>{{ __('ui.sessions.method') }}</th>
                            <th>{{ __('ui.sessions.path') }}</th>
                            <th>{{ __('ui.admin.user') }}</th>
                            <th>{{ __('ui.sessions.duration') }}</th>
                            <th>{{ __('ui.sessions.time') }}</th>
                        </tr>
                    </thead>
                    <tbody data-logs-rows>
                        <tr><td colspan="6"><div class="skeleton skeleton-row"></div></td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div class="card__footer">
            <div class="pagination" data-logs-pagination hidden></div>
        </div>
    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/admin-request-logs.js')
@endpush
