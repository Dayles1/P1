import { api } from '../axios';
import { showToast, apiErrorMessage } from '../shared/toast';
import { escapeHtml } from '../shared/forms';
import { t } from '../shared/i18n';

const container = document.querySelector('[data-admin-settings]');

function groupLabel(group) {
    return t(`admin.group_${group}`) !== `admin.group_${group}` ? t(`admin.group_${group}`) : group;
}

function renderMessage(message) {
    container.innerHTML = `<div class="empty-state"><strong>${message}</strong></div>`;
}

function controlFor(setting) {
    const id = `setting-${setting.id}`;

    if (setting.type === 'boolean') {
        return `
            <div class="select-field" style="max-width:140px;">
                <select class="field-select" id="${id}" data-setting-value data-type="boolean">
                    <option value="true" ${setting.value ? 'selected' : ''}>${t('common.yes')}</option>
                    <option value="false" ${!setting.value ? 'selected' : ''}>${t('common.no')}</option>
                </select>
            </div>
        `;
    }

    if (setting.type === 'integer') {
        return `<input class="field-input" id="${id}" type="number" data-setting-value data-type="integer" value="${setting.value ?? 0}" style="max-width:140px;">`;
    }

    if (setting.type === 'json') {
        return `<textarea class="field-input" id="${id}" data-setting-value data-type="json" rows="3" style="max-width:320px; height:auto;">${escapeHtml(JSON.stringify(setting.value ?? [], null, 2))}</textarea>`;
    }

    if (setting.type === 'text') {
        return `<textarea class="field-input" id="${id}" data-setting-value data-type="text" rows="2" style="max-width:320px; height:auto;">${escapeHtml(setting.value ?? '')}</textarea>`;
    }

    return `<input class="field-input" id="${id}" type="text" data-setting-value data-type="string" value="${escapeHtml(setting.value ?? '')}" style="max-width:320px;">`;
}

function renderSettings(groupedSettings) {
    container.innerHTML = groupedSettings
        .map(({ group, items }) => `
            <div class="settings-section">
                <h2>${groupLabel(group)}</h2>

                <div class="data-list">
                    ${items
                        .map((setting) => `
                            <div class="data-row" data-setting-row="${setting.id}">
                                <div class="data-row__main">
                                    <div class="data-row__title">
                                        ${setting.key}
                                        ${setting.is_locked ? `<span class="pill pill--muted">${t('admin.locked')}</span>` : ''}
                                        ${setting.is_public ? `<span class="pill pill--primary">${t('admin.public')}</span>` : ''}
                                    </div>
                                </div>
                                <div class="data-row__actions">
                                    ${controlFor(setting)}
                                    <button
                                        type="button"
                                        class="btn btn--secondary btn--sm"
                                        data-save-setting="${setting.id}"
                                        ${setting.is_locked ? 'disabled' : ''}
                                    >${t('common.save')}</button>
                                </div>
                            </div>
                        `)
                        .join('')}
                </div>
            </div>
        `)
        .join('');
}

async function loadSettings() {
    try {
        const { data } = await api.get('/admin/settings');

        renderSettings(data.data || []);
    } catch (error) {
        if (error?.response?.status === 403) {
            renderMessage(t('admin.access_denied'));

            return;
        }

        renderMessage(t('common.error_generic'));
        showToast(apiErrorMessage(error, t('common.error_generic')), 'error');
    }
}

container?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-save-setting]');

    if (!button) {
        return;
    }

    const settingId = button.dataset.saveSetting;
    const row = container.querySelector(`[data-setting-row="${settingId}"]`);
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
        await api.patch(`/admin/settings/${settingId}`, { value, operation: 'set' });

        showToast(t('admin.save_success'));
    } catch (error) {
        showToast(apiErrorMessage(error, t('admin.save_error')), 'error');
    } finally {
        button.disabled = false;
    }
});

loadSettings();
