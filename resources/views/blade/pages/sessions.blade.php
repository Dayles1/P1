@extends('blade.layouts.authenticated')

@section('title', 'Sessions')

@section('content')

    <div class="page-head">
        <div>
            <h1>Sessions</h1>
            <p>Devices and browsers currently or previously signed in to your account.</p>
        </div>

        <x-blade.u-i.button variant="outline" size="sm" type="button" data-revoke-others>
            Log out other sessions
        </x-blade.u-i.button>
    </div>

    <div class="data-list" data-sessions-list>
        <div class="empty-state">
            <strong>Loading sessions&hellip;</strong>
        </div>
    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/sessions.js')
@endpush
