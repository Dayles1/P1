@extends('blade.layouts.authenticated')

@section('title', __('ui.settings.title'))

@section('content')

    <div class="page-head">
        <div>
            <h1>{{ __('ui.settings.title') }}</h1>
            <p>{{ __('ui.settings.subtitle') }}</p>
        </div>
    </div>

    <div class="settings-section">
        <form data-settings-form novalidate>

            <div class="field-row">
                <div class="field-group">
                    <label class="field-label" for="settings-timezone">{{ __('ui.settings.timezone') }}</label>
                    <div class="select-field">
                        <select class="field-select" id="settings-timezone" name="timezone_id">
                            <option value="">{{ __('ui.common.loading') }}</option>
                        </select>
                    </div>
                    <span class="field-error" data-field-error="timezone_id"></span>
                </div>

                <div class="field-group">
                    <label class="field-label" for="settings-locale">{{ __('ui.settings.language') }}</label>
                    <div class="select-field">
                        <select class="field-select" id="settings-locale" name="locale">
                            <option value="en">{{ __('ui.locale.en') }}</option>
                            <option value="ru">{{ __('ui.locale.ru') }}</option>
                            <option value="uz">{{ __('ui.locale.uz') }}</option>
                        </select>
                    </div>
                    <span class="field-error" data-field-error="locale"></span>
                </div>
            </div>

            <div class="field-row">
                <div class="field-group">
                    <label class="field-label" for="settings-theme">{{ __('ui.settings.theme') }}</label>
                    <div class="select-field">
                        <select class="field-select" id="settings-theme" name="theme">
                            @foreach (['system', 'light', 'gray', 'dark', 'black', 'green', 'orange'] as $themeOption)
                                <option value="{{ $themeOption }}">{{ __('ui.theme.' . $themeOption) }}</option>
                            @endforeach
                        </select>
                    </div>
                    <span class="field-error" data-field-error="theme"></span>
                </div>

                <div class="field-group">
                    <label class="field-label" for="settings-time-format">{{ __('ui.settings.time_format') }}</label>
                    <div class="select-field">
                        <select class="field-select" id="settings-time-format" name="time_format">
                            <option value="24h">{{ __('ui.settings.time_format_24h') }} — 15:45</option>
                            <option value="12h">{{ __('ui.settings.time_format_12h') }} — 3:45 PM</option>
                        </select>
                    </div>
                    <span class="field-error" data-field-error="time_format"></span>
                </div>
            </div>

            <div class="field-group">
                <label class="field-label" for="settings-date-format">{{ __('ui.settings.date_format') }}</label>
                <div class="select-field">
                    <select class="field-select" id="settings-date-format" name="date_format">
                        <option value="Y-m-d">2026-09-14</option>
                        <option value="d.m.Y">14.09.2026</option>
                        <option value="d/m/Y">14/09/2026</option>
                        <option value="m/d/Y">09/14/2026</option>
                    </select>
                </div>
                <span class="field-error" data-field-error="date_format"></span>
            </div>

            <x-blade.u-i.button type="submit" size="sm">
                {{ __('ui.settings.save') }}
            </x-blade.u-i.button>

        </form>
    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/settings.js')
@endpush
