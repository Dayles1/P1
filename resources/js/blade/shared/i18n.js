/**
 * Thin client over the SAME dictionary Blade uses server-side
 * (`lang/{locale}/ui.php`, injected as `window.__i18n` by
 * `blade.sections.i18n-bootstrap`) — one source of truth for UI strings,
 * shared between server-rendered markup and JS-rendered content (tables,
 * toasts, empty states, pagination…).
 */

const LOCALE_COOKIE = 'locale';

export function getLocale() {
    return window.__i18n?.locale || 'en';
}

function readCookie(name) {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));

    return match ? decodeURIComponent(match[1]) : null;
}

export function writeLocaleCookie(locale) {
    document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Dot-path lookup into the translation dictionary, e.g. t('sessions.empty').
 * Falls back to the key itself so a missing translation is visible/obvious
 * during development rather than silently blank.
 */
export function t(key, params = {}) {
    const strings = window.__i18n?.strings || {};
    const value = key
        .split('.')
        .reduce(
            (acc, part) =>
                acc && typeof acc === 'object' ? acc[part] : undefined,
            strings,
        );

    if (typeof value !== 'string') {
        return key;
    }

    return Object.entries(params).reduce(
        (result, [paramKey, paramValue]) =>
            result.replaceAll(`:${paramKey}`, String(paramValue)),
        value,
    );
}

/**
 * Persists the chosen locale (cookie, read by the backend's SetLocale
 * middleware on every subsequent request — including plain page loads,
 * which can't carry a custom header) and, for a signed-in user, saves it
 * to their account too so it follows them across devices. Reloads the page
 * so server-rendered text picks up the new language immediately.
 */
export async function setLocale(locale, { api } = {}) {
    writeLocaleCookie(locale);

    if (api) {
        try {
            await api.put('/profile/settings', { locale });
        } catch {
            // Not signed in, or save failed — the cookie still switches the
            // language for this browser, which is what actually matters here.
        }
    }

    window.location.reload();
}

export function initLocalePicker(apiClient) {
    const options = document.querySelectorAll('[data-locale-option]');

    if (!options.length) {
        return;
    }

    const current = getLocale();

    options.forEach((el) => {
        el.setAttribute(
            'aria-checked',
            String(el.dataset.localeOption === current),
        );

        el.addEventListener('click', () => {
            if (el.dataset.localeOption === current) {
                return;
            }

            setLocale(el.dataset.localeOption, { api: apiClient });
        });
    });
}

export { readCookie };
