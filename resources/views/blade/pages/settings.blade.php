@extends('blade.layouts.authenticated')

@section('title', 'Settings')

@section('content')

    <div class="page-head">
        <div>
            <h1>Settings</h1>
            <p>Personal preferences for how the app looks and formats dates.</p>
        </div>
    </div>

    <div class="settings-section">
        <form data-settings-form novalidate>

            <div class="field-row">
                <div class="field-group">
                    <label class="field-label" for="settings-timezone">Timezone</label>
                    <select class="field-select" id="settings-timezone" name="timezone_id">
                        <option value="">Loading timezones&hellip;</option>
                    </select>
                    <span class="field-error" data-field-error="timezone_id"></span>
                </div>

                <div class="field-group">
                    <label class="field-label" for="settings-locale">Language</label>
                    <select class="field-select" id="settings-locale" name="locale">
                        <option value="en">English</option>
                        <option value="ru">Русский</option>
                        <option value="uz">O'zbekcha</option>
                    </select>
                    <span class="field-error" data-field-error="locale"></span>
                </div>
            </div>

            <div class="field-row">
                <div class="field-group">
                    <label class="field-label" for="settings-theme">Theme</label>
                    <select class="field-select" id="settings-theme" name="theme">
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="system">System</option>
                    </select>
                    <span class="field-error" data-field-error="theme"></span>
                </div>

                <div class="field-group">
                    <label class="field-label" for="settings-time-format">Time format</label>
                    <select class="field-select" id="settings-time-format" name="time_format">
                        <option value="24h">24-hour</option>
                        <option value="12h">12-hour</option>
                    </select>
                    <span class="field-error" data-field-error="time_format"></span>
                </div>
            </div>

            <div class="field-group">
                <label class="field-label" for="settings-date-format">Date format</label>
                <select class="field-select" id="settings-date-format" name="date_format">
                    <option value="Y-m-d">2026-09-14</option>
                    <option value="d.m.Y">14.09.2026</option>
                    <option value="d/m/Y">14/09/2026</option>
                    <option value="m/d/Y">09/14/2026</option>
                </select>
                <span class="field-error" data-field-error="date_format"></span>
            </div>

            <x-blade.u-i.button type="submit" size="sm">
                Save settings
            </x-blade.u-i.button>

        </form>
    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/settings.js')
@endpush
