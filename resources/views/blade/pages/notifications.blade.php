@extends('blade.layouts.authenticated')

@section('title', __('ui.notifications.label'))

@section('content')

    <div class="page-head">
        <div>
            <h1>{{ __('ui.notifications.label') }}</h1>
            <p>{{ __('ui.notifications.center_subtitle') }}</p>
        </div>
        <x-blade.u-i.button variant="outline" size="sm" data-notif-mark-all-page>
            {{ __('ui.notifications.mark_all_read') }}
        </x-blade.u-i.button>
    </div>

    <div class="notif-filter-bar">
        <button type="button" class="btn btn--secondary btn--sm" data-notif-filter="" data-active>{{ __('ui.common.all') }}</button>
        <button type="button" class="btn btn--outline btn--sm" data-notif-filter="unread">{{ __('ui.notifications.unread') }}</button>
        <button type="button" class="btn btn--outline btn--sm" data-notif-filter="system">{{ __('ui.notifications.type_system') }}</button>
        <button type="button" class="btn btn--outline btn--sm" data-notif-filter="message">{{ __('ui.notifications.type_message') }}</button>
        <button type="button" class="btn btn--outline btn--sm" data-notif-filter="mention">{{ __('ui.notifications.type_mention') }}</button>
    </div>

    <div class="card">
        <div class="card__body card__body--flush">
            <div data-notif-center-list>
                <div class="skeleton skeleton-row m-3"></div>
            </div>
        </div>
        <div class="card__footer">
            <div class="pagination" data-notif-pagination hidden></div>
        </div>
    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/notifications.js')
@endpush
