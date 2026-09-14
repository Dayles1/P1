@extends('blade.layouts.app')

@section('title', __('ui.errors.' . $code . '_title'))

@section('content')
    <div class="error-page">
        <span class="error-page__code">{{ $code }}</span>
        <h1 class="error-page__title">{{ __('ui.errors.' . $code . '_title') }}</h1>
        <p class="error-page__message">{{ __('ui.errors.' . $code . '_message') }}</p>

        <div class="error-page__actions">
            <a href="{{ url()->previous() !== url()->current() ? url()->previous() : route('home') }}" class="btn btn--outline btn--sm">
                {{ __('ui.errors.go_back') }}
            </a>
            <a href="{{ route('home') }}" class="btn btn--primary btn--sm">
                {{ __('ui.errors.go_home') }}
            </a>
        </div>
    </div>
@endsection
