import { fetchCurrentUser, logout as authLogout } from './auth-state';
import { getLocale as readLocale } from './i18n';
import {
    getStoredTheme,
    resolveAppliedTheme,
    setTheme as applyThemeChange,
} from './theme';

/**
 * The one client-side application state that survives navigation under
 * Turbo Drive. Nothing here is ever re-fetched on a soft-navigation —
 * pages patch it in place (setUser, setTheme, pushNotification, ...) and
 * anything that cares subscribes instead of re-requesting the same data
 * `bootstrapAppState()` already loaded once for this session.
 */
const state = {
    user: null,
    ready: { user: false },
    theme: { choice: 'system', applied: 'light' },
    locale: 'en',
    notifications: { items: [], unreadCount: 0 },
    sidebar: { userCollapsed: false },
    presence: { onlineIds: new Set() },
};

const listeners = new Map();

function emit(key) {
    listeners.get(key)?.forEach((fn) => fn(state[key]));
}

export function subscribe(key, fn) {
    if (!listeners.has(key)) {
        listeners.set(key, new Set());
    }

    listeners.get(key).add(fn);

    return () => listeners.get(key)?.delete(fn);
}

export function getState() {
    return state;
}

let bootstrapPromise = null;

/**
 * The ONLY caller of fetchCurrentUser() in the whole app. Because
 * `authenticated.js`'s module URL never changes across a Turbo session,
 * browser ES-module dedup means this whole function body runs exactly
 * once per real page load (first visit, F5, or direct URL) and never
 * again for the rest of that session — no extra "already booted" guard
 * needed.
 */
export function bootstrapAppState() {
    bootstrapPromise ??= (async () => {
        const choice = getStoredTheme();
        state.theme = { choice, applied: resolveAppliedTheme(choice) };
        state.locale = readLocale();

        const user = await fetchCurrentUser();
        state.user = user;
        state.ready.user = true;
        emit('user');

        return user;
    })();

    return bootstrapPromise;
}

export function setUser(patch) {
    if (!state.user) {
        return;
    }

    state.user = { ...state.user, ...patch };
    emit('user');
}

/** Applies the real theme change (DOM + persistence) via theme.js, then patches state. */
export function setTheme(choice) {
    applyThemeChange(choice);
    state.theme = { choice, applied: resolveAppliedTheme(choice) };
    emit('theme');
}

export function setLocale(locale) {
    state.locale = locale;
    emit('locale');
}

export function setNotifications(patch) {
    state.notifications = { ...state.notifications, ...patch };
    emit('notifications');
}

export function pushNotification(notification) {
    state.notifications = {
        items: [notification, ...state.notifications.items].slice(0, 8),
        unreadCount: state.notifications.unreadCount + 1,
    };
    emit('notifications');
}

export function setSidebar(patch) {
    state.sidebar = { ...state.sidebar, ...patch };
    emit('sidebar');
}

export function setPresence(onlineIds) {
    state.presence = { onlineIds };
    emit('presence');
}

export async function logout() {
    await authLogout();
    state.user = null;
    state.ready.user = false;
    state.notifications = { items: [], unreadCount: 0 };
    state.presence = { onlineIds: new Set() };
    bootstrapPromise = null;
    emit('user');
    emit('notifications');
    emit('presence');
}
