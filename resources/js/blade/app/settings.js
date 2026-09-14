import { api } from '../axios';
import { showToast } from '../shared/toast';

const form = document.querySelector('[data-settings-form]');
const timezoneSelect = form?.querySelector('[name="timezone_id"]');

function apiErrors(error) {
    return error?.response?.data?.errors || {};
}

function apiMessage(error, fallback) {
    return error?.response?.data?.message || fallback;
}

function clearFieldErrors() {
    form.querySelectorAll('[data-field-error]').forEach((el) => {
        el.textContent = '';
    });
}

function showFieldErrors(errors) {
    clearFieldErrors();

    Object.entries(errors).forEach(([field, messages]) => {
        const el = form.querySelector(`[data-field-error="${CSS.escape(field)}"]`);

        if (el) {
            el.textContent = Array.isArray(messages) ? messages[0] : messages;
        }
    });
}

function applyLiveTheme(theme) {
    const root = document.documentElement;

    if (theme === 'system') {
        localStorage.removeItem('theme');

        root.dataset.theme = window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';

        return;
    }

    localStorage.setItem('theme', theme);
    root.dataset.theme = theme;
}

async function loadTimezones() {
    try {
        const { data } = await api.get('/timezones');

        const timezones = data.data || [];

        timezoneSelect.innerHTML = timezones
            .map((tz) => `<option value="${tz.id}">${tz.name} (${tz.offset})</option>`)
            .join('');
    } catch {
        timezoneSelect.innerHTML = '<option value="">Could not load timezones</option>';
    }
}

async function loadSettings() {
    try {
        const { data } = await api.get('/profile/settings');
        const settings = data.data;

        if (settings.timezone?.id) {
            timezoneSelect.value = settings.timezone.id;
        }

        if (settings.locale) {
            form.querySelector('[name="locale"]').value = settings.locale;
        }

        if (settings.theme) {
            form.querySelector('[name="theme"]').value = settings.theme;
        }

        if (settings.time_format) {
            form.querySelector('[name="time_format"]').value = settings.time_format;
        }

        if (settings.date_format) {
            form.querySelector('[name="date_format"]').value = settings.date_format;
        }
    } catch (error) {
        showToast(apiMessage(error, 'Could not load your settings.'), 'error');
    }
}

form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    clearFieldErrors();

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    payload.timezone_source = 'manual';

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        await api.put('/profile/settings', payload);

        applyLiveTheme(payload.theme);

        showToast('Settings saved.');
    } catch (error) {
        showFieldErrors(apiErrors(error));
        showToast(apiMessage(error, 'Could not save your settings.'), 'error');
    } finally {
        submitButton.disabled = false;
    }
});

(async () => {
    await loadTimezones();
    await loadSettings();
})();
