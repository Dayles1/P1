@extends('blade.layouts.authenticated')

@section('title', 'Profile')

@section('content')

    <div class="page-head">
        <div>
            <h1>Profile</h1>
            <p>Manage your account details and security.</p>
        </div>
    </div>


    {{-- BAN NOTICE --}}
    <div class="alert alert--error" data-ban-notice hidden>
        <span class="alert__icon" aria-hidden="true">!</span>
        <div class="alert__content" data-ban-notice-text></div>
    </div>


    {{-- AVATAR --}}
    <div class="settings-section">
        <h2>Avatar</h2>
        <p>Upload a picture to personalize your account.</p>

        <div class="avatar-upload">
            <span class="avatar avatar--lg" data-profile-avatar>
                <span class="avatar__initials" data-profile-avatar-initials>--</span>
            </span>

            <div>
                <input type="file" id="avatar-file" accept="image/*" hidden data-avatar-input>

                <x-blade.u-i.button variant="secondary" size="sm" type="button" data-avatar-trigger>
                    Upload new avatar
                </x-blade.u-i.button>

                <div class="field-hint" style="margin-top: 8px;">JPG, PNG, WEBP or GIF.</div>
            </div>
        </div>
    </div>


    {{-- PROFILE INFO --}}
    <div class="settings-section">
        <h2>Account details</h2>
        <p>Your name and email address.</p>

        <form data-profile-form novalidate>

            <div class="field-group">
                <label class="field-label" for="profile-name">Name</label>
                <input class="field-input" type="text" id="profile-name" name="name" required>
                <span class="field-error" data-field-error="name"></span>
            </div>

            <div class="field-group">
                <label class="field-label" for="profile-email">Email</label>
                <input class="field-input" type="email" id="profile-email" name="email" required>
                <span class="field-hint">Changing your email will require re-verification.</span>
                <span class="field-error" data-field-error="email"></span>
            </div>

            <div class="field-group" data-current-password-field hidden>
                <label class="field-label" for="profile-current-password">Current password</label>
                <input class="field-input" type="password" id="profile-current-password" name="current_password" autocomplete="current-password">
                <span class="field-hint">Required because you changed your email address.</span>
                <span class="field-error" data-field-error="current_password"></span>
            </div>

            <x-blade.u-i.button type="submit" size="sm">
                Save changes
            </x-blade.u-i.button>

        </form>
    </div>


    {{-- CHANGE PASSWORD --}}
    <div class="settings-section">
        <h2>Change password</h2>
        <p>Use a strong password: at least 8 characters, upper and lower case letters, and a number.</p>

        <form data-password-form novalidate>

            <div class="field-group">
                <label class="field-label" for="password-current">Current password</label>
                <input class="field-input" type="password" id="password-current" name="current_password" autocomplete="current-password" required>
                <span class="field-error" data-field-error="current_password"></span>
            </div>

            <div class="field-row">
                <div class="field-group">
                    <label class="field-label" for="password-new">New password</label>
                    <input class="field-input" type="password" id="password-new" name="password" autocomplete="new-password" required>
                    <span class="field-error" data-field-error="password"></span>
                </div>

                <div class="field-group">
                    <label class="field-label" for="password-confirm">Confirm new password</label>
                    <input class="field-input" type="password" id="password-confirm" name="password_confirmation" autocomplete="new-password" required>
                </div>
            </div>

            <x-blade.u-i.button type="submit" size="sm">
                Update password
            </x-blade.u-i.button>

        </form>
    </div>


    {{-- ROLES --}}
    <div class="settings-section">
        <h2>Roles</h2>
        <p>Assigned by an administrator.</p>

        <div data-profile-roles></div>
    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/profile.js')
@endpush
