@extends('blade.layouts.authenticated')

@section('title', __('ui.chat.title'))
@php($fullBleed = true)
@php($secondarySidebar = 'conversations')

@push('styles')
    {{-- Chat holds live Echo subscriptions torn down on turbo:before-cache
         (see chat.js) — never let Turbo instant-restore a cached snapshot
         of this page with dead subscriptions still wired to its DOM. --}}
    <meta name="turbo-cache-control" content="no-preview">
@endpush

@section('content')

    <div class="chat-shell" data-chat-shell data-view="list">

        {{-- CONVERSATIONS --}}
        <div class="chat-list-pane">
            <div class="chat-list-pane__header">
                <h1 class="chat-list-pane__title">{{ __('ui.chat.chats') }}</h1>

                <div class="chat-list-pane__types" role="group" aria-label="{{ __('ui.chat.filter_label') }}">
                    @foreach (['all', 'private', 'group'] as $chatType)
                        <button type="button" class="chat-list-pane__type" data-chat-type="{{ $chatType }}" aria-pressed="{{ $chatType === 'all' ? 'true' : 'false' }}">
                            {{ __("ui.chat.filter_{$chatType}") }}
                        </button>
                    @endforeach
                </div>

                <button type="button" class="icon-btn icon-btn--sm chat-list-pane__action" data-chat-global-search aria-label="{{ __('ui.chat.search_all') }}" title="{{ __('ui.chat.search_all') }}"><x-blade.u-i.icon name="search" size="15" /></button>

                <x-blade.u-i.dropdown align="right" trigger-class="icon-btn icon-btn--sm" :label="__('ui.chat.new_conversation')">
                    <x-slot:trigger>
                        <x-blade.u-i.icon name="edit" size="15" />
                    </x-slot:trigger>

                    <button type="button" class="menu-item" role="menuitem" data-start-private>
                        <x-blade.u-i.icon name="chat" size="16" class="menu-item__icon" />
                        {{ __('ui.chat.start_private') }}
                        <kbd class="kbd menu-item__end">C</kbd>
                    </button>
                    <button type="button" class="menu-item" role="menuitem" data-start-group>
                        <x-blade.u-i.icon name="users" size="16" class="menu-item__icon" />
                        {{ __('ui.chat.start_group') }}
                    </button>
                </x-blade.u-i.dropdown>
            </div>

            <div class="chat-list-pane__search">
                <label class="field-box field-box--sm">
                    <x-blade.u-i.icon name="search" size="14" class="field-box__icon" />
                    <input class="field-box__input" type="search" data-chat-search placeholder="{{ __('ui.chat.search_placeholder') }}" aria-label="{{ __('ui.chat.search_placeholder') }}" autocomplete="off">
                </label>
            </div>

            <div class="chat-list" data-chat-list>
                <div class="skeleton skeleton-row m-3"></div>
            </div>
        </div>

        {{-- CHAT --}}
        <div class="chat-thread-pane" data-chat-thread-pane>

            <div class="chat-thread-header" data-chat-thread-header hidden>
                <button type="button" class="icon-btn icon-btn--sm chat-thread-header__back" data-chat-back aria-label="{{ __('ui.common.back') }}"><x-blade.u-i.icon name="back" size="18" /></button>
                <span class="avatar avatar--xs" data-chat-thread-avatar>
                    <span class="avatar__initials">--</span>
                </span>
                <div class="chat-thread-header__body">
                    <div class="chat-thread-header__name" data-chat-thread-title></div>
                    <div class="chat-thread-header__status" data-chat-thread-status></div>
                </div>
                <div class="chat-thread-header__actions">
                    <button type="button" class="icon-btn icon-btn--sm" data-chat-search-toggle aria-label="{{ __('ui.common.search') }}" title="{{ __('ui.common.search') }}"><x-blade.u-i.icon name="search" size="16" /></button>
                    <button type="button" class="icon-btn icon-btn--sm chat-thread-header__details" data-chat-details-toggle aria-label="{{ __('ui.chat.details') }}" title="{{ __('ui.chat.details') }}"><x-blade.u-i.icon name="panel" size="16" /></button>
                </div>
            </div>

            <div class="chat-pinned-bar" data-chat-pinned-bar hidden>
                <x-blade.u-i.icon name="pin" size="16" />
                <span class="chat-pinned-bar__text" data-chat-pinned-text></span>
            </div>

            <div class="chat-messages" data-chat-messages>
                <div class="empty-state"><strong>{{ __('ui.chat.empty_thread') }}</strong></div>
            </div>

            <div class="chat-typing" data-chat-typing></div>

            <button type="button" class="chat-scroll-to-bottom" data-chat-scroll-bottom hidden aria-label="{{ __('ui.chat.jump_to_newest') }}" title="{{ __('ui.chat.jump_to_newest') }}"><x-blade.u-i.icon name="chevdown" size="18" /></button>

            <div class="chat-reply-preview" data-chat-reply-preview hidden>
                <div class="chat-reply-preview__body">
                    <span class="chat-reply-preview__label">{{ __('ui.chat.replying_to') }}</span>
                    <span data-chat-reply-preview-text></span>
                </div>
                <button type="button" class="icon-btn btn--sm" data-chat-reply-cancel aria-label="{{ __('ui.common.cancel') }}"><x-blade.u-i.icon name="x" size="16" /></button>
            </div>

            <div class="chat-edit-preview" data-chat-edit-preview hidden>
                <div class="chat-edit-preview__body">
                    <span class="chat-edit-preview__label">{{ __('ui.chat.editing') }}</span>
                </div>
                <button type="button" class="icon-btn btn--sm" data-chat-edit-cancel aria-label="{{ __('ui.common.cancel') }}"><x-blade.u-i.icon name="x" size="16" /></button>
            </div>

            <div class="chat-composer__attachments" data-chat-composer-attachments hidden></div>

            {{-- The text on top, the tools and "Send" in a row below it. --}}
            <form class="chat-composer" data-chat-composer hidden>
                <div class="chat-composer__field relative">
                    <textarea class="chat-composer__input" rows="1" data-chat-input placeholder="{{ __('ui.chat.message_placeholder') }}" aria-label="{{ __('ui.chat.message_placeholder') }}"></textarea>
                    <div class="mention-autocomplete" data-chat-mentions hidden></div>
                </div>
                <div class="chat-composer__tools">
                    <button type="button" class="icon-btn icon-btn--sm" data-chat-attach aria-label="{{ __('ui.chat.attach_file') }}" title="{{ __('ui.chat.attach_file') }}"><x-blade.u-i.icon name="clip" size="16" /></button>
                    <input type="file" multiple hidden data-chat-file-input>
                    <span class="chat-composer__hint"><kbd class="kbd">↵</kbd> {{ __('ui.chat.send_hint') }}</span>
                    <button type="submit" class="chat-composer__send" aria-label="{{ __('ui.common.send') }}" title="{{ __('ui.common.send') }}"><x-blade.u-i.icon name="send" size="15" /></button>
                </div>
            </form>

            <div class="chat-dropzone-overlay">{{ __('ui.chat.drop_files_here') }}</div>

            {{-- Search within this conversation / all conversations --}}
            <div class="chat-search-panel" data-chat-search-panel hidden>
                <div class="chat-search-panel__header">
                    <button type="button" class="icon-btn" data-chat-search-close aria-label="{{ __('ui.common.back') }}"><x-blade.u-i.icon name="back" size="18" /></button>
                    <input class="field-input" type="search" data-chat-search-input placeholder="{{ __('ui.common.search') }}" autocomplete="off">
                </div>
                <div class="chat-search-panel__results" data-chat-search-results></div>
            </div>

        </div>

        {{-- DETAILS --}}
        <div class="chat-details-pane" data-chat-details-pane>
            <div class="chat-details-pane__header">
                <button type="button" class="icon-btn icon-btn--sm chat-details-pane__back" data-chat-details-back aria-label="{{ __('ui.common.back') }}"><x-blade.u-i.icon name="back" size="16" /></button>
                <span class="chat-details-pane__title">{{ __('ui.chat.details') }}</span>
                <button type="button" class="icon-btn icon-btn--sm chat-details-pane__close" data-chat-details-close aria-label="{{ __('ui.common.close') }}"><x-blade.u-i.icon name="x" size="16" /></button>
            </div>
            <div data-chat-details-content>
                <div class="skeleton skeleton-row m-3"></div>
            </div>
        </div>

    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/chat.js')
@endpush
