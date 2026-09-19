import { api } from '../axios';
import { fetchCurrentUser, hasRole, initials } from '../shared/auth-state';
import {
    apiErrors,
    clearFieldErrors,
    escapeHtml,
    showFieldErrors,
} from '../shared/forms';
import { t } from '../shared/i18n';
import { writeLocaleCookie, getLocale } from '../shared/i18n';
import { bootOnPage } from '../shared/page-boot';
import { renderThemeGrid } from '../shared/theme-picker';
import { showToast, apiErrorMessage } from '../shared/toast';
import {
    getUserSettings,
    invalidateUserSettings,
} from '../shared/user-settings-cache';

let currentCleanup = null;

/**
 * Where a user belongs when the URL names no section this page can
 * render — and where a non-admin is sent back to from /admin/settings/*.
 */
const DEFAULT_SECTION = 'personal-profile';

/**
 * Turbo is what actually moves between sections now that each one is a
 * real route; this only exists so the two places below that navigate
 * *programmatically* degrade to a plain load if Turbo isn't up yet.
 */
function navigate(url) {
    if (window.Turbo) {
        window.Turbo.visit(url, { action: 'replace' });

        return;
    }

    window.location.replace(url);
}

/**
 * Everything below used to run once at module top level. Under Turbo
 * Drive, `<main>` (and everything in it) is replaced by fresh server
 * HTML on every navigation, but this module is only ever evaluated once
 * per session — so all of this is wrapped in `boot()` and re-run via
 * `bootOnPage` on every `turbo:load` that lands on /settings, re-
 * querying the (new) DOM each time instead of operating on detached
 * nodes from a previous visit. The AbortController lets `teardown()`
 * remove all of this visit's listeners in one shot before the next one
 * registers a fresh set.
 */
function boot() {
    const controller = new AbortController();
    const { signal } = controller;

    // Registered up front rather than at the end of boot(): the legacy-hash
    // and non-admin branches below both leave early, and teardown still has
    // to be able to unwind whatever this visit already registered.
    currentCleanup = () => controller.abort();

    const panel = document.querySelector('[data-settings-panel]');

    // Which raw admin settings (by key) render via the generic boolean/
    // integer/text control inside each Application section — special keys
    // (roles, default role, locales, favicon) are excluded here and get
    // bespoke widgets instead.
    const SECTION_ADMIN_KEYS = {
        'application-general': ['system.site_name', 'system.timezone'],
        'application-authentication': [
            'auth.registration_open',
            'auth.login_open',
            'auth.email_verification_required',
            'auth.remember_me_enabled',
            'auth.session_lifetime',
        ],
        'application-localization': [
            'localization.allow_locale_switch',
            'localization.auto_detect_browser_locale',
        ],
        'application-notifications': [
            'notification.database',
            'notification.email',
            'notification.telegram',
            'notification.push',
            'notification.sms',
        ],
        'application-security': [
            'auth.max_register_users_count',
            'auth.max_users_count',
            'auth.max_login_attempts',
            'auth.lockout_minutes',
            'auth.protect_superadmin',
            'security.enable_api',
            'security.audit_log',
        ],
        'application-system': [
            'upload.max_upload_size',
            'upload.allowed_extensions',
            'upload.allowed_mime_types',
            'upload.max_image_width',
            'upload.max_image_height',
            'upload.max_video_size',
            'upload.max_document_size',
            'upload.image_quality',
            'user.allow_avatar_upload',
            'user.default_avatar',
            'user.max_avatar_size',
            'user.allow_profile_edit',
            'user.allow_delete_account',
            'user.allow_change_email',
            'user.allow_change_username',
        ],
    };

    const ADMIN_SECTIONS = new Set(Object.keys(SECTION_ADMIN_KEYS));

    const state = {
        isAdmin: false,
        personal: null,
        profile: null,
        timezones: [],
        languages: [],
        currencies: [],
        currencyMeta: { baseCode: null, ratesAsOf: null },
        roles: [],
        adminSettingsByKey: new Map(),
    };

    /*
    |--------------------------------------------------------------------------
    | Data loading
    |--------------------------------------------------------------------------
    |
    | A section is a whole page of its own now, so it loads what it needs
    | and nothing else — the old single page had to fetch every endpoint
    | up front because any section could be shown next without another
    | request. `getUserSettings()` is shared/cached per page load
    | (user-settings-cache.js), the rest is one request each.
    |
    */

    const LOADERS = {
        personal: async () => {
            state.personal = await getUserSettings(api);
        },
        profile: async () => {
            state.profile = (await api.get('/profile')).data.data;
        },
        timezones: async () => {
            state.timezones = (await api.get('/timezones')).data.data || [];
        },
        languages: async () => {
            state.languages = (await api.get('/languages')).data.data || [];
        },
        currencies: async () => {
            const { data } = await api.get('/currencies');

            state.currencies = data.data || [];
            state.currencyMeta = {
                baseCode: data.base_code,
                ratesAsOf: data.rates_as_of,
            };
        },
        roles: async () => {
            state.roles = (await api.get('/roles')).data.data || [];
        },
        adminSettings: async () => {
            const groups = (await api.get('/admin/settings')).data.data || [];

            groups.forEach((group) =>
                group.items.forEach((item) =>
                    state.adminSettingsByKey.set(item.key, item),
                ),
            );
        },
    };

    const SECTION_DATA = {
        'personal-profile': ['profile'],
        'personal-appearance': [],
        'personal-language': [
            'personal',
            'timezones',
            'languages',
            'currencies',
        ],
        'personal-notifications': ['personal'],
        'personal-security': ['personal'],
        'personal-developer': ['personal'],
        'application-general': ['adminSettings'],
        'application-authentication': ['adminSettings', 'roles'],
        'application-localization': [
            'adminSettings',
            'languages',
            'currencies',
        ],
        'application-notifications': ['adminSettings'],
        'application-security': ['adminSettings'],
        'application-system': ['adminSettings'],
    };

    // allSettled, not all: one endpoint being down should degrade that
    // part of the section (an empty timezone list), not blank the page.
    function loadFor(section) {
        return Promise.allSettled(
            (SECTION_DATA[section] || []).map((key) => LOADERS[key]()),
        );
    }

    function adminSetting(key) {
        return state.adminSettingsByKey.get(key);
    }

    /*
    |--------------------------------------------------------------------------
    | Human labels for generic settings — a raw key like
    | `auth.session_lifetime` is developer/implementation detail, not
    | product copy. `settings.keys.<key with dots as underscores>` (+
    | `_hint`) supplies the real label; falling back to a humanized version
    | of the key itself only if a translation is genuinely missing. The raw
    | key stays visible in small monospace text, but only in Developer Mode
    | (see the `.settings-row__key` CSS rule).
    |--------------------------------------------------------------------------
    */

    function humanizeSettingKey(key) {
        return key
            .split('.')
            .pop()
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    function settingLabel(setting) {
        const labelKey = `settings.keys.${setting.key.replace('.', '_')}`;
        const label = t(labelKey);

        return label === labelKey ? humanizeSettingKey(setting.key) : label;
    }

    function settingHint(setting) {
        const hintKey = `settings.keys.${setting.key.replace('.', '_')}_hint`;
        const hint = t(hintKey);

        return hint === hintKey ? '' : hint;
    }

    /*
    |--------------------------------------------------------------------------
    | Generic admin control (boolean / integer / text / json)
    |--------------------------------------------------------------------------
    */

    function genericControlHtml(setting) {
        const id = `setting-${setting.id}`;
        const requiredAttr = setting.is_required ? 'data-required="true"' : '';

        if (setting.type === 'boolean') {
            return `
                <div class="select-field" style="max-width:160px;">
                    <select class="field-select" id="${id}" data-setting-value data-type="boolean">
                        <option value="true" ${setting.value ? 'selected' : ''}>${t('common.yes')}</option>
                        <option value="false" ${!setting.value ? 'selected' : ''}>${t('common.no')}</option>
                    </select>
                </div>
            `;
        }

        if (setting.type === 'integer') {
            return `<input class="field-input" id="${id}" type="number" data-setting-value data-type="integer" value="${setting.value ?? 0}" style="max-width:160px;">`;
        }

        if (setting.type === 'json') {
            return `<textarea class="field-input" id="${id}" data-setting-value data-type="json" ${requiredAttr} rows="3" style="max-width:360px; height:auto;">${escapeHtml(JSON.stringify(setting.value ?? [], null, 2))}</textarea>`;
        }

        return `<input class="field-input" id="${id}" type="text" data-setting-value data-type="${setting.type}" ${requiredAttr} value="${escapeHtml(setting.value ?? '')}" style="max-width:360px;">`;
    }

    function genericSettingRow(setting) {
        const label = settingLabel(setting);
        const hint = settingHint(setting);

        return `
            <div class="settings-row" data-setting-row="${setting.id}">
                <div class="settings-row__main">
                    <div class="settings-row__title">
                        ${escapeHtml(label)}
                        ${setting.is_locked ? `<span class="pill pill--muted">${t('admin.locked')}</span>` : ''}
                    </div>
                    ${hint ? `<div class="settings-row__hint">${escapeHtml(hint)}</div>` : ''}
                    <div class="settings-row__key">${setting.key}</div>
                </div>
                <div class="settings-row__actions">
                    ${genericControlHtml(setting)}
                    <button type="button" class="btn btn--secondary btn--sm" data-save-setting="${setting.id}" ${setting.is_locked ? 'disabled' : ''}>${t('common.save')}</button>
                </div>
            </div>
        `;
    }

    function genericSettingsBlock(keys) {
        const settings = keys.map(adminSetting).filter(Boolean);

        if (!settings.length) {
            return '';
        }

        return `<div>${settings.map(genericSettingRow).join('')}</div>`;
    }

    /*
    |--------------------------------------------------------------------------
    | Personal setting auto-save
    |--------------------------------------------------------------------------
    */

    async function savePersonal(payload, { onSuccess } = {}) {
        try {
            const { data } = await api.put('/profile/settings', payload);

            // Replace wholesale from the server's response rather than merging
            // the raw payload client-side — `timezone_id` (what we send) and
            // `timezone` (the nested object we render from) don't share a
            // shape, so a naive merge would leave stale data behind.
            state.personal = data.data;
            invalidateUserSettings();
            onSuccess?.();
            showToast(t('settings.saved'));
        } catch (error) {
            showToast(apiErrorMessage(error, t('settings.error')), 'error');
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Section: Personal -> Profile (merged in from the old standalone
    | /profile page — this is now Settings' first, always-visible section).
    |--------------------------------------------------------------------------
    */

    function banMessage(ban) {
        let message = ban.reason
            ? t('profile.banned_notice_reason', { reason: ban.reason })
            : t('profile.banned_notice');

        if (ban.ends_at) {
            message += t('profile.banned_notice_until', { date: ban.ends_at });
        }

        return message;
    }

    function rolesHtml(profile) {
        if (!profile?.roles?.length) {
            return `<span class="field-hint">${t('profile.no_roles')}</span>`;
        }

        return profile.roles
            .map(
                (role) =>
                    `<span class="pill pill--primary" style="margin-right:6px;">${escapeHtml(role.name)}</span>`,
            )
            .join('');
    }

    function renderProfile() {
        const p = state.profile;

        const avatarInner = p?.avatar?.url
            ? `<img class="avatar__image" src="${escapeHtml(p.avatar.url)}" alt="${escapeHtml(p.name || '')}">`
            : `<span class="avatar__initials" data-profile-avatar-initials>${escapeHtml(initials(p?.name || ''))}</span>`;

        return `
            ${
                p?.ban?.is_active
                    ? `
                <div class="alert alert--error" style="margin-bottom:20px;">
                    <span class="alert__icon" aria-hidden="true">!</span>
                    <div class="alert__content">${escapeHtml(banMessage(p.ban))}</div>
                </div>
            `
                    : ''
            }

            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('profile.avatar')}</h2>
                <p class="settings-panel__section-hint">${t('profile.avatar_hint')}</p>

                <div class="avatar-upload">
                    <span class="avatar avatar--lg" data-profile-avatar>${avatarInner}</span>

                    <div>
                        <input type="file" accept="image/*" hidden data-avatar-input>
                        <button type="button" class="btn btn--secondary btn--sm" data-avatar-trigger>${t('profile.avatar_upload')}</button>
                        <div class="field-hint" style="margin-top:8px;">${t('profile.avatar_formats')}</div>
                    </div>
                </div>
            </div>

            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('profile.account_details')}</h2>
                <p class="settings-panel__section-hint">${t('profile.account_details_hint')}</p>

                <form data-profile-form novalidate>
                    <div class="field-group">
                        <label class="field-label" for="profile-name">${t('profile.name')}</label>
                        <input class="field-input" type="text" id="profile-name" name="name" value="${escapeHtml(p?.name || '')}" required>
                        <span class="field-error" data-field-error="name"></span>
                    </div>

                    <div class="field-group">
                        <label class="field-label" for="profile-email">${t('profile.email')}</label>
                        <input class="field-input" type="email" id="profile-email" name="email" value="${escapeHtml(p?.email || '')}" required>
                        <span class="field-hint">${t('profile.email_change_hint')}</span>
                        <span class="field-error" data-field-error="email"></span>
                    </div>

                    <div class="field-group" data-current-password-field hidden>
                        <label class="field-label" for="profile-current-password">${t('profile.current_password')}</label>
                        <input class="field-input" type="password" id="profile-current-password" name="current_password" autocomplete="current-password">
                        <span class="field-hint">${t('profile.current_password_hint')}</span>
                        <span class="field-error" data-field-error="current_password"></span>
                    </div>

                    <button type="submit" class="btn btn--secondary btn--sm">${t('profile.save_changes')}</button>
                </form>
            </div>

            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('profile.change_password')}</h2>
                <p class="settings-panel__section-hint">${t('profile.change_password_hint')}</p>

                <form data-password-form novalidate>
                    <div class="field-group">
                        <label class="field-label" for="password-current">${t('profile.current_password')}</label>
                        <input class="field-input" type="password" id="password-current" name="current_password" autocomplete="current-password" required>
                        <span class="field-error" data-field-error="current_password"></span>
                    </div>

                    <div class="field-row">
                        <div class="field-group">
                            <label class="field-label" for="password-new">${t('profile.new_password')}</label>
                            <input class="field-input" type="password" id="password-new" name="password" autocomplete="new-password" required>
                            <span class="field-error" data-field-error="password"></span>
                        </div>

                        <div class="field-group">
                            <label class="field-label" for="password-confirm">${t('profile.confirm_password')}</label>
                            <input class="field-input" type="password" id="password-confirm" name="password_confirmation" autocomplete="new-password" required>
                        </div>
                    </div>

                    <button type="submit" class="btn btn--secondary btn--sm">${t('profile.update_password')}</button>
                </form>
            </div>

            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('profile.roles')}</h2>
                <p class="settings-panel__section-hint">${t('profile.roles_hint')}</p>
                <div data-profile-roles>${rolesHtml(p)}</div>
            </div>
        `;
    }

    function wireProfile() {
        const profileForm = panel.querySelector('[data-profile-form]');
        const passwordForm = panel.querySelector('[data-password-form]');
        const currentPasswordField = panel.querySelector(
            '[data-current-password-field]',
        );
        const avatarEl = panel.querySelector('[data-profile-avatar]');
        const avatarInput = panel.querySelector('[data-avatar-input]');
        const avatarTrigger = panel.querySelector('[data-avatar-trigger]');
        const rolesEl = panel.querySelector('[data-profile-roles]');

        profileForm?.querySelector('[name="email"]')?.addEventListener(
            'input',
            (event) => {
                const changed =
                    state.profile && event.target.value !== state.profile.email;

                currentPasswordField.hidden = !changed;
            },
            { signal },
        );

        profileForm?.addEventListener(
            'submit',
            async (event) => {
                event.preventDefault();
                clearFieldErrors(profileForm);

                const formData = new FormData(profileForm);
                const payload = Object.fromEntries(formData.entries());

                if (!payload.current_password) {
                    delete payload.current_password;
                }

                const submitButton = profileForm.querySelector(
                    'button[type="submit"]',
                );
                submitButton.disabled = true;

                try {
                    const { data } = await api.patch('/profile', payload);

                    state.profile = data.data;
                    rolesEl.innerHTML = rolesHtml(state.profile);
                    currentPasswordField.hidden = true;
                    profileForm.querySelector(
                        '[name="current_password"]',
                    ).value = '';

                    showToast(t('profile.updated'));
                } catch (error) {
                    showFieldErrors(profileForm, apiErrors(error));
                    showToast(
                        apiErrorMessage(error, t('profile.save_error')),
                        'error',
                    );
                } finally {
                    submitButton.disabled = false;
                }
            },
            { signal },
        );

        passwordForm?.addEventListener(
            'submit',
            async (event) => {
                event.preventDefault();
                clearFieldErrors(passwordForm);

                const formData = new FormData(passwordForm);
                const payload = Object.fromEntries(formData.entries());

                const submitButton = passwordForm.querySelector(
                    'button[type="submit"]',
                );
                submitButton.disabled = true;

                try {
                    await api.patch('/profile', payload);
                    passwordForm.reset();
                    showToast(t('profile.password_updated'));
                } catch (error) {
                    showFieldErrors(passwordForm, apiErrors(error));
                    showToast(
                        apiErrorMessage(error, t('profile.password_error')),
                        'error',
                    );
                } finally {
                    submitButton.disabled = false;
                }
            },
            { signal },
        );

        avatarTrigger?.addEventListener('click', () => avatarInput?.click(), {
            signal,
        });

        avatarInput?.addEventListener(
            'change',
            async () => {
                const file = avatarInput.files?.[0];

                if (!file) {
                    return;
                }

                const formData = new FormData();
                formData.append('file', file);

                avatarTrigger.disabled = true;

                try {
                    const { data } = await api.post(
                        '/profile/avatars',
                        formData,
                        { headers: { 'Content-Type': 'multipart/form-data' } },
                    );

                    if (data.data?.url) {
                        avatarEl.innerHTML = `<img class="avatar__image" src="${data.data.url}" alt="avatar">`;
                    }

                    showToast(t('profile.avatar_updated'));
                } catch (error) {
                    showToast(
                        apiErrorMessage(error, t('profile.avatar_error')),
                        'error',
                    );
                } finally {
                    avatarTrigger.disabled = false;
                    avatarInput.value = '';
                }
            },
            { signal },
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Section: Personal -> Appearance
    |--------------------------------------------------------------------------
    */

    function renderAppearance() {
        return `
            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('settings.nav.appearance')}</h2>
                <p class="settings-panel__section-hint">${t('theme.picker_subtitle')}</p>
                <div data-theme-grid></div>
            </div>
        `;
    }

    function wireAppearance() {
        const grid = panel.querySelector('[data-theme-grid]');

        if (grid) {
            renderThemeGrid(grid);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Section: Personal -> Language & Region (personal locale + a searchable
    | timezone picker + date/time format — the personal half of what used
    | to be split across "General" and "Localization").
    |--------------------------------------------------------------------------
    */

    function languageOptions(selectedCode) {
        return state.languages
            .map(
                (lang) =>
                    `<option value="${lang.code}" ${lang.code === selectedCode ? 'selected' : ''}>${escapeHtml(lang.name)}</option>`,
            )
            .join('');
    }

    function currencyLabel(currency) {
        return currency.symbol
            ? `${currency.code} — ${currency.name} (${currency.symbol})`
            : `${currency.code} — ${currency.name}`;
    }

    /**
     * An empty value means "whatever the app currency is" rather than
     * "no currency", so the first option says which one that is.
     */
    function currencyOptions(selectedId, { includeFollowApp = true } = {}) {
        const options = state.currencies.map(
            (currency) =>
                `<option value="${currency.id}" ${String(currency.id) === String(selectedId ?? '') ? 'selected' : ''}>${escapeHtml(currencyLabel(currency))}</option>`,
        );

        if (!includeFollowApp) {
            return options.join('');
        }

        return (
            `<option value="">${escapeHtml(t('settings.currency_follows_app', { code: state.currencyMeta.baseCode || '' }))}</option>` +
            options.join('')
        );
    }

    function currencyCodeOptions(selectedCode) {
        return state.currencies
            .map(
                (currency) =>
                    `<option value="${currency.code}" ${currency.code === selectedCode ? 'selected' : ''}>${escapeHtml(currencyLabel(currency))}</option>`,
            )
            .join('');
    }

    function timezoneDisplayLabel(tz) {
        return `${tz.label || tz.name} (${tz.offset})`;
    }

    function renderLanguageRegion() {
        const p = state.personal;
        const dateFormats = ['Y-m-d', 'd.m.Y', 'd/m/Y', 'm/d/Y'];
        const timeFormats = ['24h', '12h'];
        const selectedTz = state.timezones.find(
            (tz) => String(tz.id) === String(p?.timezone?.id),
        );

        return `
            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('settings.nav.language_region')}</h2>
                <p class="settings-panel__section-hint">${t('settings.language_region_hint')}</p>

                <div class="field-group" style="max-width:320px;">
                    <label class="field-label">${t('ui.locale.label')}</label>
                    <div class="select-field">
                        <select class="field-select" data-personal-locale>${languageOptions(state.personal?.locale || getLocale())}</select>
                    </div>
                </div>

                <div class="field-group" style="max-width:320px; position:relative;">
                    <label class="field-label" for="timezone-search">${t('settings.timezone')}</label>
                    <input
                        class="field-input"
                        type="text"
                        id="timezone-search"
                        data-timezone-search
                        autocomplete="off"
                        placeholder="${t('settings.timezone_search_placeholder')}"
                        value="${selectedTz ? escapeHtml(timezoneDisplayLabel(selectedTz)) : ''}"
                    >
                    <input type="hidden" data-personal="timezone_id" value="${p?.timezone?.id ?? ''}">
                    <div class="timezone-dropdown" data-timezone-dropdown hidden></div>
                </div>

                <div class="field-group" style="max-width:320px;">
                    <label class="field-label">${t('settings.currency')}</label>
                    <div class="select-field">
                        <select class="field-select" data-personal="preferred_currency_id">${currencyOptions(p?.currency?.id)}</select>
                    </div>
                    <p class="settings-panel__section-hint" style="margin:6px 0 0;" data-currency-rate></p>
                </div>

                <div class="field-row">
                    <div class="field-group">
                        <label class="field-label">${t('settings.time_format')}</label>
                        <div class="select-field">
                            <select class="field-select" data-personal="time_format">
                                ${timeFormats.map((f) => `<option value="${f}" ${f === p?.time_format ? 'selected' : ''}>${t(`settings.time_format_${f}`)}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="field-group">
                        <label class="field-label">${t('settings.date_format')}</label>
                        <div class="select-field">
                            <select class="field-select" data-personal="date_format">
                                ${dateFormats.map((f) => `<option value="${f}" ${f === p?.date_format ? 'selected' : ''}>${f}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function wireLanguageRegion() {
        panel.querySelector('[data-personal-locale]')?.addEventListener(
            'change',
            async (event) => {
                const locale = event.target.value;
                const select = event.target;

                select.disabled = true;
                writeLocaleCookie(locale);

                try {
                    await api.put('/profile/settings', { locale });
                } catch (error) {
                    showToast(
                        apiErrorMessage(error, t('settings.error')),
                        'error',
                    );
                    select.disabled = false;

                    return;
                }

                window.location.reload();
            },
            { signal },
        );

        panel
            .querySelectorAll(
                '[data-personal="time_format"], [data-personal="date_format"]',
            )
            .forEach((el) => {
                el.addEventListener(
                    'change',
                    () => savePersonal({ [el.dataset.personal]: el.value }),
                    { signal },
                );
            });

        const currencySelect = panel.querySelector(
            '[data-personal="preferred_currency_id"]',
        );
        const currencyRate = panel.querySelector('[data-currency-rate]');

        /**
         * What one unit of the app currency is worth in the chosen one,
         * and which day's rate that is — so the choice shows what it
         * actually does instead of just being a label.
         */
        async function showCurrencyRate() {
            if (!currencyRate) {
                return;
            }

            const base = state.currencyMeta.baseCode;
            const code = state.currencies.find(
                (currency) =>
                    String(currency.id) === String(currencySelect?.value),
            )?.code;

            if (!base || !code || code === base) {
                currencyRate.textContent = base
                    ? t('settings.currency_is_app_currency', { code: base })
                    : '';

                return;
            }

            try {
                const { data } = await api.get('/currencies/convert', {
                    params: { amount: 1, from: base, to: code },
                });

                currencyRate.textContent = t('settings.currency_rate', {
                    from: base,
                    amount: data.data.converted,
                    to: code,
                    date: data.data.as_of ?? '',
                });
            } catch {
                currencyRate.textContent = t('settings.currency_rate_missing', {
                    code,
                });
            }
        }

        currencySelect?.addEventListener(
            'change',
            () => {
                savePersonal({
                    preferred_currency_id: currencySelect.value || null,
                });
                showCurrencyRate();
            },
            { signal },
        );

        showCurrencyRate();

        const searchInput = panel.querySelector('[data-timezone-search]');
        const hiddenInput = panel.querySelector(
            '[data-personal="timezone_id"]',
        );
        const dropdown = panel.querySelector('[data-timezone-dropdown]');

        function renderTimezoneOptions(query) {
            const q = query.trim().toLowerCase();
            const matches = !q
                ? state.timezones
                : state.timezones.filter(
                      (tz) =>
                          tz.name.toLowerCase().includes(q) ||
                          (tz.label || '').toLowerCase().includes(q) ||
                          tz.offset.toLowerCase().includes(q),
                  );

            if (!matches.length) {
                dropdown.innerHTML = `<div class="timezone-dropdown__empty">${t('settings.timezone_search_empty')}</div>`;

                return;
            }

            dropdown.innerHTML = matches
                .slice(0, 50)
                .map(
                    (tz) => `
                <button type="button" class="timezone-dropdown__item" data-timezone-option="${tz.id}">
                    <span>${escapeHtml(tz.label || tz.name)}</span>
                    <span class="timezone-dropdown__offset">${escapeHtml(tz.offset)}</span>
                </button>
            `,
                )
                .join('');
        }

        searchInput?.addEventListener(
            'focus',
            () => {
                renderTimezoneOptions(searchInput.value);
                dropdown.hidden = false;
            },
            { signal },
        );

        searchInput?.addEventListener(
            'input',
            () => {
                renderTimezoneOptions(searchInput.value);
                dropdown.hidden = false;
            },
            { signal },
        );

        dropdown?.addEventListener(
            'click',
            (event) => {
                const option = event.target.closest('[data-timezone-option]');

                if (!option) {
                    return;
                }

                const tz = state.timezones.find(
                    (candidate) =>
                        String(candidate.id) === option.dataset.timezoneOption,
                );

                if (!tz) {
                    return;
                }

                searchInput.value = timezoneDisplayLabel(tz);
                hiddenInput.value = tz.id;
                dropdown.hidden = true;

                savePersonal({ timezone_id: tz.id, timezone_source: 'manual' });
            },
            { signal },
        );

        document.addEventListener(
            'click',
            (event) => {
                if (
                    searchInput &&
                    !searchInput.contains(event.target) &&
                    !dropdown.contains(event.target)
                ) {
                    dropdown.hidden = true;
                }
            },
            { signal },
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Section: Personal -> Notifications
    |--------------------------------------------------------------------------
    */

    const NOTIFICATION_PREF_KEYS = [
        'database',
        'browser',
        'sound',
        'message',
        'system',
    ];

    function notificationPrefCheckbox(key, prefs) {
        const enabled = prefs?.[key] !== false;

        return `
            <label class="checkbox" style="display:flex; margin-bottom:10px;">
                <input type="checkbox" class="checkbox__input" data-notif-pref="${key}" ${enabled ? 'checked' : ''}>
                <span class="checkbox__box"></span>
                ${t(`settings.notif_pref_${key}`)}
            </label>
        `;
    }

    function renderNotifications() {
        const prefs = state.personal?.meta?.notifications;

        return `
            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('settings.notif_prefs')}</h2>
                <p class="settings-panel__section-hint">${t('settings.notif_prefs_hint')}</p>
                ${NOTIFICATION_PREF_KEYS.map((key) => notificationPrefCheckbox(key, prefs)).join('')}
            </div>
        `;
    }

    function wireNotifications() {
        panel.querySelectorAll('[data-notif-pref]').forEach((checkbox) => {
            checkbox.addEventListener(
                'change',
                async () => {
                    const key = checkbox.dataset.notifPref;

                    if (
                        key === 'browser' &&
                        checkbox.checked &&
                        typeof Notification !== 'undefined' &&
                        Notification.permission === 'default'
                    ) {
                        const permission =
                            await Notification.requestPermission();

                        if (permission !== 'granted') {
                            checkbox.checked = false;

                            return;
                        }
                    }

                    const meta = {
                        ...(state.personal?.meta || {}),
                        notifications: {
                            ...(state.personal?.meta?.notifications || {}),
                            [key]: checkbox.checked,
                        },
                    };

                    savePersonal({ meta });
                },
                { signal },
            );
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Section: Personal -> Security (an extra check at login — see auth
    | flows; distinct from Application -> Security, which is instance-wide).
    |--------------------------------------------------------------------------
    */

    function renderPersonalSecurity() {
        const p = state.personal;

        return `
            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('settings.login_security_title')}</h2>
                <p class="settings-panel__section-hint">${t('settings.login_security_hint')}</p>

                <label class="checkbox">
                    <input type="checkbox" class="checkbox__input" data-require-login-verification ${p?.require_login_verification ? 'checked' : ''}>
                    <span class="checkbox__box"></span>
                    ${t('settings.require_login_verification')}
                </label>
                <p class="settings-panel__section-hint">${t('settings.require_login_verification_hint')}</p>
            </div>
        `;
    }

    function wirePersonalSecurity() {
        panel
            .querySelector('[data-require-login-verification]')
            ?.addEventListener(
                'change',
                (event) => {
                    savePersonal({
                        require_login_verification: event.target.checked,
                    });
                },
                { signal },
            );
    }

    /*
    |--------------------------------------------------------------------------
    | Section: Personal -> Developer
    |--------------------------------------------------------------------------
    */

    function renderDeveloper() {
        const enabled = Boolean(state.personal?.meta?.developer_mode);
        const version = document.body.dataset.appVersion;

        return `
            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('settings.nav.developer')}</h2>
                <p class="settings-panel__section-hint">${t('settings.developer_mode_hint')}</p>
                <label class="checkbox">
                    <input type="checkbox" class="checkbox__input" data-developer-mode ${enabled ? 'checked' : ''}>
                    <span class="checkbox__box"></span>
                    ${t('settings.developer_mode')}
                </label>
            </div>

            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('settings.about')}</h2>
                <p class="settings-panel__section-hint">${version ? t('settings.version', { version }) : ''}</p>
                <a href="/changelog" class="btn btn--outline btn--sm">${t('changelog.title')}</a>
            </div>
        `;
    }

    function wireDeveloper() {
        panel.querySelector('[data-developer-mode]')?.addEventListener(
            'change',
            (event) => {
                const meta = {
                    ...(state.personal?.meta || {}),
                    developer_mode: event.target.checked,
                };

                savePersonal(
                    { meta },
                    {
                        onSuccess: () =>
                            document.documentElement.toggleAttribute(
                                'data-developer-mode',
                                event.target.checked,
                            ),
                    },
                );
            },
            { signal },
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Section: Application -> General (site name, application timezone via
    | the generic block — both are now real, plain admin-editable strings
    | — plus the favicon upload widget).
    |--------------------------------------------------------------------------
    */

    function renderApplicationGeneral() {
        const favicon = adminSetting('system.favicon');
        const faviconUrl = favicon?.value || '/favicon.ico';

        return `
            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('settings.nav.general')}</h2>
                <p class="settings-panel__section-hint">${t('settings.application_general_hint')}</p>
                ${genericSettingsBlock(SECTION_ADMIN_KEYS['application-general'])}
            </div>

            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('settings.favicon')}</h2>
                <p class="settings-panel__section-hint">${t('settings.favicon_hint')}</p>

                <div class="favicon-upload">
                    <div class="favicon-upload__preview">
                        <img src="${escapeHtml(faviconUrl)}" alt="" data-favicon-preview>
                    </div>
                    <div class="favicon-upload__actions">
                        <div class="favicon-upload__buttons">
                            <button type="button" class="btn btn--outline btn--sm" data-favicon-trigger>${t('settings.favicon_upload')}</button>
                            <button type="button" class="btn btn--ghost btn--sm" data-favicon-reset ${faviconUrl === '/favicon.ico' ? 'disabled' : ''}>${t('settings.favicon_remove')}</button>
                        </div>
                        <span class="field-hint">${t('settings.favicon_formats')}</span>
                    </div>
                    <input type="file" accept=".ico,.png,.svg,image/x-icon,image/png,image/svg+xml" hidden data-favicon-input>
                </div>

                <div class="favicon-dropzone" data-favicon-dropzone>${t('settings.favicon_dropzone')}</div>
            </div>
        `;
    }

    async function patchSetting(id, value) {
        await api.patch(`/admin/settings/${id}`, { value, operation: 'set' });
    }

    async function uploadFavicon(file) {
        const preview = panel.querySelector('[data-favicon-preview]');
        const trigger = panel.querySelector('[data-favicon-trigger]');
        const resetBtn = panel.querySelector('[data-favicon-reset]');

        const formData = new FormData();
        formData.append('file', file);

        trigger.disabled = true;

        try {
            const { data } = await api.post(
                '/admin/settings/favicon',
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } },
            );

            // Cache-bust: the <link rel="icon"> in <head> won't be
            // refetched by the browser just because the underlying file
            // changed at the same URL — this preview update is instant
            // regardless, but see favicon.blade.php for the actual tab icon.
            preview.src = data.data.url;
            resetBtn.disabled = false;
            showToast(t('settings.favicon_updated'));

            const setting = adminSetting('system.favicon');

            if (setting) {
                setting.value = data.data.url;
            }
        } catch (error) {
            showToast(
                apiErrorMessage(error, t('settings.favicon_error')),
                'error',
            );
        } finally {
            trigger.disabled = false;
        }
    }

    function wireApplicationGeneral() {
        const input = panel.querySelector('[data-favicon-input]');
        const dropzone = panel.querySelector('[data-favicon-dropzone]');

        panel
            .querySelector('[data-favicon-trigger]')
            ?.addEventListener('click', () => input.click(), { signal });

        input?.addEventListener(
            'change',
            () => {
                const file = input.files?.[0];

                if (file) {
                    uploadFavicon(file);
                }

                input.value = '';
            },
            { signal },
        );

        panel.querySelector('[data-favicon-reset]')?.addEventListener(
            'click',
            async (event) => {
                const button = event.currentTarget;
                button.disabled = true;

                try {
                    const { data } = await api.delete(
                        '/admin/settings/favicon',
                    );

                    panel.querySelector('[data-favicon-preview]').src =
                        data.data.url;
                    showToast(t('settings.favicon_updated'));

                    const setting = adminSetting('system.favicon');

                    if (setting) {
                        setting.value = data.data.url;
                    }
                } catch (error) {
                    showToast(
                        apiErrorMessage(error, t('settings.favicon_error')),
                        'error',
                    );
                    button.disabled = false;
                }
            },
            { signal },
        );

        ['dragover', 'dragenter'].forEach((evt) =>
            dropzone?.addEventListener(
                evt,
                (event) => {
                    event.preventDefault();
                    dropzone.classList.add('favicon-dropzone--active');
                },
                { signal },
            ),
        );

        ['dragleave', 'dragend', 'drop'].forEach((evt) =>
            dropzone?.addEventListener(
                evt,
                () => dropzone.classList.remove('favicon-dropzone--active'),
                { signal },
            ),
        );

        dropzone?.addEventListener(
            'drop',
            (event) => {
                event.preventDefault();
                const file = event.dataTransfer?.files?.[0];

                if (file) {
                    uploadFavicon(file);
                }
            },
            { signal },
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Section: Application -> Authentication — allowed login roles +
    | default role get real widgets instead of a raw ID input.
    |--------------------------------------------------------------------------
    */

    function renderApplicationAuthentication() {
        const allowedRoles = adminSetting('auth.allowed_login_role_ids');
        const defaultRole = adminSetting('auth.default_role_id');
        const allowedIds = new Set((allowedRoles?.value || []).map(Number));

        return `
            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('settings.allowed_login_roles')}</h2>
                <p class="settings-panel__section-hint">${t('settings.allowed_login_roles_hint')}</p>
                <div class="settings-role-list" data-allowed-roles data-setting-id="${allowedRoles?.id ?? ''}">
                    ${state.roles
                        .map(
                            (role) => `
                        <label class="settings-role-row">
                            <div class="settings-role-row__main">
                                <div class="settings-role-row__name">${escapeHtml(role.name)}</div>
                                ${role.description ? `<div class="settings-role-row__desc">${escapeHtml(role.description)}</div>` : ''}
                                <div class="settings-role-row__code">${role.code} · #${role.id}</div>
                            </div>
                            <span class="checkbox">
                                <input type="checkbox" class="checkbox__input" data-role-id="${role.id}" ${allowedIds.has(role.id) ? 'checked' : ''}>
                                <span class="checkbox__box"></span>
                            </span>
                        </label>
                    `,
                        )
                        .join('')}
                </div>
            </div>

            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('settings.default_registration_role')}</h2>
                <p class="settings-panel__section-hint">${t('settings.default_registration_role_hint')}</p>
                <div class="field-group" style="max-width:320px;">
                    <div class="select-field">
                        <select class="field-select" data-default-role data-setting-id="${defaultRole?.id ?? ''}">
                            ${state.roles.map((role) => `<option value="${role.id}" ${role.id === defaultRole?.value ? 'selected' : ''}>${escapeHtml(role.name)}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>

            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('settings.nav.authentication')}</h2>
                ${genericSettingsBlock(SECTION_ADMIN_KEYS['application-authentication'])}
            </div>
        `;
    }

    function wireApplicationAuthentication() {
        const rolesContainer = panel.querySelector('[data-allowed-roles]');

        rolesContainer?.addEventListener(
            'change',
            async (event) => {
                const checkbox = event.target.closest('[data-role-id]');

                if (!checkbox) {
                    return;
                }

                const settingId = rolesContainer.dataset.settingId;
                const selected = [
                    ...rolesContainer.querySelectorAll(
                        '[data-role-id]:checked',
                    ),
                ].map((el) => Number(el.dataset.roleId));

                try {
                    await patchSetting(settingId, selected);
                    showToast(t('admin.save_success'));
                } catch (error) {
                    checkbox.checked = !checkbox.checked;
                    showToast(
                        apiErrorMessage(error, t('admin.save_error')),
                        'error',
                    );
                }
            },
            { signal },
        );

        const defaultRoleSelect = panel.querySelector('[data-default-role]');

        defaultRoleSelect?.addEventListener(
            'change',
            async () => {
                defaultRoleSelect.disabled = true;

                try {
                    await patchSetting(
                        defaultRoleSelect.dataset.settingId,
                        Number(defaultRoleSelect.value),
                    );
                    showToast(t('admin.save_success'));
                } catch (error) {
                    showToast(
                        apiErrorMessage(error, t('admin.save_error')),
                        'error',
                    );
                } finally {
                    defaultRoleSelect.disabled = false;
                }
            },
            { signal },
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Section: Application -> Localization
    |--------------------------------------------------------------------------
    */

    function renderApplicationLocalization() {
        const defaultLocale = adminSetting('localization.default_locale');
        const fallbackLocale = adminSetting('localization.fallback_locale');
        const baseCurrency = adminSetting('system.base_currency_code');

        return `
            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('settings.default_language')}</h2>
                <p class="settings-panel__section-hint">${t('settings.default_language_hint')}</p>

                <div class="field-row">
                    <div class="field-group">
                        <label class="field-label">${t('settings.default_language')}</label>
                        <div class="select-field">
                            <select class="field-select" data-setting-select="${defaultLocale?.id ?? ''}">${languageOptions(defaultLocale?.value)}</select>
                        </div>
                    </div>

                    <div class="field-group">
                        <label class="field-label">${t('settings.fallback_language')}</label>
                        <div class="select-field">
                            <select class="field-select" data-setting-select="${fallbackLocale?.id ?? ''}">${languageOptions(fallbackLocale?.value)}</select>
                        </div>
                    </div>
                </div>
            </div>

            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('settings.app_currency')}</h2>
                <p class="settings-panel__section-hint">${t('settings.app_currency_hint')}</p>

                <div class="field-group" style="max-width:320px;">
                    <label class="field-label">${t('settings.app_currency')}</label>
                    <div class="select-field">
                        <select class="field-select" data-setting-select="${baseCurrency?.id ?? ''}">${currencyCodeOptions(baseCurrency?.value)}</select>
                    </div>
                    <p class="settings-panel__section-hint" style="margin:6px 0 0;">
                        ${escapeHtml(state.currencyMeta.ratesAsOf ? t('settings.rates_as_of', { date: state.currencyMeta.ratesAsOf }) : t('settings.rates_missing'))}
                    </p>
                </div>
            </div>

            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('settings.nav.localization')}</h2>
                ${genericSettingsBlock(SECTION_ADMIN_KEYS['application-localization'])}
            </div>
        `;
    }

    function wireApplicationLocalization() {
        panel.querySelectorAll('[data-setting-select]').forEach((select) => {
            select.addEventListener(
                'change',
                async () => {
                    const settingId = select.dataset.settingSelect;

                    select.disabled = true;

                    try {
                        await patchSetting(settingId, select.value);
                        showToast(t('admin.save_success'));
                    } catch (error) {
                        showToast(
                            apiErrorMessage(error, t('admin.save_error')),
                            'error',
                        );
                    } finally {
                        select.disabled = false;
                    }
                },
                { signal },
            );
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Section: Application -> Notifications (system-wide channels)
    |--------------------------------------------------------------------------
    */

    function renderApplicationNotifications() {
        return `
            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('settings.nav.notifications')}</h2>
                <p class="settings-panel__section-hint">${t('settings.notifications_hint')}</p>
                ${genericSettingsBlock(SECTION_ADMIN_KEYS['application-notifications'])}
            </div>
        `;
    }

    /*
    |--------------------------------------------------------------------------
    | Section: Application -> Security
    |--------------------------------------------------------------------------
    */

    function renderApplicationSecurity() {
        return `
            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('settings.nav.security')}</h2>
                <p class="settings-panel__section-hint">${t('settings.security_hint')}</p>
                ${genericSettingsBlock(SECTION_ADMIN_KEYS['application-security'])}
            </div>
        `;
    }

    /*
    |--------------------------------------------------------------------------
    | Section: Application -> System (catch-all instance policy rows)
    |--------------------------------------------------------------------------
    */

    function renderApplicationSystem() {
        return `
            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('settings.nav.system')}</h2>
                <p class="settings-panel__section-hint">${t('settings.user_policies_hint')}</p>
                ${genericSettingsBlock(SECTION_ADMIN_KEYS['application-system'])}
            </div>
        `;
    }

    /*
    |--------------------------------------------------------------------------
    | Generic-control save (shared by every Application section)
    |--------------------------------------------------------------------------
    */

    panel.addEventListener(
        'click',
        async (event) => {
            const button = event.target.closest('[data-save-setting]');

            if (!button) {
                return;
            }

            const settingId = button.dataset.saveSetting;
            const row = panel.querySelector(
                `[data-setting-row="${settingId}"]`,
            );
            const control = row.querySelector('[data-setting-value]');

            let value = control.value;
            const type = control.dataset.type;

            if (
                (type === 'string' || type === 'text') &&
                control.dataset.required === 'true' &&
                value.trim() === ''
            ) {
                showToast(t('admin.value_required'), 'error');

                return;
            }

            if (type === 'boolean') {
                value = value === 'true';
            } else if (type === 'integer') {
                value = parseInt(value, 10) || 0;
            } else if (type === 'json') {
                try {
                    value = JSON.parse(value);
                } catch {
                    showToast(t('admin.invalid_json'), 'error');

                    return;
                }
            }

            button.disabled = true;

            try {
                await patchSetting(settingId, value);
                showToast(t('admin.save_success'));
            } catch (error) {
                showToast(
                    apiErrorMessage(error, t('admin.save_error')),
                    'error',
                );
            } finally {
                button.disabled = false;
            }
        },
        { signal },
    );

    /*
    |--------------------------------------------------------------------------
    | Section routing
    |--------------------------------------------------------------------------
    */

    const RENDERERS = {
        'personal-profile': [renderProfile, wireProfile],
        'personal-appearance': [renderAppearance, wireAppearance],
        'personal-language': [renderLanguageRegion, wireLanguageRegion],
        'personal-notifications': [renderNotifications, wireNotifications],
        'personal-security': [renderPersonalSecurity, wirePersonalSecurity],
        'personal-developer': [renderDeveloper, wireDeveloper],
        'application-general': [
            renderApplicationGeneral,
            wireApplicationGeneral,
        ],
        'application-authentication': [
            renderApplicationAuthentication,
            wireApplicationAuthentication,
        ],
        'application-localization': [
            renderApplicationLocalization,
            wireApplicationLocalization,
        ],
        'application-notifications': [renderApplicationNotifications, null],
        'application-security': [renderApplicationSecurity, null],
        'application-system': [renderApplicationSystem, null],
    };

    /**
     * Section id -> URL, for *both* groups, as rendered by the server
     * (see settings.blade.php) — so no route lives in two places. It is
     * a map rather than a read off the sidebar because the sidebar only
     * lists the group you are in, and both redirects below can need the
     * other one.
     */
    const SECTION_URLS = JSON.parse(panel.dataset.settingsRoutes || '{}');

    function urlForSection(id) {
        return SECTION_URLS[id] || null;
    }

    function renderSection(id) {
        const [render, wire] = RENDERERS[id];

        panel.innerHTML = render();
        wire?.();
    }

    /*
    |--------------------------------------------------------------------------
    | Which section this page is
    |--------------------------------------------------------------------------
    |
    | The server decides — `data-settings-section` is the id its route was
    | registered for (see SettingsPageController), empty on a group index
    | (/settings, /admin/settings), where `data-settings-default` names
    | the first section of *that* group instead. DEFAULT_SECTION is only a
    | last-resort guard against an id no renderer knows; routes/web.php
    | can't produce one.
    |
    */

    const requested = panel.dataset.settingsSection;
    const fallback = panel.dataset.settingsDefault;
    const section = [requested, fallback, DEFAULT_SECTION].find((id) =>
        Object.hasOwn(RENDERERS, id),
    );

    /*
    | Sections used to be `#personal-appearance`-style hashes on this one
    | URL. They are routes now, so an old bookmark or a stale link gets
    | forwarded to the route that replaced it instead of silently showing
    | Profile — and a hash we don't recognise is just dropped.
    */
    const legacy = window.location.hash.replace('#', '');

    if (legacy) {
        const legacyUrl = legacy !== requested ? urlForSection(legacy) : null;

        if (legacyUrl) {
            navigate(legacyUrl);

            return;
        }

        window.history.replaceState(
            window.history.state,
            '',
            window.location.pathname + window.location.search,
        );
    }

    (async () => {
        const user = await fetchCurrentUser();

        state.isAdmin = hasRole(user, 'SUPER_ADMIN', 'ADMIN');

        /*
        | /admin/settings/* has no server-side guard (there is no session
        | to check — see routes/web.php), and its API calls would just
        | 403. Send a non-admin who typed or bookmarked the URL to their
        | own settings instead of rendering a page of failed requests.
        | The API is still the thing that actually enforces this.
        */
        if (ADMIN_SECTIONS.has(section) && !state.isAdmin) {
            navigate(urlForSection(DEFAULT_SECTION) || '/settings');

            return;
        }

        await loadFor(section);
        renderSection(section);
    })();
}

function teardown() {
    currentCleanup?.();
    currentCleanup = null;
}

bootOnPage('[data-settings-panel]', boot, teardown);
