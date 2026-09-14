@extends('blade.layouts.authenticated')

@section('title', __('ui.sessions.title'))

@section('content')

    <div class="page-head">
        <div>
            <h1>{{ __('ui.sessions.title') }}</h1>
            <p>{{ __('ui.sessions.subtitle') }}</p>
        </div>

        <x-blade.u-i.button variant="outline" size="sm" type="button" data-revoke-others>
            {{ __('ui.sessions.revoke_others') }}
        </x-blade.u-i.button>
    </div>

    <div class="field-group" style="max-width: 220px; margin-bottom: 16px;">
        <label class="field-label" for="sessions-status">{{ __('ui.common.status') }}</label>
        <div class="select-field">
            <select class="field-select" id="sessions-status" data-sessions-status>
                <option value="all">{{ __('ui.common.all') }}</option>
                <option value="active">{{ __('ui.common.active') }}</option>
                <option value="expired">{{ __('ui.common.expired') }}</option>
            </select>
        </div>
    </div>

    <div class="data-list" data-sessions-list>
        <div class="empty-state">
            <strong>{{ __('ui.sessions.loading') }}</strong>
        </div>
    </div>

    <div class="pagination" data-sessions-pagination hidden></div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/sessions.js')
@endpush
