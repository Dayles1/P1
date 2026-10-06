@extends('blade.layouts.authenticated')

@section('title', __('ui.sessions.title'))

@section('content')

    {{-- =====================================================
         SESSIONS AND DEVICES
         -----------------------------------------------------
         Where the account is signed in: four figures, a search and
         status filter, and a table of sessions (device, IP, last
         activity, status, sign-out). Filled by
         resources/js/blade/app/sessions.js; the markup here is the
         loading state.
         ===================================================== --}}
    <div class="sessions-page" data-sessions-page>

        <div class="page-head">
            <div>
                <h1>{{ __('ui.sessions.title') }}</h1>
                <p>{{ __('ui.sessions.subtitle') }}</p>
            </div>

            <div class="page-head__actions">
                <x-blade.u-i.button variant="outline" size="sm" icon="logout" type="button" data-revoke-others>
                    {{ __('ui.sessions.revoke_others') }}
                </x-blade.u-i.button>
            </div>
        </div>

        <div class="sessions-stats" data-sessions-stats>
            @foreach (['active', 'total', 'requests_today', 'errors_week'] as $stat)
                <div class="sessions-stat">
                    <span class="sessions-stat__label">{{ __("ui.sessions.stats.{$stat}") }}</span>
                    <span class="mono sessions-stat__value" data-sessions-stat="{{ $stat }}">
                        <span class="skeleton skeleton--text" aria-hidden="true"></span>
                    </span>
                </div>
            @endforeach
        </div>

        <div class="sessions-toolbar">
            <label class="field-box sessions-toolbar__search">
                <x-blade.u-i.icon name="search" size="15" class="field-box__icon" />
                <input
                    class="field-box__input"
                    type="search"
                    autocomplete="off"
                    placeholder="{{ __('ui.sessions.search_placeholder') }}"
                    aria-label="{{ __('ui.sessions.search_placeholder') }}"
                    data-sessions-search
                >
            </label>

            <div class="sessions-toolbar__filters" role="group" aria-label="{{ __('ui.common.status') }}">
                @foreach (['all', 'active', 'expired'] as $status)
                    <button type="button" class="sessions-filter" data-sessions-status="{{ $status }}" aria-pressed="{{ $status === 'all' ? 'true' : 'false' }}">
                        {{ __("ui.common.{$status}") }}<span class="sessions-filter__count" data-sessions-count="{{ $status }}"></span>
                    </button>
                @endforeach
            </div>
        </div>

        <div class="sessions-table" role="table" aria-label="{{ __('ui.sessions.title') }}">
            <div class="sessions-table__head" role="row">
                <span class="sessions-col sessions-col--device" role="columnheader">{{ __('ui.sessions.col_device') }}</span>
                <span class="sessions-col sessions-col--ip" role="columnheader">IP</span>
                <span class="sessions-col sessions-col--activity" role="columnheader">{{ __('ui.sessions.col_activity') }}</span>
                <span class="sessions-col sessions-col--status" role="columnheader">{{ __('ui.common.status') }}</span>
                <span class="sessions-col sessions-col--action" role="columnheader"><span class="sr-only">{{ __('ui.sessions.sign_out') }}</span></span>
            </div>

            <div data-sessions-list>
                <x-blade.u-i.skeleton :rows="4" />
            </div>
        </div>

        <div class="pagination sessions-pagination" data-sessions-pagination hidden></div>

    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/sessions.js')
@endpush
