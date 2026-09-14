@extends('blade.layouts.authenticated')

@section('title', 'Admin Settings')

@section('content')

    <div class="page-head">
        <div>
            <h1>App settings</h1>
            <p>Global configuration. Visible only to Admin and Super Admin.</p>
        </div>
    </div>

    <div data-admin-settings>
        <div class="empty-state">
            <strong>Loading settings&hellip;</strong>
        </div>
    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/admin-settings.js')
@endpush
