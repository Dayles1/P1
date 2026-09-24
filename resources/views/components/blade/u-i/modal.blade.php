{{--
    Static, Blade-declared modal — for content that should exist server-
    rendered in the page from load (toggled via [data-modal-trigger="{id}"] /
    [data-modal-close], wired up in shared/site-chrome.js).

    Most of the app's modals (confirm dialogs, request-log detail, ban form)
    are built dynamically in JS instead (resources/js/blade/shared/modal.js)
    since their content depends on an API response — reach for THIS
    component only when the content is already known at render time.
--}}
<div class="modal-overlay" id="{{ $id }}" data-modal hidden>
    <div class="modal" role="dialog" aria-modal="true" @if ($title) aria-labelledby="{{ $id }}-title" @endif>

        @if ($title)
            <div class="modal__header">
                <h2 class="modal__title" id="{{ $id }}-title">{{ $title }}</h2>
                <button type="button" class="modal__close" data-modal-close aria-label="{{ __('ui.common.close') }}"><x-blade.u-i.icon name="x" size="18" /></button>
            </div>
        @endif

        <div class="modal__body">
            {{ $slot }}
        </div>

        @isset($footer)
            <div class="modal__footer">{{ $footer }}</div>
        @endisset

    </div>
</div>
