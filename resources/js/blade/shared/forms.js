import { t } from './i18n';

export function apiErrors(error) {
    return error?.response?.data?.errors || {};
}

export function apiMessage(error, fallback) {
    return (
        error?.response?.data?.message || fallback || t('common.error_generic')
    );
}

export function clearFieldErrors(form) {
    form.querySelectorAll('[data-field-error]').forEach((el) => {
        el.textContent = '';
    });
}

export function showFieldErrors(form, errors) {
    clearFieldErrors(form);

    Object.entries(errors || {}).forEach(([field, messages]) => {
        const el = form.querySelector(
            `[data-field-error="${CSS.escape(field)}"]`,
        );

        if (el) {
            el.textContent = Array.isArray(messages) ? messages[0] : messages;
        }
    });
}

export function escapeHtml(value) {
    return String(value ?? '').replace(
        /[&<>"']/g,
        (char) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[char],
    );
}
