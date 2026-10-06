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

    // One pass over the placeholders: a parameter that is a prefix of
    // another (:to / :total) can't eat into it, and a substituted value
    // that happens to contain ":name" is never substituted again.
    return value.replace(/:([A-Za-z_]\w*)/g, (placeholder, name) =>
        Object.hasOwn(params, name) ? String(params[name]) : placeholder,
    );
}

/**
 * The JS twin of trans_choice() for the dictionary's plain plural forms
 * (":count change|:count changes", three forms in Russian, one in
 * Uzbek): picks the form for `count` by the locale's plural rules and
 * fills in :count along with any other params.
 */
export function tChoice(key, count, params = {}) {
    const forms = t(key, { ...params, count }).split('|');

    if (forms.length === 1) {
        return forms[0];
    }

    let category = 'other';

    try {
        category = new Intl.PluralRules(getLocale()).select(count);
    } catch {
        category = count === 1 ? 'one' : 'other';
    }

    const index =
        forms.length === 2
            ? Number(category !== 'one')
            : ({ one: 0, few: 1 }[category] ?? 2);

    return forms[index];
}

const localeDataCache = new Map();

/**
 * Whether the browser really carries the page locale's data. Some builds
 * claim a locale (Chrome and `uz`) but only have its fallback patterns:
 * they print "M09" for a month name and English separators for numbers.
 * A month *name* with digits in it gives that away; callers then build
 * dates and numbers from the dictionary (ui.components.*) instead.
 */
export function hasLocaleData() {
    const locale = getLocale();

    if (!localeDataCache.has(locale)) {
        let available;

        try {
            available = !/\d/.test(
                new Intl.DateTimeFormat(locale, { month: 'long' }).format(
                    new Date(2026, 0, 15),
                ),
            );
        } catch {
            available = false;
        }

        localeDataCache.set(locale, available);
    }

    return localeDataCache.get(locale);
}

/**
 * A number in the page locale. Without the locale's data the digits still
 * come from Intl, but its group and decimal separators ("1,284.5") are
 * swapped for the dictionary's ("1 284,5" in Uzbek).
 */
export function formatNumber(value, options = {}) {
    const number = Number(value) || 0;
    let formatter;

    try {
        formatter = new Intl.NumberFormat(getLocale(), options);
    } catch {
        formatter = new Intl.NumberFormat('en', options);
    }

    if (hasLocaleData()) {
        return formatter.format(number);
    }

    const symbols = {
        group: t('components.number.group'),
        decimal: t('components.number.decimal'),
    };

    return formatter
        .formatToParts(number)
        .map((part) =>
            part.type in symbols &&
            symbols[part.type] !== `components.number.${part.type}`
                ? symbols[part.type]
                : part.value,
        )
        .join('');
}

/**
 * Month name (nominative, "Сентябрь") and short weekday name ("Пн") for
 * pickers — from Intl when the browser has the locale, else from the
 * dictionary. `weekday` follows Date#getDay (0 = Sunday).
 */
export function monthName(monthIndex) {
    if (hasLocaleData()) {
        const name = new Intl.DateTimeFormat(getLocale(), {
            month: 'long',
        }).format(new Date(2026, monthIndex, 1));

        return name.charAt(0).toLocaleUpperCase(getLocale()) + name.slice(1);
    }

    return t(`components.months.${monthIndex}`);
}

export function weekdayShort(weekday) {
    if (hasLocaleData()) {
        // 2026-09-20 is a Sunday; weekday 0..6 counts on from it.
        const name = new Intl.DateTimeFormat(getLocale(), {
            weekday: 'short',
        })
            .format(new Date(2026, 8, 20 + weekday))
            .replace('.', '');

        return name.charAt(0).toLocaleUpperCase(getLocale()) + name.slice(1);
    }

    return t(`components.weekdays_short.${weekday}`);
}

/**
 * Persists the chosen locale (cookie, read by the backend's SetLocale
 * middleware on every subsequent request — including plain page loads,
 * which can't carry a custom header) and, for a signed-in user, saves it
 * to their account too so it follows them across devices. Then reloads
 * the page. It has to be a real reload, not a Turbo soft revisit: the
 * permanent header, sidebar and tab bar (account menu, nav labels) are
 * never re-rendered by Turbo, so a soft visit would leave them in the old
 * language next to freshly translated page content.
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
        const isCurrent = String(el.dataset.localeOption === current);

        // Radio-style menu items use aria-checked, segmented buttons aria-pressed.
        el.setAttribute(
            el.getAttribute('role') === 'menuitemradio'
                ? 'aria-checked'
                : 'aria-pressed',
            isCurrent,
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
