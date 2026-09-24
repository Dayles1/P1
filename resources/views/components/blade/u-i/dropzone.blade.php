{{--
    Drag-and-drop file picker (shared/dropzone.js). Wraps a real file
    input, so click and keyboard work too. Chosen files that pass
    `accept` / `max-size` (bytes) arrive in a `dropzone:files` event.

    <x-blade.u-i.dropzone name="files[]" multiple accept=".pdf,.png,.jpg,.xlsx"
                          :max-size="10 * 1024 * 1024" :hint="'PDF, PNG, JPG, XLSX · …'" />
--}}
@props([
    'name' => 'files[]',
    'accept' => null,
    'maxSize' => null,
    'multiple' => false,
    'hint' => null,
    'id' => null,
])

@php($inputId = $id ?? 'dropzone-'.\Illuminate\Support\Str::random(8))

<div {{ $attributes->class(['dropzone']) }} data-dropzone @if ($maxSize) data-max-size="{{ $maxSize }}" @endif>
    <span class="dropzone__icon"><x-blade.u-i.icon name="upload" size="22" /></span>

    <span class="dropzone__text">
        <strong>{{ __('ui.components.drop_drag') }}</strong>
        {{ __('ui.components.drop_or') }}
        <label class="dropzone__browse" for="{{ $inputId }}">{{ __('ui.components.drop_browse') }}</label>
    </span>

    @if ($hint)
        <span class="dropzone__hint">{{ $hint }}</span>
    @endif

    <span class="dropzone__drop-text" aria-live="polite"></span>

    <input
        type="file"
        id="{{ $inputId }}"
        class="dropzone__input"
        name="{{ $name }}"
        @if ($accept) accept="{{ $accept }}" @endif
        @if ($multiple) multiple @endif
    >
</div>
