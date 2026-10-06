@extends('blade.layouts.authenticated')

@section('title', __('ui.notifications.label'))

@section('content')

    {{-- =====================================================
         NOTIFICATION CENTER
         -----------------------------------------------------
         One feed for every notification, grouped by day. The list,
         the unread summary and the pagination are filled by
         resources/js/blade/app/notifications.js from the API. The
         list takes focus (tabindex="-1") after a page change.
         ===================================================== --}}
    <div class="notif-page">

        <div class="page-head notif-page__head">
            <div>
                <h1>{{ __('ui.notifications.label') }}</h1>
                <p class="notif-page__summary"><span class="notif-page__count" data-notif-unread-summary></span><span class="notif-page__scope">{{ __('ui.notifications.feed_scope') }}</span></p>
            </div>

            <div class="page-head__actions notif-page__actions">
                <x-blade.u-i.button
                    variant="outline"
                    size="sm"
                    icon="checks"
                    class="notif-page__read-all"
                    :label="__('ui.notifications.read_all')"
                    data-notif-mark-all-page
                >
                    <span class="notif-page__action-label">{{ __('ui.notifications.read_all') }}</span>
                </x-blade.u-i.button>

                <x-blade.u-i.button
                    variant="ghost"
                    size="sm"
                    icon="sliders"
                    class="notif-page__settings"
                    :href="route('settings.notifications')"
                >
                    {{ __('ui.notifications.settings') }}
                </x-blade.u-i.button>
            </div>
        </div>

        <div class="chips notif-filters" role="group" aria-label="{{ __('ui.notifications.filters_label') }}">
            <x-blade.u-i.chip :pressed="true" data-notif-filter="">{{ __('ui.notifications.filters.all') }}</x-blade.u-i.chip>
            <x-blade.u-i.chip data-notif-filter="unread">{{ __('ui.notifications.filters.unread') }}</x-blade.u-i.chip>
            <x-blade.u-i.chip data-notif-filter="message,reply">{{ __('ui.notifications.filters.message') }}</x-blade.u-i.chip>
            <x-blade.u-i.chip data-notif-filter="mention">{{ __('ui.notifications.filters.mention') }}</x-blade.u-i.chip>
            <x-blade.u-i.chip data-notif-filter="reaction">{{ __('ui.notifications.filters.reaction') }}</x-blade.u-i.chip>
            <x-blade.u-i.chip data-notif-filter="added_to_chat,pinned">{{ __('ui.notifications.filters.chat') }}</x-blade.u-i.chip>
            <x-blade.u-i.chip data-notif-filter="new_login,role_changed">{{ __('ui.notifications.filters.security') }}</x-blade.u-i.chip>
            <x-blade.u-i.chip data-notif-filter="system,user_report">{{ __('ui.notifications.filters.system') }}</x-blade.u-i.chip>
        </div>

        <section class="card notif-feed" aria-label="{{ __('ui.notifications.label') }}">
            <div class="notif-feed__list" data-notif-center-list tabindex="-1" aria-busy="true">
                <x-blade.u-i.skeleton type="list" :rows="5" />
            </div>

            <div class="pagination notif-feed__pagination" data-notif-pagination hidden></div>
        </section>

    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/notifications.js')
@endpush
