@extends('blade.layouts.authenticated')

@section('title', __('ui.currencies.title'))

@section('content')

    {{-- =====================================================
         CURRENCIES
         -----------------------------------------------------
         Every active currency, quoted against the one the user reads
         prices in (their `preferred_currency_id`, or the app currency
         when they have not picked one). One line says which currency
         that is and switches it; a slim converter; then the list —
         a row is one button that opens the currency's details, where
         it can be made the user's own. Filled by
         resources/js/blade/app/currencies.js; the markup here is the
         loading state.
         ===================================================== --}}
    <div class="currency-page" data-currency-page data-state="loading">

        <header class="currency-hero">
            <div class="currency-hero__text">
                <h1>{{ __('ui.currencies.title') }}</h1>

                <p class="currency-hero__meta" data-currency-summary>
                    <span>{{ __('ui.currencies.prices_in') }}</span>

                    <label class="currency-switch">
                        <span class="currency-switch__value" data-currency-current>…</span>
                        <x-blade.u-i.icon name="chevdown" size="14" />
                        <select class="currency-switch__select" aria-label="{{ __('ui.currencies.prices_in') }}" data-currency-select disabled></select>
                    </label>

                    <span class="currency-hero__asof" data-currency-stale></span>
                </p>
            </div>

            <label class="field-box currency-hero__search">
                <x-blade.u-i.icon name="search" size="17" class="field-box__icon" />
                <input
                    class="field-box__input"
                    type="search"
                    autocomplete="off"
                    placeholder="{{ __('ui.currencies.search_placeholder') }}"
                    aria-label="{{ __('ui.currencies.search_label') }}"
                    data-currency-search
                >
            </label>
        </header>

        <section class="currency-convert" aria-label="{{ __('ui.currencies.convert_title') }}" data-currency-convert></section>

        <section class="currency-list" aria-label="{{ __('ui.currencies.title') }}">
            <div class="currency-list__bar">
                <div class="segmented segmented--inline" role="group" aria-label="{{ __('ui.currencies.filter_label') }}" data-currency-filters>
                    @foreach (['popular', 'all', 'up', 'down'] as $filter)
                        <button type="button" class="segmented__option" data-filter="{{ $filter }}" aria-pressed="{{ $filter === 'popular' ? 'true' : 'false' }}">
                            {{ __('ui.currencies.filter_'.$filter) }}
                        </button>
                    @endforeach
                </div>
            </div>

            <div class="currency-list__head" data-currency-sort>
                <button type="button" class="currency-list__sort" data-sort="name">{{ __('ui.currencies.col_currency') }}</button>
                <button type="button" class="currency-list__sort currency-list__num" data-sort="rate" data-currency-rate-head>{{ __('ui.currencies.col_rate_plain') }}</button>
                <button type="button" class="currency-list__sort currency-list__num" data-sort="change">{{ __('ui.currencies.col_change') }}</button>
            </div>

            <div class="currency-list__body" data-currency-list aria-busy="true" aria-live="polite">
                <x-blade.u-i.skeleton type="list" :rows="6" />
            </div>
        </section>

        <p class="currency-page__note">
            {{ __('ui.currencies.note') }}
            <a href="{{ route('settings.language') }}">{{ __('ui.currencies.region_settings') }}</a>
        </p>

    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/currencies.js')
@endpush
