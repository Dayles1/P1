@extends('blade.layouts.authenticated')

@section('title', __('ui.chat.title'))
@php($wide = true)

@section('content')

    <div class="page-head">
        <div>
            <h1>{{ __('ui.chat.title') }}</h1>
        </div>

        <div style="display:flex; gap:8px;">
            <button type="button" class="icon-btn" data-chat-global-search aria-label="{{ __('ui.chat.search_all') }}" title="{{ __('ui.chat.search_all') }}">&#128269;</button>

            <x-blade.u-i.dropdown align="right">
                <x-slot:trigger>
                    <span class="btn btn--primary btn--sm">{{ __('ui.chat.new_conversation') }}</span>
                </x-slot:trigger>

                <button type="button" class="dropdown__item" data-start-private>{{ __('ui.chat.start_private') }}</button>
                <button type="button" class="dropdown__item" data-start-group>{{ __('ui.chat.start_group') }}</button>
            </x-blade.u-i.dropdown>
        </div>
    </div>

    <div class="chat-shell" data-chat-shell data-view="list">

        {{-- CONVERSATIONS --}}
        <div class="chat-list-pane">
            <div class="chat-list-pane__search">
                <input class="field-input" type="search" data-chat-search placeholder="{{ __('ui.chat.search_placeholder') }}" autocomplete="off">
            </div>

            <div class="chat-list" data-chat-list>
                <div class="skeleton skeleton-row" style="margin:10px;"></div>
            </div>
        </div>

        {{-- CHAT --}}
        <div class="chat-thread-pane" data-chat-thread-pane>

            <div class="chat-thread-header" data-chat-thread-header hidden>
                <button type="button" class="icon-btn chat-thread-header__back" data-chat-back aria-label="{{ __('ui.common.back') }}">&larr;</button>
                <span class="avatar avatar--sm" data-chat-thread-avatar>
                    <span class="avatar__initials">--</span>
                </span>
                <div class="chat-thread-header__body">
                    <div class="chat-thread-header__name" data-chat-thread-title></div>
                    <div class="chat-thread-header__status" data-chat-thread-status></div>
                </div>
                <div class="chat-thread-header__actions">
                    <button type="button" class="icon-btn" data-chat-search-toggle aria-label="{{ __('ui.common.search') }}" title="{{ __('ui.common.search') }}">&#128269;</button>
                </div>
            </div>

            <div class="chat-pinned-bar" data-chat-pinned-bar hidden>
                <span aria-hidden="true">&#128204;</span>
                <span class="chat-pinned-bar__text" data-chat-pinned-text></span>
            </div>

            <div class="chat-messages" data-chat-messages>
                <div class="empty-state"><strong>{{ __('ui.chat.empty_thread') }}</strong></div>
            </div>

            <div class="chat-typing" data-chat-typing></div>

            <button type="button" class="chat-scroll-to-bottom" data-chat-scroll-bottom hidden aria-label="{{ __('ui.chat.jump_to_newest') }}" title="{{ __('ui.chat.jump_to_newest') }}">&darr;</button>

            <div class="chat-reply-preview" data-chat-reply-preview hidden>
                <div class="chat-reply-preview__body">
                    <span class="chat-reply-preview__label">{{ __('ui.chat.replying_to') }}</span>
                    <span data-chat-reply-preview-text></span>
                </div>
                <button type="button" class="icon-btn btn--sm" data-chat-reply-cancel aria-label="{{ __('ui.common.cancel') }}">&times;</button>
            </div>

            <div class="chat-edit-preview" data-chat-edit-preview hidden>
                <div class="chat-edit-preview__body">
                    <span class="chat-edit-preview__label">{{ __('ui.chat.editing') }}</span>
                </div>
                <button type="button" class="icon-btn btn--sm" data-chat-edit-cancel aria-label="{{ __('ui.common.cancel') }}">&times;</button>
            </div>

            <div class="chat-composer__attachments" data-chat-composer-attachments hidden></div>

            <form class="chat-composer" data-chat-composer hidden>
                <button type="button" class="icon-btn" data-chat-attach aria-label="{{ __('ui.chat.attach_file') }}" title="{{ __('ui.chat.attach_file') }}">&#128206;</button>
                <input type="file" multiple hidden data-chat-file-input>
                <div style="flex:1; position:relative;">
                    <textarea class="field-input" rows="1" data-chat-input placeholder="{{ __('ui.chat.message_placeholder') }}"></textarea>
                    <div class="mention-autocomplete" data-chat-mentions hidden></div>
                </div>
                <x-blade.u-i.button type="submit" size="sm">{{ __('ui.common.send') }}</x-blade.u-i.button>
            </form>

            <div class="chat-dropzone-overlay">{{ __('ui.chat.drop_files_here') }}</div>

            {{-- Search within this conversation / all conversations --}}
            <div class="chat-search-panel" data-chat-search-panel hidden>
                <div class="chat-search-panel__header">
                    <button type="button" class="icon-btn" data-chat-search-close aria-label="{{ __('ui.common.back') }}">&larr;</button>
                    <input class="field-input" type="search" data-chat-search-input placeholder="{{ __('ui.common.search') }}" autocomplete="off">
                </div>
                <div class="chat-search-panel__results" data-chat-search-results></div>
            </div>

        </div>

        {{-- DETAILS --}}
        <div class="chat-details-pane" data-chat-details-pane>
            <button type="button" class="icon-btn chat-thread-header__back" data-chat-details-back style="margin:10px 0 0 10px;">&larr;</button>
            <div data-chat-details-content>
                <div class="skeleton skeleton-row" style="margin:12px;"></div>
            </div>
        </div>

    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/chat.js')
@endpush
