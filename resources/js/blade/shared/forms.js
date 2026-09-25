import { t } from './i18n';
import { icon } from './icon';

export function apiErrors(error) {
    return error?.response?.data?.errors || {};
}

export function apiMessage(error, fallback) {
    return (
        error?.response?.data?.message || fallback || t('common.error_generic')
    );
}

/**
 * The one form error convention across the app: a field's message goes
 * into `[data-field-error="<name>"]`, and the input itself is marked
 * `aria-invalid` (which .field-input styles). Auth pages and settings
 * both go through these two helpers.
 */
export function clearFieldErrors(form) {
    form.querySelectorAll('[data-field-error]').forEach((el) => {
        el.textContent = '';
        el.removeAttribute('data-visible');
    });

    form.querySelectorAll('[aria-invalid="true"]').forEach((el) => {
        el.removeAttribute('aria-invalid');
    });
}

export function showFieldErrors(form, errors) {
    clearFieldErrors(form);

    Object.entries(errors || {}).forEach(([field, messages]) => {
        const key = CSS.escape(field);
        const el = form.querySelector(`[data-field-error="${key}"]`);

        form.querySelector(`[name="${key}"]`)?.setAttribute(
            'aria-invalid',
            'true',
        );

        if (el) {
            const message = Array.isArray(messages) ? messages[0] : messages;

            // Field errors carry the alert icon; a form-level slot (e.g.
            // the auth banner, data-field-error="general") is plain text.
            el.innerHTML =
                field === 'general'
                    ? ''
                    : icon('alert', {
                          size: 14,
                          className: 'field-error__icon',
                      });
            el.append(message);
            el.setAttribute('data-visible', 'true');
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
