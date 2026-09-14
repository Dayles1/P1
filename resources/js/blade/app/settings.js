import { api } from '../axios';
import { showToast, apiErrorMessage } from '../shared/toast';
import { apiErrors, clearFieldErrors, showFieldErrors } from '../shared/forms';
import { setTheme } from '../shared/theme';
import { getLocale, writeLocaleCookie, t } from '../shared/i18n';

const form = document.querySelector('[data-settings-form]');
const timezoneSelect = form?.querySelector('[name="timezone_id"]');

async function loadTimezones() {
    try {
        const { data } = await api.get('/timezones');

        const timezones = data.data || [];

        timezoneSelect.innerHTML = timezones
            .map((tz) => `<option value="${tz.id}">${tz.name} (${tz.offset})</option>`)
            .join('');
    } catch {
        timezoneSelect.innerHTML = `<option value="">${t('settings.timezones_error')}</option>`;
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
        showToast(apiErrorMessage(error, t('settings.load_error')), 'error');
    }
}

form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    clearFieldErrors(form);

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    payload.timezone_source = 'manual';

    const localeChanged = payload.locale && payload.locale !== getLocale();

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        await api.put('/profile/settings', payload);

        setTheme(payload.theme);

        if (localeChanged) {
            writeLocaleCookie(payload.locale);
            window.location.reload();

            return;
        }

        showToast(t('settings.saved'));
    } catch (error) {
        showFieldErrors(form, apiErrors(error));
        showToast(apiErrorMessage(error, t('settings.error')), 'error');
    } finally {
        submitButton.disabled = false;
    }
});

(async () => {
    await loadTimezones();
    await loadSettings();
})();
