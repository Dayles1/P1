import { api } from '../axios';

const TOKEN_KEY = 'auth_token';
const HEADER_SNAPSHOT_KEY = 'header_snapshot';

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

/**
 * A tiny "who am I" snapshot (name + avatar URL) kept in sessionStorage so
 * the header can paint the real avatar immediately on every new page load
 * — before the /auth/me round-trip even starts — instead of showing a
 * placeholder and popping in the photo a moment later on every navigation.
 * Session-scoped (not localStorage) so it naturally can't leak across a
 * different login in a different tab; still explicitly cleared on logout
 * and whenever a fetch turns up no user, so a stale snapshot never outlives
 * the session it belongs to.
 */
export function getHeaderSnapshot() {
    try {
        const raw = sessionStorage.getItem(HEADER_SNAPSHOT_KEY);

        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function saveHeaderSnapshot(user) {
    try {
        sessionStorage.setItem(HEADER_SNAPSHOT_KEY, JSON.stringify({
            name: user.name,
            avatarUrl: user.avatar?.url || null,
        }));
    } catch {
        // Storage unavailable (private mode etc) — the header just won't
        // have a snapshot to paint from on the next load, nothing breaks.
    }
}

function clearHeaderSnapshot() {
    try {
        sessionStorage.removeItem(HEADER_SNAPSHOT_KEY);
    } catch {
        // Nothing to clean up if storage was never reachable.
    }
}

/**
 * Sanctum bearer tokens are the only real signal of auth state in this
 * app (login never establishes a server session), so "am I logged in"
 * is always resolved by asking the API, never by trusting a Blade
 * @auth/@guest check.
 *
 * Every authenticated page loads both the shared site-chrome bootstrap
 * (header user menu) and its own page script, and both used to call this
 * independently — two `GET /auth/me` requests per page load for no reason.
 * The in-flight/resolved promise is cached for the lifetime of the page
 * (a real login/logout always does a full navigation, so there's never a
 * stale-cache case to invalidate within one page's lifetime).
 */
let currentUserPromise = null;

export async function fetchCurrentUser() {
    if (!getToken()) {
        return null;
    }

    currentUserPromise ??= api
        .get('/auth/me')
        .then(({ data }) => data?.data?.user ?? null)
        .then((user) => {
            if (user) {
                saveHeaderSnapshot(user);
            } else {
                clearHeaderSnapshot();
            }

            return user;
        })
        .catch(() => {
            clearToken();
            clearHeaderSnapshot();

            return null;
        })
        .finally(() => {
            // Don't cache a null result forever — a later call (e.g. right
            // after logging back in on the same page) should retry.
            if (!getToken()) {
                currentUserPromise = null;
            }
        });

    return currentUserPromise;
}

export function hasRole(user, ...codes) {
    if (!user?.roles?.length) {
        return false;
    }

    return user.roles.some((role) => codes.includes(role.code));
}

export function initials(name) {
    const parts = (name || '').trim().split(/\s+/);

    return (
        (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
    ).toUpperCase() || '?';
}

export async function logout() {
    try {
        await api.post('/auth/logout');
    } catch {
        // ignore — we clear client state regardless
    } finally {
        clearToken();
        clearHeaderSnapshot();
    }
}
