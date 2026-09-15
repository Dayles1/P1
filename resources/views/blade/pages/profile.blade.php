@extends('blade.layouts.authenticated')

@php($narrow = true)

@section('title', __('ui.profile.title'))

@section('content')

    <div class="page-head">
        <div>
            <h1>{{ __('ui.profile.title') }}</h1>
            <p>{{ __('ui.profile.subtitle') }}</p>
        </div>
    </div>


    {{-- BAN NOTICE --}}
    <div class="alert alert--error" data-ban-notice hidden>
        <span class="alert__icon" aria-hidden="true">!</span>
        <div class="alert__content" data-ban-notice-text></div>
    </div>


    {{-- AVATAR --}}
    <div class="settings-section">
        <h2>{{ __('ui.profile.avatar') }}</h2>
        <p>{{ __('ui.profile.avatar_hint') }}</p>

        <div class="avatar-upload">
            <span class="avatar avatar--lg" data-profile-avatar>
                <span class="avatar__initials" data-profile-avatar-initials>--</span>
            </span>

            <div>
                <input type="file" id="avatar-file" accept="image/*" hidden data-avatar-input>

                <x-blade.u-i.button variant="secondary" size="sm" type="button" data-avatar-trigger>
                    {{ __('ui.profile.avatar_upload') }}
                </x-blade.u-i.button>

                <div class="field-hint" style="margin-top: 8px;">{{ __('ui.profile.avatar_formats') }}</div>
            </div>
        </div>
    </div>


    {{-- PROFILE INFO --}}
    <div class="settings-section">
        <h2>{{ __('ui.profile.account_details') }}</h2>
        <p>{{ __('ui.profile.account_details_hint') }}</p>

        <form data-profile-form novalidate>

            <div class="field-group">
                <label class="field-label" for="profile-name">{{ __('ui.profile.name') }}</label>
                <input class="field-input" type="text" id="profile-name" name="name" required>
                <span class="field-error" data-field-error="name"></span>
            </div>

            <div class="field-group">
                <label class="field-label" for="profile-email">{{ __('ui.profile.email') }}</label>
                <input class="field-input" type="email" id="profile-email" name="email" required>
                <span class="field-hint">{{ __('ui.profile.email_change_hint') }}</span>
                <span class="field-error" data-field-error="email"></span>
            </div>

            <div class="field-group" data-current-password-field hidden>
                <label class="field-label" for="profile-current-password">{{ __('ui.profile.current_password') }}</label>
                <input class="field-input" type="password" id="profile-current-password" name="current_password" autocomplete="current-password">
                <span class="field-hint">{{ __('ui.profile.current_password_hint') }}</span>
                <span class="field-error" data-field-error="current_password"></span>
            </div>

            <x-blade.u-i.button type="submit" size="sm">
                {{ __('ui.profile.save_changes') }}
            </x-blade.u-i.button>

        </form>
    </div>


    {{-- CHANGE PASSWORD --}}
    <div class="settings-section">
        <h2>{{ __('ui.profile.change_password') }}</h2>
        <p>{{ __('ui.profile.change_password_hint') }}</p>

        <form data-password-form novalidate>

            <div class="field-group">
                <label class="field-label" for="password-current">{{ __('ui.profile.current_password') }}</label>
                <input class="field-input" type="password" id="password-current" name="current_password" autocomplete="current-password" required>
                <span class="field-error" data-field-error="current_password"></span>
            </div>

            <div class="field-row">
                <div class="field-group">
                    <label class="field-label" for="password-new">{{ __('ui.profile.new_password') }}</label>
                    <input class="field-input" type="password" id="password-new" name="password" autocomplete="new-password" required>
                    <span class="field-error" data-field-error="password"></span>
                </div>

                <div class="field-group">
                    <label class="field-label" for="password-confirm">{{ __('ui.profile.confirm_password') }}</label>
                    <input class="field-input" type="password" id="password-confirm" name="password_confirmation" autocomplete="new-password" required>
                </div>
            </div>

            <x-blade.u-i.button type="submit" size="sm">
                {{ __('ui.profile.update_password') }}
            </x-blade.u-i.button>

        </form>
    </div>


    {{-- ROLES --}}
    <div class="settings-section">
        <h2>{{ __('ui.profile.roles') }}</h2>
        <p>{{ __('ui.profile.roles_hint') }}</p>

        <div data-profile-roles></div>
    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/profile.js')
@endpush
