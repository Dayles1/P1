@extends('blade.layouts.authenticated')

@section('title', __('ui.currencies.title'))

@section('content')

    {{-- =====================================================
         CURRENCIES
         -----------------------------------------------------
         Every active currency, quoted against the one the user reads
         prices in (their `preferred_currency_id`, or the app currency
         when they have not picked one): the user's currency card, a
         quick converter, and the rate table with filters, sorting and
         a one-click "make it mine" per row. Filled by
         resources/js/blade/app/currencies.js from the API; the markup
         here is the loading state.
         ===================================================== --}}
    <div class="currency-page" data-currency-page data-state="loading">

        <div class="page-head">
            <div>
                <h1>{{ __('ui.currencies.title') }}</h1>
                <p data-currency-summary>{{ __('ui.currencies.subtitle') }}</p>
            </div>

            <div class="page-head__actions">
                <x-blade.u-i.button
                    variant="outline"
                    size="sm"
                    icon="sliders"
                    :href="route('settings.language')"
                >
                    {{ __('ui.currencies.region_settings') }}
                </x-blade.u-i.button>
            </div>
        </div>

        <div class="alert alert--warning currency-page__stale" role="status" data-currency-stale hidden></div>

        <div class="currency-top">
            <section class="card currency-card" aria-labelledby="currency-base-title" data-currency-base>
                <span class="currency-card__label" id="currency-base-title">{{ __('ui.currencies.your_currency') }}</span>
                <div class="skeleton currency-card__skeleton"></div>
            </section>

            <section class="card currency-card" aria-labelledby="currency-convert-title" data-currency-convert>
                <span class="currency-card__label" id="currency-convert-title">{{ __('ui.currencies.convert_title') }}</span>
                <div class="skeleton currency-card__skeleton"></div>
            </section>
        </div>

        <section class="card currency-table" aria-label="{{ __('ui.currencies.title') }}">
            <div class="currency-table__toolbar">
                <label class="field-box currency-table__search">
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

                <div class="chips currency-table__filters" role="group" aria-label="{{ __('ui.currencies.filter_label') }}" data-currency-filters></div>

                <label class="currency-table__sort">
                    <span>{{ __('ui.currencies.sort_label') }}</span>
                    <select class="field-select field-select--sm" data-currency-sort>
                        <option value="name">{{ __('ui.currencies.sort_name') }}</option>
                        <option value="code">{{ __('ui.currencies.sort_code') }}</option>
                        <option value="up">{{ __('ui.currencies.sort_up') }}</option>
                        <option value="down">{{ __('ui.currencies.sort_down') }}</option>
                    </select>
                </label>
            </div>

            <div class="currency-table__head" aria-hidden="true">
                <span>{{ __('ui.currencies.col_currency') }}</span>
                <span class="currency-table__num" data-currency-rate-head>{{ __('ui.currencies.col_rate_plain') }}</span>
                <span class="currency-table__num">{{ __('ui.currencies.col_change') }}</span>
                <span></span>
            </div>

            <div class="currency-table__body" data-currency-list aria-busy="true" aria-live="polite">
                <x-blade.u-i.skeleton type="list" :rows="6" />
            </div>

            <div class="currency-table__foot" data-currency-foot hidden>
                <span data-currency-shown></span>
                <button type="button" class="btn btn--outline btn--sm" data-currency-more hidden>
                    {{ __('ui.currencies.more') }}
                    <x-blade.u-i.icon name="chevdown" size="16" />
                </button>
            </div>
        </section>

        <p class="currency-page__note">{{ __('ui.currencies.note') }}</p>

    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/currencies.js')
@endpush
