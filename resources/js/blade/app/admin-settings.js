import { api } from '../axios';
import { showToast } from '../shared/toast';

const container = document.querySelector('[data-admin-settings]');

const GROUP_LABELS = {
    auth: 'Authentication',
    system: 'System',
    localization: 'Localization',
    upload: 'Uploads',
    notification: 'Notifications',
    user: 'User',
    security: 'Security',
};

function apiMessage(error, fallback) {
    return error?.response?.data?.message || fallback;
}

function renderMessage(message) {
    container.innerHTML = `<div class="empty-state"><strong>${message}</strong></div>`;
}

function controlFor(setting) {
    const id = `setting-${setting.id}`;

    if (setting.type === 'boolean') {
        return `
            <select class="field-select" id="${id}" data-setting-value data-type="boolean" style="max-width:140px;">
                <option value="true" ${setting.value ? 'selected' : ''}>On</option>
                <option value="false" ${!setting.value ? 'selected' : ''}>Off</option>
            </select>
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

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[char]);
}

function renderSettings(groupedSettings) {
    container.innerHTML = groupedSettings
        .map(({ group, items }) => `
            <div class="settings-section">
                <h2>${GROUP_LABELS[group] || group}</h2>

                <div class="data-list">
                    ${items
                        .map((setting) => `
                            <div class="data-row" data-setting-row="${setting.id}">
                                <div class="data-row__main">
                                    <div class="data-row__title">
                                        ${setting.key}
                                        ${setting.is_locked ? '<span class="pill pill--muted">Locked</span>' : ''}
                                        ${setting.is_public ? '<span class="pill pill--primary">Public</span>' : ''}
                                    </div>
                                </div>
                                <div class="data-row__actions">
                                    ${controlFor(setting)}
                                    <button
                                        type="button"
                                        class="btn btn--secondary btn--sm"
                                        data-save-setting="${setting.id}"
                                        ${setting.is_locked ? 'disabled' : ''}
                                    >Save</button>
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
            renderMessage('You do not have access to this page.');

            return;
        }

        renderMessage('Could not load settings.');
        showToast(apiMessage(error, 'Could not load settings.'), 'error');
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
            showToast('Invalid JSON value.', 'error');

            return;
        }
    }

    button.disabled = true;

    try {
        await api.patch(`/admin/settings/${settingId}`, { value, operation: 'set' });

        showToast('Setting updated.');
    } catch (error) {
        showToast(apiMessage(error, 'Could not update setting.'), 'error');
    } finally {
        button.disabled = false;
    }
});

loadSettings();
