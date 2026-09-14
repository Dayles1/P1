@extends('blade.layouts.authenticated')

@section('title', __('ui.admin.settings_title'))

@section('content')

    <div class="page-head">
        <div>
            <h1>{{ __('ui.admin.settings_title') }}</h1>
            <p>{{ __('ui.admin.settings_subtitle') }}</p>
        </div>
    </div>

    <div data-admin-settings>
        <div class="empty-state">
            <strong>{{ __('ui.common.loading') }}</strong>
        </div>
    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/admin-settings.js')
@endpush
