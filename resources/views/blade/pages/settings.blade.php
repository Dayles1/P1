@extends('blade.layouts.authenticated')

@php($sidebarMode = 'compact')

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

            <div class="settings-nav__group">
                <span class="settings-nav__group-label">{{ __('ui.settings.group_personal') }}</span>

                <button type="button" class="settings-nav__link" data-settings-nav-link="personal-profile">{{ __('ui.settings.nav.profile') }}</button>
                <button type="button" class="settings-nav__link" data-settings-nav-link="personal-appearance">{{ __('ui.settings.nav.appearance') }}</button>
                <button type="button" class="settings-nav__link" data-settings-nav-link="personal-language">{{ __('ui.settings.nav.language_region') }}</button>
                <button type="button" class="settings-nav__link" data-settings-nav-link="personal-notifications">{{ __('ui.settings.nav.notifications') }}</button>
                <button type="button" class="settings-nav__link" data-settings-nav-link="personal-security">{{ __('ui.settings.nav.security') }}</button>
                <button type="button" class="settings-nav__link" data-settings-nav-link="personal-developer">{{ __('ui.settings.nav.developer') }}</button>
            </div>

            <div class="settings-nav__group" data-requires-role="SUPER_ADMIN,ADMIN" hidden>
                <span class="settings-nav__group-label">{{ __('ui.settings.group_application') }}</span>

                <button type="button" class="settings-nav__link" data-settings-nav-link="application-general">{{ __('ui.settings.nav.general') }}</button>
                <button type="button" class="settings-nav__link" data-settings-nav-link="application-authentication">{{ __('ui.settings.nav.authentication') }}</button>
                <button type="button" class="settings-nav__link" data-settings-nav-link="application-localization">{{ __('ui.settings.nav.localization') }}</button>
                <button type="button" class="settings-nav__link" data-settings-nav-link="application-notifications">{{ __('ui.settings.nav.notifications') }}</button>
                <button type="button" class="settings-nav__link" data-settings-nav-link="application-security">{{ __('ui.settings.nav.security') }}</button>
                <button type="button" class="settings-nav__link" data-settings-nav-link="application-system">{{ __('ui.settings.nav.system') }}</button>
            </div>

        </nav>

        <div style="flex:1; min-width:0;">
            <button type="button" class="settings-back-btn" data-settings-back>&larr; {{ __('ui.back') }}</button>

            <div class="settings-panel" data-settings-panel>
                <div class="skeleton skeleton-row" data-settings-panel-loading></div>
            </div>
        </div>

    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/settings.js')
@endpush
