{{--
    One file in a list — server-rendered twin of fileRowHtml() in
    shared/dropzone.js. `status`: done | uploading | error.

    <x-blade.u-i.file-row :name="$file->original_name" :meta="$sizeLabel" />
    <x-blade.u-i.file-row name="banner.png" status="uploading" :progress="64" />
    <x-blade.u-i.file-row name="video.mp4" status="error" :meta="__('…')" />
--}}
@props([
    'name',
    'meta' => null,
    'status' => 'done',
    'progress' => 0,
    'type' => '',
    'fileId' => '',
])

@php($fileIcon = ['image' => 'image', 'video' => 'play'][explode('/', (string) $type)[0]] ?? 'file')

<div {{ $attributes->class(['file-row', 'file-row--error' => $status === 'error']) }} data-file-row="{{ $fileId }}">
    <span class="file-row__icon"><x-blade.u-i.icon :name="$fileIcon" size="20" /></span>

    <span class="file-row__body">
        <span class="file-row__name">{{ $name }}</span>

        @if ($status === 'uploading')
            <span class="file-row__progress">
                <span class="progress progress--thin grow"><progress class="progress__bar" value="{{ $progress }}" max="100"></progress></span>
                <span>{{ $progress }}%</span>
            </span>
        @elseif ($meta)
            <span class="file-row__meta">{{ $meta }}</span>
        @endif
    </span>

    @if ($status === 'error')
        <button type="button" class="icon-btn icon-btn--sm icon-btn--ghost" data-file-retry="{{ $fileId }}" aria-label="{{ __('ui.components.retry') }}">
            <x-blade.u-i.icon name="refresh" size="18" />
        </button>
    @else
        <button type="button" class="icon-btn icon-btn--sm icon-btn--ghost" data-file-remove="{{ $fileId }}" aria-label="{{ __('ui.components.remove') }}">
            <x-blade.u-i.icon name="trash" size="18" />
        </button>
    @endif
</div>
