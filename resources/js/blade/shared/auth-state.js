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
 */
export async function fetchCurrentUser() {
    if (!getToken()) {
        return null;
    }

    try {
        const { data } = await api.get('/auth/me');

        return data?.data?.user ?? null;
    } catch {
        clearToken();

        return null;
    }
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
