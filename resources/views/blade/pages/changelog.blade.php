@extends('blade.layouts.authenticated')

@section('title', __('ui.changelog.title'))

@php
    /*
     * Carbon's `uz` is Cyrillic; the app writes Oʻzbek in Latin script.
     */
    $dateLocale = app()->getLocale() === 'uz' ? 'uz_Latn' : app()->getLocale();
    $formatDate = fn (string $date, string $format): string => \Illuminate\Support\Carbon::parse($date)
        ->locale($dateLocale)
        ->isoFormat(__("ui.changelog.{$format}"));

    $types = ['new', 'improved', 'fixed'];
    $typeIcons = ['new' => 'spark', 'improved' => 'trend', 'fixed' => 'wrench'];

    $totals = array_fill_keys($types, 0);

    foreach ($releases as $release) {
        foreach ($release['items'] as $item) {
            $totals[$item['type']]++;
        }
    }

    $changeCount = array_sum($totals);
    $majors = collect($releases)->groupBy(fn (array $release): string => explode('.', $release['version'])[0]);
@endphp

@section('content')

    {{-- =====================================================
         WHAT'S NEW
         -----------------------------------------------------
         Every release from resources/data/changelog.php, newest
         first: a version index on the left, and on the right a
         search, type filters and the releases themselves. The
         markup is complete without JS (every release, every change);
         resources/js/blade/app/changelog.js adds the filtering,
         paging, collapsing long releases and copying a link.
         ===================================================== --}}
    <div class="changelog" data-changelog>

        <div class="page-head">
            <div>
                <h1>{{ __('ui.changelog.title') }}</h1>
                <p>{{ __('ui.changelog.summary', [
                    'versions' => trans_choice('ui.changelog.versions', count($releases)),
                    'changes' => trans_choice('ui.changelog.changes', $changeCount),
                    'date' => $formatDate($releases[0]['date'], 'date_long'),
                ]) }}</p>
            </div>

            <div class="page-head__actions">
                <x-blade.u-i.button variant="outline" size="sm" icon="unfold" data-changelog-toggle-all hidden>
                    <span data-changelog-toggle-all-text>{{ __('ui.changelog.expand_all') }}</span>
                </x-blade.u-i.button>
            </div>
        </div>

        <div class="changelog__layout">

            <nav class="card changelog-index" aria-label="{{ __('ui.changelog.index_title') }}">
                <div class="changelog-index__top">
                    <span class="changelog-index__title">{{ __('ui.changelog.index_title') }} · {{ count($releases) }}</span>

                    <label class="field-box field-box--sm changelog-index__search">
                        <x-blade.u-i.icon name="filter" size="15" class="field-box__icon" />
                        <input
                            class="field-box__input"
                            type="text"
                            inputmode="decimal"
                            autocomplete="off"
                            placeholder="{{ __('ui.changelog.version_search') }}"
                            aria-label="{{ __('ui.changelog.version_search_label') }}"
                            data-changelog-version-search
                        >
                    </label>
                </div>

                <div class="changelog-index__list">
                    @foreach ($majors as $major => $majorReleases)
                        <div class="changelog-index__group" data-changelog-index-group>
                            <div class="changelog-index__head">
                                <span>{{ __('ui.changelog.major', ['major' => $major]) }}</span>
                                <span>{{ $majorReleases->count() }}</span>
                            </div>

                            @foreach ($majorReleases as $release)
                                <a
                                    href="#v{{ str_replace('.', '-', $release['version']) }}"
                                    class="changelog-index__row"
                                    data-changelog-jump="{{ $release['version'] }}"
                                >
                                    <span class="changelog-index__dot" aria-hidden="true"></span>
                                    <span class="changelog-index__version">{{ $release['version'] }}</span>
                                    <span class="changelog-index__date">{{ $formatDate($release['date'], 'date_short') }}</span>
                                    <span class="changelog-index__count">{{ count($release['items']) }}</span>
                                </a>
                            @endforeach
                        </div>
                    @endforeach

                    <p class="changelog-index__empty" data-changelog-index-empty hidden>{{ __('ui.changelog.no_version') }}</p>
                </div>
            </nav>

            <div class="changelog__main">

                <div class="card changelog-toolbar">
                    <label class="field-box changelog-toolbar__search">
                        <x-blade.u-i.icon name="search" size="17" class="field-box__icon" />
                        <input
                            class="field-box__input"
                            type="search"
                            autocomplete="off"
                            placeholder="{{ __('ui.changelog.search_placeholder') }}"
                            aria-label="{{ __('ui.changelog.search_label') }}"
                            data-changelog-search
                        >
                    </label>

                    {{-- Stands in for the version index where there is no room for it. --}}
                    <select class="field-select changelog-toolbar__jump" aria-label="{{ __('ui.changelog.jump_label') }}" data-changelog-jump-select>
                        <option value="">{{ __('ui.changelog.jump_placeholder') }}</option>
                        @foreach ($releases as $release)
                            <option value="{{ $release['version'] }}">v{{ $release['version'] }}</option>
                        @endforeach
                    </select>

                    <div class="chips changelog-toolbar__types" role="group" aria-label="{{ __('ui.changelog.type_label') }}">
                        <x-blade.u-i.chip :pressed="true" :count="$changeCount" data-changelog-type="all">
                            <span class="changelog-dot" aria-hidden="true"></span>{{ __('ui.changelog.type_all') }}
                        </x-blade.u-i.chip>
                        @foreach ($types as $type)
                            <x-blade.u-i.chip :count="$totals[$type]" data-changelog-type="{{ $type }}">
                                <span class="changelog-dot changelog-dot--{{ $type }}" aria-hidden="true"></span>{{ __("ui.changelog.type_{$type}") }}
                            </x-blade.u-i.chip>
                        @endforeach
                    </div>
                </div>

                <div class="changelog__status" role="status" data-changelog-status hidden>
                    <span data-changelog-status-text></span>
                    <x-blade.u-i.button variant="ghost" size="sm" data-changelog-reset>{{ __('ui.changelog.reset') }}</x-blade.u-i.button>
                </div>

                @foreach ($releases as $release)
                    @php
                        $counts = array_count_values(array_column($release['items'], 'type'));
                        $countParts = array_filter(array_map(
                            fn (string $type): ?string => ($counts[$type] ?? 0) > 0 ? trans_choice("ui.changelog.count_{$type}", $counts[$type]) : null,
                            $types,
                        ));
                    @endphp

                    <article
                        id="v{{ str_replace('.', '-', $release['version']) }}"
                        @class(['card', 'changelog-release', 'changelog-release--latest' => $loop->first])
                        data-changelog-release="{{ $release['version'] }}"
                    >
                        <header class="changelog-release__head">
                            <span class="changelog-release__tag">v{{ $release['version'] }}</span>

                            <div class="changelog-release__meta">
                                <span class="changelog-release__title">
                                    <time datetime="{{ $release['date'] }}">{{ $formatDate($release['date'], 'date_long') }}</time>
                                    @if ($loop->first)
                                        <x-blade.u-i.badge variant="primary">{{ __('ui.changelog.latest') }}</x-blade.u-i.badge>
                                    @endif
                                    @if (str_ends_with($release['version'], '.0.0'))
                                        <x-blade.u-i.badge variant="warning">{{ __('ui.changelog.major_release') }}</x-blade.u-i.badge>
                                    @endif
                                </span>
                                <span class="changelog-release__counts">{{ implode(' · ', [trans_choice('ui.changelog.changes', count($release['items'])), ...$countParts]) }}</span>
                            </div>

                            <x-blade.u-i.button
                                variant="outline"
                                size="sm"
                                icon="link"
                                class="changelog-release__copy"
                                :label="__('ui.changelog.copy_link_label', ['version' => $release['version']])"
                                data-changelog-copy
                            >
                                <span class="changelog-release__copy-text">{{ __('ui.changelog.copy_link') }}</span>
                            </x-blade.u-i.button>
                        </header>

                        <ul class="changelog-release__items">
                            @foreach ($release['items'] as $item)
                                <li class="changelog-change" data-changelog-item="{{ $item['type'] }}">
                                    <span class="changelog-change__type changelog-change__type--{{ $item['type'] }}" title="{{ __("ui.changelog.type_{$item['type']}") }}">
                                        <x-blade.u-i.icon :name="$typeIcons[$item['type']]" size="13" />
                                        <span class="changelog-change__label">{{ __("ui.changelog.type_{$item['type']}") }}</span>
                                    </span>
                                    <p class="changelog-change__text" data-changelog-text>{{ $item['text'] }}</p>
                                </li>
                            @endforeach
                        </ul>

                        <button type="button" class="changelog-release__more" data-changelog-more hidden></button>
                    </article>
                @endforeach

                <x-blade.u-i.empty-state
                    icon="search"
                    class="card"
                    :title="__('ui.changelog.empty_title')"
                    :hint="__('ui.changelog.empty_hint')"
                    data-changelog-empty
                    hidden
                >
                    <x-slot:actions>
                        <x-blade.u-i.button variant="outline" size="sm" data-changelog-reset>{{ __('ui.changelog.empty_reset') }}</x-blade.u-i.button>
                    </x-slot:actions>
                </x-blade.u-i.empty-state>

                <nav class="changelog-pager" aria-label="{{ __('ui.changelog.pages_label') }}" data-changelog-pager hidden></nav>
            </div>
        </div>
    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/changelog.js')
@endpush
