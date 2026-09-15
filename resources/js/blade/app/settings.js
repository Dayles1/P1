import { api } from '../axios';
import { showToast, apiErrorMessage } from '../shared/toast';
import { escapeHtml } from '../shared/forms';
import { t } from '../shared/i18n';
import { fetchCurrentUser, hasRole } from '../shared/auth-state';
import { renderThemeGrid } from '../shared/theme-picker';
import { writeLocaleCookie, getLocale } from '../shared/i18n';
import { getUserSettings, invalidateUserSettings } from '../shared/user-settings-cache';

const nav = document.querySelector('[data-settings-nav]');
const panel = document.querySelector('[data-settings-panel]');

const SECTIONS = ['general', 'appearance', 'localization', 'notifications', 'authentication', 'security', 'system', 'developer'];
const ADMIN_SECTIONS = new Set(['authentication', 'security', 'system']);

// Which raw admin settings (by key) render via the generic boolean/integer/
// text control inside each section — special keys (roles, locales, favicon)
// are listed here for exclusion only; they get bespoke widgets instead.
const SECTION_ADMIN_KEYS = {
    general: [
        'user.allow_avatar_upload', 'user.default_avatar', 'user.max_avatar_size',
        'user.allow_profile_edit', 'user.allow_delete_account', 'user.allow_change_email', 'user.allow_change_username',
    ],
    notifications: [
        'notification.database', 'notification.email', 'notification.telegram', 'notification.push', 'notification.sms',
    ],
    authentication: [
        'auth.registration_open', 'auth.login_open', 'auth.email_verification_required',
        'auth.remember_me_enabled', 'auth.session_lifetime',
    ],
    security: [
        'auth.max_register_users_count', 'auth.max_users_count', 'auth.max_login_attempts',
        'auth.lockout_minutes', 'auth.protect_superadmin', 'security.enable_api', 'security.audit_log',
    ],
    system: [
        'system.site_name', 'system.timezone', 'system.logo',
        'upload.max_upload_size', 'upload.allowed_extensions', 'upload.allowed_mime_types',
        'upload.max_image_width', 'upload.max_image_height', 'upload.max_video_size',
        'upload.max_document_size', 'upload.image_quality',
    ],
};

const state = {
    isAdmin: false,
    personal: null,
    timezones: [],
    languages: [],
    roles: [],
    adminSettingsByKey: new Map(),
};

/*
|--------------------------------------------------------------------------
| Data loading
|--------------------------------------------------------------------------
*/

async function loadAll() {
    const user = await fetchCurrentUser();
    state.isAdmin = hasRole(user, 'SUPER_ADMIN', 'ADMIN');

    const requests = [
        getUserSettings(api),
        api.get('/timezones'),
        api.get('/languages'),
    ];

    if (state.isAdmin) {
        requests.push(api.get('/admin/settings'), api.get('/roles'));
    }

    const results = await Promise.allSettled(requests);

    const [personalRes, timezonesRes, languagesRes, adminSettingsRes, rolesRes] = results;

    if (personalRes.status === 'fulfilled') {
        state.personal = personalRes.value;
    }

    if (timezonesRes.status === 'fulfilled') {
        state.timezones = timezonesRes.value.data.data || [];
    }

    if (languagesRes.status === 'fulfilled') {
        state.languages = languagesRes.value.data.data || [];
    }

    if (state.isAdmin && adminSettingsRes?.status === 'fulfilled') {
        const groups = adminSettingsRes.value.data.data || [];
        groups.forEach((group) => group.items.forEach((item) => state.adminSettingsByKey.set(item.key, item)));
    }

    if (state.isAdmin && rolesRes?.status === 'fulfilled') {
        state.roles = rolesRes.value.data.data || [];
    }
}

function adminSetting(key) {
    return state.adminSettingsByKey.get(key);
}

/*
|--------------------------------------------------------------------------
| Generic admin control (boolean / integer / text / json) — same shape as
| the flat admin settings editor this replaces, just relocated per-section.
|--------------------------------------------------------------------------
*/

function genericControlHtml(setting) {
    const id = `setting-${setting.id}`;

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
        return `<textarea class="field-input" id="${id}" data-setting-value data-type="json" rows="3" style="max-width:360px; height:auto;">${escapeHtml(JSON.stringify(setting.value ?? [], null, 2))}</textarea>`;
    }

    return `<input class="field-input" id="${id}" type="text" data-setting-value data-type="${setting.type}" value="${escapeHtml(setting.value ?? '')}" style="max-width:360px;">`;
}

function genericSettingRow(setting) {
    return `
        <div class="data-row" data-setting-row="${setting.id}" style="margin-bottom:10px;">
            <div class="data-row__main">
                <div class="data-row__title">
                    ${setting.key}
                    ${setting.is_locked ? `<span class="pill pill--muted">${t('admin.locked')}</span>` : ''}
                </div>
            </div>
            <div class="data-row__actions">
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

    return `<div class="data-list">${settings.map(genericSettingRow).join('')}</div>`;
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
| Section: General
|--------------------------------------------------------------------------
*/

function renderGeneral() {
    const p = state.personal;

    const timezoneOptions = state.timezones
        .map((tz) => `<option value="${tz.id}" ${String(tz.id) === String(p?.timezone?.id) ? 'selected' : ''}>${escapeHtml(tz.name)} (${tz.offset})</option>`)
        .join('');

    const dateFormats = ['Y-m-d', 'd.m.Y', 'd/m/Y', 'm/d/Y'];
    const timeFormats = ['24h', '12h'];

    return `
        <div class="settings-panel__section">
            <h2 class="settings-panel__section-title">${t('settings.nav.general')}</h2>
            <p class="settings-panel__section-hint">${t('settings.general_hint')}</p>

            <div class="field-row">
                <div class="field-group">
                    <label class="field-label">${t('settings.timezone')}</label>
                    <div class="select-field">
                        <select class="field-select" data-personal="timezone_id">${timezoneOptions}</select>
                    </div>
                </div>

                <div class="field-group">
                    <label class="field-label">${t('settings.time_format')}</label>
                    <div class="select-field">
                        <select class="field-select" data-personal="time_format">
                            ${timeFormats.map((f) => `<option value="${f}" ${f === p?.time_format ? 'selected' : ''}>${t(`settings.time_format_${f}`)}</option>`).join('')}
                        </select>
                    </div>
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

        ${state.isAdmin ? `
            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('settings.user_policies')}</h2>
                <p class="settings-panel__section-hint">${t('settings.user_policies_hint')}</p>
                ${genericSettingsBlock(SECTION_ADMIN_KEYS.general)}
            </div>
        ` : ''}
    `;
}

function wireGeneral() {
    panel.querySelectorAll('[data-personal="timezone_id"], [data-personal="time_format"], [data-personal="date_format"]').forEach((el) => {
        el.addEventListener('change', () => {
            const payload = { [el.dataset.personal]: el.value };

            if (el.dataset.personal === 'timezone_id') {
                payload.timezone_source = 'manual';
            }

            savePersonal(payload);
        });
    });
}

/*
|--------------------------------------------------------------------------
| Section: Appearance
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
| Section: Localization
|--------------------------------------------------------------------------
*/

function languageOptions(selectedCode) {
    return state.languages
        .map((lang) => `<option value="${lang.code}" ${lang.code === selectedCode ? 'selected' : ''}>${escapeHtml(lang.name)}</option>`)
        .join('');
}

function renderLocalization() {
    const defaultLocale = adminSetting('localization.default_locale');
    const fallbackLocale = adminSetting('localization.fallback_locale');

    return `
        <div class="settings-panel__section">
            <h2 class="settings-panel__section-title">${t('settings.nav.localization')}</h2>
            <p class="settings-panel__section-hint">${t('settings.localization_hint')}</p>

            <div class="field-group" style="max-width:320px;">
                <label class="field-label">${t('ui.locale.label')}</label>
                <div class="select-field">
                    <select class="field-select" data-personal-locale>${languageOptions(state.personal?.locale || getLocale())}</select>
                </div>
            </div>
        </div>

        ${state.isAdmin && defaultLocale && fallbackLocale ? `
            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('settings.default_language')}</h2>
                <p class="settings-panel__section-hint">${t('settings.default_language_hint')}</p>

                <div class="field-row">
                    <div class="field-group">
                        <label class="field-label">${t('settings.default_language')}</label>
                        <div class="select-field">
                            <select class="field-select" data-locale-setting="${defaultLocale.id}">${languageOptions(defaultLocale.value)}</select>
                        </div>
                    </div>

                    <div class="field-group">
                        <label class="field-label">${t('settings.fallback_language')}</label>
                        <div class="select-field">
                            <select class="field-select" data-locale-setting="${fallbackLocale.id}">${languageOptions(fallbackLocale.value)}</select>
                        </div>
                    </div>
                </div>
            </div>

            <div class="settings-panel__section">
                ${genericSettingsBlock(['localization.allow_locale_switch', 'localization.auto_detect_browser_locale'])}
            </div>
        ` : ''}
    `;
}

function wireLocalization() {
    panel.querySelector('[data-personal-locale]')?.addEventListener('change', async (event) => {
        const locale = event.target.value;
        const select = event.target;

        select.disabled = true;
        writeLocaleCookie(locale);

        try {
            await api.put('/profile/settings', { locale });
        } catch (error) {
            showToast(apiErrorMessage(error, t('settings.error')), 'error');
            select.disabled = false;

            return;
        }

        window.location.reload();
    });

    panel.querySelectorAll('[data-locale-setting]').forEach((select) => {
        select.addEventListener('change', async () => {
            const settingId = select.dataset.localeSetting;

            select.disabled = true;

            try {
                await api.patch(`/admin/settings/${settingId}`, { value: select.value, operation: 'set' });
                showToast(t('admin.save_success'));
            } catch (error) {
                showToast(apiErrorMessage(error, t('admin.save_error')), 'error');
            } finally {
                select.disabled = false;
            }
        });
    });
}

/*
|--------------------------------------------------------------------------
| Section: Notifications (admin channel toggles for now — Phase 3 adds
| personal per-user preferences alongside these).
|--------------------------------------------------------------------------
*/

const NOTIFICATION_PREF_KEYS = ['database', 'browser', 'message', 'system'];

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

        ${state.isAdmin ? `
            <div class="settings-panel__section">
                <h2 class="settings-panel__section-title">${t('settings.nav.notifications')}</h2>
                <p class="settings-panel__section-hint">${t('settings.notifications_hint')}</p>
                ${genericSettingsBlock(SECTION_ADMIN_KEYS.notifications)}
            </div>
        ` : ''}
    `;
}

function wireNotifications() {
    panel.querySelectorAll('[data-notif-pref]').forEach((checkbox) => {
        checkbox.addEventListener('change', async () => {
            const key = checkbox.dataset.notifPref;

            if (key === 'browser' && checkbox.checked && typeof Notification !== 'undefined' && Notification.permission === 'default') {
                const permission = await Notification.requestPermission();

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
        });
    });
}

/*
|--------------------------------------------------------------------------
| Section: Authentication (admin) — allowed login roles + default role get
| real widgets instead of a raw ID input / JSON textarea.
|--------------------------------------------------------------------------
*/

function renderAuthentication() {
    const allowedRoles = adminSetting('auth.allowed_login_role_ids');
    const defaultRole = adminSetting('auth.default_role_id');
    const allowedIds = new Set((allowedRoles?.value || []).map(Number));

    return `
        <div class="settings-panel__section">
            <h2 class="settings-panel__section-title">${t('settings.allowed_login_roles')}</h2>
            <p class="settings-panel__section-hint">${t('settings.allowed_login_roles_hint')}</p>
            <div class="settings-role-list" data-allowed-roles data-setting-id="${allowedRoles?.id ?? ''}">
                ${state.roles.map((role) => `
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
                `).join('')}
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
            ${genericSettingsBlock(SECTION_ADMIN_KEYS.authentication)}
        </div>
    `;
}

async function patchSetting(id, value) {
    await api.patch(`/admin/settings/${id}`, { value, operation: 'set' });
}

function wireAuthentication() {
    const rolesContainer = panel.querySelector('[data-allowed-roles]');

    rolesContainer?.addEventListener('change', async (event) => {
        const checkbox = event.target.closest('[data-role-id]');

        if (!checkbox) {
            return;
        }

        const settingId = rolesContainer.dataset.settingId;
        const selected = [...rolesContainer.querySelectorAll('[data-role-id]:checked')].map((el) => Number(el.dataset.roleId));

        try {
            await patchSetting(settingId, selected);
            showToast(t('admin.save_success'));
        } catch (error) {
            checkbox.checked = !checkbox.checked;
            showToast(apiErrorMessage(error, t('admin.save_error')), 'error');
        }
    });

    const defaultRoleSelect = panel.querySelector('[data-default-role]');

    defaultRoleSelect?.addEventListener('change', async () => {
        defaultRoleSelect.disabled = true;

        try {
            await patchSetting(defaultRoleSelect.dataset.settingId, Number(defaultRoleSelect.value));
            showToast(t('admin.save_success'));
        } catch (error) {
            showToast(apiErrorMessage(error, t('admin.save_error')), 'error');
        } finally {
            defaultRoleSelect.disabled = false;
        }
    });
}

/*
|--------------------------------------------------------------------------
| Section: Security (admin)
|--------------------------------------------------------------------------
*/

function renderSecurity() {
    return `
        <div class="settings-panel__section">
            <h2 class="settings-panel__section-title">${t('settings.nav.security')}</h2>
            <p class="settings-panel__section-hint">${t('settings.security_hint')}</p>
            ${genericSettingsBlock(SECTION_ADMIN_KEYS.security)}
        </div>
    `;
}

/*
|--------------------------------------------------------------------------
| Section: System (admin) — favicon gets a real upload widget.
|--------------------------------------------------------------------------
*/

function renderSystem() {
    const favicon = adminSetting('system.favicon');
    const faviconUrl = favicon?.value || '/favicon.ico';

    return `
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

        <div class="settings-panel__section">
            <h2 class="settings-panel__section-title">${t('settings.nav.system')}</h2>
            ${genericSettingsBlock(SECTION_ADMIN_KEYS.system)}
        </div>
    `;
}

async function uploadFavicon(file) {
    const preview = panel.querySelector('[data-favicon-preview]');
    const trigger = panel.querySelector('[data-favicon-trigger]');
    const resetBtn = panel.querySelector('[data-favicon-reset]');

    const formData = new FormData();
    formData.append('file', file);

    trigger.disabled = true;

    try {
        const { data } = await api.post('/admin/settings/favicon', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });

        preview.src = data.data.url;
        resetBtn.disabled = false;
        showToast(t('settings.favicon_updated'));

        const setting = adminSetting('system.favicon');

        if (setting) {
            setting.value = data.data.url;
        }
    } catch (error) {
        showToast(apiErrorMessage(error, t('settings.favicon_error')), 'error');
    } finally {
        trigger.disabled = false;
    }
}

function wireSystem() {
    const input = panel.querySelector('[data-favicon-input]');
    const dropzone = panel.querySelector('[data-favicon-dropzone]');

    panel.querySelector('[data-favicon-trigger]')?.addEventListener('click', () => input.click());

    input?.addEventListener('change', () => {
        const file = input.files?.[0];

        if (file) {
            uploadFavicon(file);
        }

        input.value = '';
    });

    panel.querySelector('[data-favicon-reset]')?.addEventListener('click', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;

        try {
            const { data } = await api.delete('/admin/settings/favicon');

            panel.querySelector('[data-favicon-preview]').src = data.data.url;
            showToast(t('settings.favicon_updated'));

            const setting = adminSetting('system.favicon');

            if (setting) {
                setting.value = data.data.url;
            }
        } catch (error) {
            showToast(apiErrorMessage(error, t('settings.favicon_error')), 'error');
            button.disabled = false;
        }
    });

    ['dragover', 'dragenter'].forEach((evt) => dropzone?.addEventListener(evt, (event) => {
        event.preventDefault();
        dropzone.classList.add('favicon-dropzone--active');
    }));

    ['dragleave', 'dragend', 'drop'].forEach((evt) => dropzone?.addEventListener(evt, () => {
        dropzone.classList.remove('favicon-dropzone--active');
    }));

    dropzone?.addEventListener('drop', (event) => {
        event.preventDefault();
        const file = event.dataTransfer?.files?.[0];

        if (file) {
            uploadFavicon(file);
        }
    });
}

/*
|--------------------------------------------------------------------------
| Section: Developer
|--------------------------------------------------------------------------
*/

function renderDeveloper() {
    const enabled = Boolean(state.personal?.meta?.developer_mode);

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
    `;
}

function wireDeveloper() {
    panel.querySelector('[data-developer-mode]')?.addEventListener('change', (event) => {
        const meta = { ...(state.personal?.meta || {}), developer_mode: event.target.checked };

        savePersonal({ meta }, {
            onSuccess: () => document.documentElement.toggleAttribute('data-developer-mode', event.target.checked),
        });
    });
}

/*
|--------------------------------------------------------------------------
| Generic-control save (shared by every section that renders raw settings)
|--------------------------------------------------------------------------
*/

panel.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-save-setting]');

    if (!button) {
        return;
    }

    const settingId = button.dataset.saveSetting;
    const row = panel.querySelector(`[data-setting-row="${settingId}"]`);
    const control = row.querySelector('[data-setting-value]');

    let value = control.value;
    const type = control.dataset.type;

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
        showToast(apiErrorMessage(error, t('admin.save_error')), 'error');
    } finally {
        button.disabled = false;
    }
});

/*
|--------------------------------------------------------------------------
| Section routing
|--------------------------------------------------------------------------
*/

const RENDERERS = {
    general: [renderGeneral, wireGeneral],
    appearance: [renderAppearance, wireAppearance],
    localization: [renderLocalization, wireLocalization],
    notifications: [renderNotifications, wireNotifications],
    authentication: [renderAuthentication, wireAuthentication],
    security: [renderSecurity, null],
    system: [renderSystem, wireSystem],
    developer: [renderDeveloper, wireDeveloper],
};

function currentSection() {
    const hash = window.location.hash.replace('#', '');

    if (SECTIONS.includes(hash) && (!ADMIN_SECTIONS.has(hash) || state.isAdmin)) {
        return hash;
    }

    return 'general';
}

function showSection(section) {
    nav.querySelectorAll('[data-settings-nav-link]').forEach((link) => {
        link.classList.toggle('settings-nav__link--active', link.dataset.settingsNavLink === section);
    });

    const [render, wire] = RENDERERS[section];
    panel.innerHTML = render();
    wire?.();
}

nav.addEventListener('click', (event) => {
    const link = event.target.closest('[data-settings-nav-link]');

    if (!link) {
        return;
    }

    window.location.hash = link.dataset.settingsNavLink;
});

window.addEventListener('hashchange', () => showSection(currentSection()));

(async () => {
    await loadAll();
    showSection(currentSection());
})();
