@extends('blade.layouts.authenticated')

@section('title', __('ui.sessions.detail_title'))

@section('content')

    <a href="{{ route('sessions') }}" class="btn btn--ghost btn--sm session-detail__back">
        <x-blade.u-i.icon name="back" size="15" /> {{ __('ui.sessions.back_to_sessions') }}
    </a>

    <div class="page-head">
        <div>
            <h1>{{ __('ui.sessions.detail_title') }}</h1>
        </div>

        <x-blade.u-i.button variant="outline" size="sm" type="button" data-revoke-session hidden>
            {{ __('ui.sessions.sign_out') }}
        </x-blade.u-i.button>
    </div>

    <div class="session-detail__summary" data-session-summary>
        <div class="skeleton skeleton-row"></div>
    </div>

    <section class="session-detail__log">
        <h2 class="session-detail__title">{{ __('ui.sessions.request_log_history') }}</h2>

        <div>
            <div class="table-wrap session-detail__table">
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

        <div class="pagination session-detail__pagination" data-request-log-pagination hidden></div>
    </section>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/session-detail.js')
@endpush
