@extends('blade.layouts.authenticated')

@section('title', __('ui.admin.users_title'))

@section('content')

    <div class="page-head">
        <div>
            <h1>{{ __('ui.admin.users_title') }}</h1>
            <p>{{ __('ui.admin.users_subtitle') }}</p>
        </div>
    </div>

    <div class="field-row" style="margin-bottom:16px;">
        <div class="field-group" style="max-width:320px;">
            <label class="field-label" for="users-search">{{ __('ui.common.search') }}</label>
            <input class="field-input" type="search" id="users-search" data-users-search placeholder="{{ __('ui.admin.users_search_placeholder') }}">
        </div>

        <div class="field-group" style="max-width:200px;">
            <label class="field-label" for="users-role">{{ __('ui.admin.role') }}</label>
            <div class="select-field">
                <select class="field-select" id="users-role" data-users-role>
                    <option value="">{{ __('ui.common.all') }}</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                    <option value="ADMIN">Admin</option>
                    <option value="USER">User</option>
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
                            <th>{{ __('ui.admin.role') }}</th>
                            <th>{{ __('ui.common.status') }}</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody data-users-rows>
                        <tr><td colspan="4"><div class="skeleton skeleton-row"></div></td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div class="card__footer">
            <div class="pagination" data-users-pagination hidden></div>
        </div>
    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/admin-users.js')
@endpush
