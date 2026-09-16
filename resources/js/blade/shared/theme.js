const THEME_KEY = 'theme';

/**
 * Read from `window.__themeCatalog` (published by
 * blade.sections.theme-bootstrap, itself rendered from the server-side
 * ThemeCatalog) rather than hand-duplicated here — two independent copies
 * of this list previously drifted apart as palettes were added, which is
 * exactly what silently broke persisting anything but the original 6
 * themes. The fallback below only matters if this module is ever loaded on
 * a page that, unusually, doesn't include the bootstrap script.
 */
const FALLBACK_THEMES = ['system', 'light', 'dark'];
const FALLBACK_DARK_THEMES = ['dark'];

export const THEMES = window.__themeCatalog?.codes || FALLBACK_THEMES;
const DARK_THEMES = window.__themeCatalog?.darkCodes || FALLBACK_DARK_THEMES;

export function getStoredTheme() {
    const value = localStorage.getItem(THEME_KEY);

    return THEMES.includes(value) ? value : 'system';
}

function systemPrefersDark() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Resolves `system` down to `light`/`dark` for the actual `data-theme`
 * attribute — `system` itself is never written to the DOM or persisted as
 * an applied value, only remembered as the user's *choice*.
 */
export function resolveAppliedTheme(theme) {
    if (theme === 'system') {
        return systemPrefersDark() ? 'dark' : 'light';
    }

    return theme;
}

export function applyTheme(theme, { persist = true } = {}) {
    const applied = resolveAppliedTheme(theme);

    document.documentElement.dataset.theme = applied;
    document.documentElement.style.colorScheme = DARK_THEMES.includes(applied)
        ? 'dark'
        : 'light';

    if (persist) {
        if (theme === 'system') {
            localStorage.removeItem(THEME_KEY);
        } else {
            localStorage.setItem(THEME_KEY, theme);
        }
    }
}

export function setTheme(theme) {
    if (!THEMES.includes(theme)) {
        return;
    }

    const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
    ).matches;
    const apply = () => applyTheme(theme);

    if (
        !document.startViewTransition ||
        prefersReducedMotion ||
        document.visibilityState !== 'visible'
    ) {
        apply();

        return;
    }

    // The animation itself can reject (e.g. the tab loses visibility mid-
    // transition) even though `apply()` already ran and the theme is
    // correctly applied — that's a cosmetic animation failure, not a
    // functional one, so it's swallowed rather than left as an unhandled
    // rejection.
    const transition = document.startViewTransition(apply);
    transition.ready.catch(() => {});
    transition.finished.catch(() => {});
}

/**
 * Re-applies the resolved theme whenever the OS preference changes while
 * `system` is selected. The picker UI itself lives in `./theme-picker.js`.
 */
export function watchSystemTheme() {
    window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => {
            if (getStoredTheme() === 'system') {
                applyTheme('system');
            }
        });
}
