const THEME_KEY = 'theme';
const ACCENT_KEY = 'accent';

/**
 * Read from `window.__themeCatalog` (published by
 * blade.sections.theme-bootstrap, itself rendered from the server-side
 * ThemeCatalog) rather than hand-duplicated here, so the two lists can
 * never drift apart. The fallbacks only matter on a page that, unusually,
 * doesn't include the bootstrap script.
 */
export const THEMES = window.__themeCatalog?.codes || ['auto', 'light', 'dark'];
export const ACCENTS = window.__themeCatalog?.accents || ['default'];

const DEFAULT_THEME = 'auto';
const DEFAULT_ACCENT = 'default';

/**
 * Storage can throw (private mode, blocked site data) — a theme that can't
 * be remembered still has to apply, so every access goes through these.
 */
function readStorage(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeStorage(key, value) {
    try {
        if (value === null) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, value);
        }
    } catch {
        // Nothing to do — the choice still applies for this page view.
    }
}

export function getStoredTheme() {
    const value = readStorage(THEME_KEY);

    return THEMES.includes(value) ? value : DEFAULT_THEME;
}

export function getStoredAccent() {
    const value = readStorage(ACCENT_KEY);

    return ACCENTS.includes(value) ? value : DEFAULT_ACCENT;
}

function systemPrefersDark() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Resolves `auto` down to `light`/`dark` for the actual `data-theme`
 * attribute — `auto` itself is never written to the DOM, only remembered
 * as the user's *choice*.
 */
export function resolveAppliedTheme(theme) {
    if (theme === 'auto') {
        return systemPrefersDark() ? 'dark' : 'light';
    }

    return theme;
}

export function applyTheme(theme, { persist = true } = {}) {
    document.documentElement.dataset.theme = resolveAppliedTheme(theme);

    if (persist) {
        writeStorage(THEME_KEY, theme === DEFAULT_THEME ? null : theme);
    }
}

export function applyAccent(accent, { persist = true } = {}) {
    if (accent === DEFAULT_ACCENT) {
        delete document.documentElement.dataset.accent;
    } else {
        document.documentElement.dataset.accent = accent;
    }

    if (persist) {
        writeStorage(ACCENT_KEY, accent === DEFAULT_ACCENT ? null : accent);
    }
}

/**
 * Runs a visual change inside a view transition when the browser supports
 * one and the user hasn't asked for reduced motion. The animation itself
 * can reject (e.g. the tab loses visibility mid-transition) even though
 * `apply()` already ran — that's cosmetic, so it's swallowed.
 */
function withTransition(apply) {
    const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
    ).matches;

    if (
        !document.startViewTransition ||
        prefersReducedMotion ||
        document.visibilityState !== 'visible'
    ) {
        apply();

        return;
    }

    const transition = document.startViewTransition(apply);
    transition.ready.catch(() => {});
    transition.finished.catch(() => {});
}

export function setTheme(theme) {
    if (!THEMES.includes(theme)) {
        return;
    }

    withTransition(() => applyTheme(theme));
}

export function setAccent(accent) {
    if (!ACCENTS.includes(accent)) {
        return;
    }

    withTransition(() => applyAccent(accent));
}

/**
 * Re-applies the resolved theme whenever the OS preference changes while
 * `auto` is selected. The picker UI itself lives in `./theme-picker.js`.
 */
export function watchSystemTheme() {
    window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => {
            if (getStoredTheme() === 'auto') {
                applyTheme('auto');
            }
        });
}
