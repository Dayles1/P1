@extends('blade.layouts.authenticated')

@section('title', __('ui.chat.title'))
@php($wide = true)

@section('content')

    <div class="page-head">
        <div>
            <h1>{{ __('ui.chat.title') }}</h1>
        </div>

        <x-blade.u-i.dropdown align="right">
            <x-slot:trigger>
                <span class="btn btn--primary btn--sm">{{ __('ui.chat.new_conversation') }}</span>
            </x-slot:trigger>

            <button type="button" class="dropdown__item" data-start-private>{{ __('ui.chat.start_private') }}</button>
            <button type="button" class="dropdown__item" data-start-group>{{ __('ui.chat.start_group') }}</button>
        </x-blade.u-i.dropdown>
    </div>

    <div class="chat-shell" data-chat-shell data-view="list">

        <div class="chat-list-pane">
            <div class="chat-list-pane__search">
                <input class="field-input" type="search" data-chat-search placeholder="{{ __('ui.chat.search_placeholder') }}">
            </div>

            <div class="chat-list" data-chat-list>
                <div class="skeleton skeleton-row" style="margin:10px;"></div>
            </div>
        </div>

        <div class="chat-thread-pane">
            <div class="chat-thread-header" data-chat-thread-header hidden>
                <button type="button" class="icon-btn chat-thread-header__back" data-chat-back aria-label="{{ __('ui.common.back') }}">&larr;</button>
                <span class="avatar avatar--sm" data-chat-thread-avatar>
                    <span class="avatar__initials">--</span>
                </span>
                <div style="font-weight:650; font-size:13.5px;" data-chat-thread-title></div>
            </div>

            <div class="chat-messages" data-chat-messages>
                <div class="empty-state"><strong>{{ __('ui.chat.empty_thread') }}</strong></div>
            </div>

            <form class="chat-composer" data-chat-composer hidden>
                <textarea class="field-input" rows="1" data-chat-input placeholder="{{ __('ui.chat.message_placeholder') }}"></textarea>
                <x-blade.u-i.button type="submit" size="sm">{{ __('ui.common.send') }}</x-blade.u-i.button>
            </form>
        </div>

    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/chat.js')
@endpush
