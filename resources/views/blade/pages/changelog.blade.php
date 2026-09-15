@extends('blade.layouts.authenticated')

@section('title', __('ui.changelog.title'))

@section('content')

    <div class="page-head">
        <div>
            <h1>{{ __('ui.changelog.title') }}</h1>
            <p>{{ __('ui.changelog.subtitle') }}</p>
        </div>
    </div>

    <div class="card">
        <div class="card__body">
            @foreach ($releases as $release)
                <div class="changelog-entry">
                    <div class="changelog-entry__header">
                        <span class="changelog-entry__version">v{{ $release['version'] }}</span>
                        <span class="changelog-entry__date">{{ $release['date'] }}</span>
                    </div>

                    @foreach ($release['items'] as $item)
                        <div class="changelog-item">
                            <span class="pill changelog-item__badge pill--{{ match ($item['type']) {
                                'new' => 'primary',
                                'fixed' => 'danger',
                                default => 'success',
                            } }}">{{ __('ui.changelog.type_' . $item['type']) }}</span>
                            <span>{{ $item['text'] }}</span>
                        </div>
                    @endforeach
                </div>
            @endforeach
        </div>
    </div>

@endsection
