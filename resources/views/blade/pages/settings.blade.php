@extends('blade.layouts.authenticated')

@php($wide = true)

@section('title', __('ui.settings.title'))

@section('content')

    <div class="page-head">
        <div>
            <h1>{{ __('ui.settings.title') }}</h1>
            <p>{{ __('ui.settings.subtitle') }}</p>
        </div>
    </div>

    <div class="settings-app" data-settings-app>

        <nav class="settings-nav" data-settings-nav aria-label="{{ __('ui.settings.title') }}">
            <button type="button" class="settings-nav__link" data-settings-nav-link="general">{{ __('ui.settings.nav.general') }}</button>
            <button type="button" class="settings-nav__link" data-settings-nav-link="appearance">{{ __('ui.settings.nav.appearance') }}</button>
            <button type="button" class="settings-nav__link" data-settings-nav-link="localization">{{ __('ui.settings.nav.localization') }}</button>
            <button type="button" class="settings-nav__link" data-settings-nav-link="notifications">{{ __('ui.settings.nav.notifications') }}</button>
            <button
                type="button"
                class="settings-nav__link"
                data-settings-nav-link="authentication"
                data-requires-role="SUPER_ADMIN,ADMIN"
                hidden
            >{{ __('ui.settings.nav.authentication') }}</button>
            <button
                type="button"
                class="settings-nav__link"
                data-settings-nav-link="security"
                data-requires-role="SUPER_ADMIN,ADMIN"
                hidden
            >{{ __('ui.settings.nav.security') }}</button>
            <button
                type="button"
                class="settings-nav__link"
                data-settings-nav-link="system"
                data-requires-role="SUPER_ADMIN,ADMIN"
                hidden
            >{{ __('ui.settings.nav.system') }}</button>
            <button type="button" class="settings-nav__link" data-settings-nav-link="developer">{{ __('ui.settings.nav.developer') }}</button>
        </nav>

        <div class="settings-panel" data-settings-panel>
            <div class="skeleton skeleton-row" data-settings-panel-loading></div>
        </div>

    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/settings.js')
@endpush
