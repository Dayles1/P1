import { api } from '../axios';

const TOKEN_KEY = 'auth_token';

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
        .catch(() => {
            clearToken();

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
    }
}
