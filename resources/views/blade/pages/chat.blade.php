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

    {{-- =====================================================
         CHAT — Conversations | Thread | Info
         -----------------------------------------------------
         The list on the left (chats, or everyone in the People tab),
         the open conversation in the middle as message cards — your
         own on the right — and on the right the conversation's info or
         the profile of whoever was clicked. Filled by
         resources/js/blade/app/chat.js.
         ===================================================== --}}
    <div class="chat-shell" data-chat-shell data-view="list">

        {{-- CONVERSATIONS --}}
        <div class="chat-list-pane">
            <div class="chat-list-pane__header">
                <h1 class="chat-list-pane__title">{{ __('ui.chat.chats') }}</h1>

                <button type="button" class="icon-btn icon-btn--sm" data-chat-global-search aria-label="{{ __('ui.chat.search_all') }}" title="{{ __('ui.chat.search_all') }}"><x-blade.u-i.icon name="search" size="15" /></button>

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
                    <hr class="menu-divider">
                    <button type="button" class="menu-item" role="menuitem" data-open-saved>
                        <x-blade.u-i.icon name="bookmark" size="16" class="menu-item__icon" />
                        {{ __('ui.chat.saved_messages') }}
                    </button>
                    <button type="button" class="menu-item" role="menuitem" data-open-archive>
                        <x-blade.u-i.icon name="archive" size="16" class="menu-item__icon" />
                        {{ __('ui.chat.archive') }}
                    </button>
                </x-blade.u-i.dropdown>
            </div>

            <div class="chat-list-pane__search">
                <label class="field-box field-box--sm">
                    <x-blade.u-i.icon name="search" size="14" class="field-box__icon" />
                    <input class="field-box__input" type="search" data-chat-search placeholder="{{ __('ui.chat.search_placeholder') }}" aria-label="{{ __('ui.chat.search_placeholder') }}" autocomplete="off">
                </label>
            </div>

            <div class="chat-list-pane__types" role="tablist" aria-label="{{ __('ui.chat.filter_label') }}">
                @foreach (['all', 'private', 'group', 'people'] as $chatType)
                    <button type="button" class="chat-list-pane__type" role="tab" data-chat-type="{{ $chatType }}" aria-selected="{{ $chatType === 'all' ? 'true' : 'false' }}">
                        {{ __("ui.chat.filter_{$chatType}") }}
                    </button>
                @endforeach
            </div>

            <div class="chat-list" data-chat-list>
                <x-blade.u-i.skeleton :rows="4" />
            </div>

            <div class="chat-list" data-chat-people hidden></div>
        </div>

        {{-- THREAD --}}
        <div class="chat-thread-pane" data-chat-thread-pane>

            <div class="chat-thread-header" data-chat-thread-header hidden>
                <button type="button" class="icon-btn icon-btn--sm chat-thread-header__back" data-chat-back aria-label="{{ __('ui.common.back') }}"><x-blade.u-i.icon name="back" size="18" /></button>
                <button type="button" class="chat-thread-header__who" data-chat-open-info aria-label="{{ __('ui.chat.info') }}">
                    <span class="avatar chat-thread-header__avatar" data-chat-thread-avatar>
                        <span class="avatar__initials">--</span>
                    </span>
                    <span class="chat-thread-header__body">
                        <span class="chat-thread-header__name" data-chat-thread-title></span>
                        <span class="chat-thread-header__status" data-chat-thread-status></span>
                    </span>
                </button>
                <div class="chat-thread-header__actions">
                    <button type="button" class="icon-btn icon-btn--sm" data-chat-search-toggle aria-label="{{ __('ui.common.search') }}" title="{{ __('ui.common.search') }}"><x-blade.u-i.icon name="search" size="16" /></button>
                    <button type="button" class="icon-btn icon-btn--sm" data-chat-header-menu aria-label="{{ __('ui.chat.more') }}" title="{{ __('ui.chat.more') }}"><x-blade.u-i.icon name="more" size="16" /></button>
                    <button type="button" class="icon-btn icon-btn--sm chat-thread-header__details" data-chat-details-toggle aria-label="{{ __('ui.chat.info') }}" title="{{ __('ui.chat.info') }}"><x-blade.u-i.icon name="panel" size="16" /></button>
                </div>
            </div>

            {{-- Selection mode: what is picked and what can be done with it. --}}
            <div class="chat-select-bar" data-chat-select-bar hidden>
                <button type="button" class="icon-btn icon-btn--sm" data-chat-select-cancel aria-label="{{ __('ui.common.cancel') }}" title="Esc"><x-blade.u-i.icon name="x" size="16" /></button>
                <span class="chat-select-bar__count" data-chat-select-count></span>
                <span class="chat-select-bar__actions">
                    <button type="button" class="btn btn--ghost btn--sm" data-chat-select-action="copy"><x-blade.u-i.icon name="copy" size="15" /><span>{{ __('ui.chat.copy') }}</span></button>
                    <button type="button" class="btn btn--ghost btn--sm" data-chat-select-action="forward"><x-blade.u-i.icon name="forward" size="15" /><span>{{ __('ui.chat.menu.forward') }}</span></button>
                    <button type="button" class="btn btn--ghost btn--sm chat-select-bar__danger" data-chat-select-action="delete"><x-blade.u-i.icon name="trash" size="15" /><span>{{ __('ui.common.delete') }}</span></button>
                </span>
            </div>

            {{-- Telegram-style: one pin at a time, a segment per pin on the
                 left; a click jumps to it and moves on to the one before. --}}
            <div class="chat-pinned-bar" data-chat-pinned-bar hidden>
                <button type="button" class="chat-pinned-bar__main" data-chat-pinned-jump>
                    <span class="chat-pinned-bar__segments" data-chat-pinned-segments aria-hidden="true"></span>
                    <span class="chat-pinned-bar__body">
                        <span class="chat-pinned-bar__label" data-chat-pinned-label></span>
                        <span class="chat-pinned-bar__text" data-chat-pinned-text></span>
                    </span>
                </button>
                <button type="button" class="icon-btn icon-btn--sm" data-chat-pinned-list aria-label="{{ __('ui.chat.all_pinned') }}" title="{{ __('ui.chat.all_pinned') }}"><x-blade.u-i.icon name="list" size="16" /></button>
            </div>

            <div class="chat-messages" data-chat-messages role="log" aria-live="polite" aria-relevant="additions">
                <div class="empty-state"><strong>{{ __('ui.chat.empty_thread') }}</strong></div>
            </div>

            <div class="chat-typing" data-chat-typing hidden>
                <span class="chat-typing__dots" aria-hidden="true"><i></i><i></i><i></i></span>
                <span data-chat-typing-text></span>
            </div>

            {{-- Telegram-like floating jumps: to the very first message and
                 to the newest one (with the unread count). --}}
            <div class="chat-jump" data-chat-jump>
                <button type="button" class="chat-jump__btn" data-chat-jump-top hidden aria-label="{{ __('ui.chat.jump.top') }}" title="{{ __('ui.chat.jump.top') }}">
                    <x-blade.u-i.icon name="arrow-up" size="17" />
                </button>
                <button type="button" class="chat-jump__btn chat-scroll-to-bottom" data-chat-scroll-bottom hidden aria-label="{{ __('ui.chat.jump.bottom') }}" title="{{ __('ui.chat.jump.bottom') }}">
                    <x-blade.u-i.icon name="arrow-down" size="17" />
                    <span class="mono chat-scroll-to-bottom__count" data-chat-scroll-bottom-count hidden></span>
                </button>
            </div>

            {{-- Instead of the composer when this chat cannot be written to. --}}
            <div class="chat-blocked" data-chat-blocked hidden>
                <span class="chat-blocked__text" data-chat-blocked-text></span>
                <button type="button" class="btn btn--outline btn--sm" data-chat-unblock hidden>{{ __('ui.chat.block.unblock') }}</button>
            </div>

            {{-- One box: what is being replied to or edited on top, files
                 waiting to go, the text, and the tools under it. --}}
            <form class="chat-composer" data-chat-composer hidden>
                <div class="chat-composer__context" data-chat-reply-preview hidden>
                    <x-blade.u-i.icon name="reply" size="15" class="chat-composer__context-icon" />
                    <span class="chat-composer__context-body">
                        <span class="chat-composer__context-label">{{ __('ui.chat.replying_to') }} <b data-chat-reply-preview-name></b></span>
                        <span class="chat-composer__context-text" data-chat-reply-preview-text></span>
                    </span>
                    <button type="button" class="icon-btn icon-btn--sm" data-chat-reply-cancel aria-label="{{ __('ui.common.cancel') }}"><x-blade.u-i.icon name="x" size="14" /></button>
                </div>

                <div class="chat-composer__context" data-chat-edit-preview hidden>
                    <x-blade.u-i.icon name="edit" size="15" class="chat-composer__context-icon" />
                    <span class="chat-composer__context-body">
                        <span class="chat-composer__context-label">{{ __('ui.chat.editing') }}</span>
                        <span class="chat-composer__context-text" data-chat-edit-preview-text></span>
                    </span>
                    <button type="button" class="icon-btn icon-btn--sm" data-chat-edit-cancel aria-label="{{ __('ui.common.cancel') }}"><x-blade.u-i.icon name="x" size="14" /></button>
                </div>

                <div class="chat-composer__attachments" data-chat-composer-attachments hidden></div>

                <div class="chat-composer__field relative">
                    <textarea class="chat-composer__input" rows="1" data-chat-input placeholder="{{ __('ui.chat.message_placeholder') }}" aria-label="{{ __('ui.chat.message_placeholder') }}"></textarea>
                    <div class="mention-autocomplete" data-chat-mentions hidden></div>
                </div>

                <div class="chat-composer__recording" data-chat-recording hidden>
                    <span class="chat-composer__recording-dot" aria-hidden="true"></span>
                    <span class="mono" data-chat-recording-time>0:00</span>
                    <span class="chat-composer__recording-label">{{ __('ui.chat.recording') }}</span>
                    <button type="button" class="btn btn--ghost btn--sm" data-chat-recording-cancel>{{ __('ui.common.cancel') }}</button>
                </div>

                <div class="chat-composer__tools">
                    <button type="button" class="icon-btn icon-btn--sm" data-chat-attach aria-label="{{ __('ui.chat.attach_file') }}" title="{{ __('ui.chat.attach_file') }}"><x-blade.u-i.icon name="plus" size="16" /></button>
                    <button type="button" class="icon-btn icon-btn--sm" data-chat-emoji aria-label="{{ __('ui.chat.emoji') }}" title="{{ __('ui.chat.emoji') }}"><x-blade.u-i.icon name="smile" size="16" /></button>
                    <button type="button" class="icon-btn icon-btn--sm" data-chat-mention aria-label="{{ __('ui.chat.mention') }}" title="{{ __('ui.chat.mention') }}"><x-blade.u-i.icon name="at" size="16" /></button>
                    <input type="file" multiple hidden data-chat-file-input>
                    <span class="chat-composer__hint"><kbd class="kbd">⇧</kbd><kbd class="kbd">↵</kbd> {{ __('ui.chat.newline_hint') }}</span>
                    <button type="button" class="icon-btn icon-btn--sm chat-composer__mic" data-chat-mic aria-label="{{ __('ui.chat.voice') }}" title="{{ __('ui.chat.voice') }}"><x-blade.u-i.icon name="mic" size="16" /></button>
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

        {{-- INFO: the conversation, or one person's profile --}}
        <div class="chat-details-pane" data-chat-details-pane>
            <div class="chat-details-pane__header">
                <button type="button" class="icon-btn icon-btn--sm" data-chat-details-back aria-label="{{ __('ui.common.back') }}"><x-blade.u-i.icon name="back" size="16" /></button>
                <span class="chat-details-pane__title" data-chat-details-title>{{ __('ui.chat.info') }}</span>
                <button type="button" class="icon-btn icon-btn--sm chat-details-pane__close" data-chat-details-close aria-label="{{ __('ui.common.close') }}"><x-blade.u-i.icon name="x" size="16" /></button>
            </div>
            <div class="chat-details-pane__content" data-chat-details-content>
                <x-blade.u-i.skeleton :rows="3" />
            </div>
        </div>

    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/chat.js')
@endpush
