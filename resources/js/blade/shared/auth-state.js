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
 * Under Turbo Drive, `app-state.js`'s `bootstrapAppState()` is the only
 * caller of this and only ever calls it once per real page load, so the
 * cached promise below mainly guards against the very first load (where
 * the shared chrome bootstrap and, historically, a page's own script
 * could both ask at once) rather than across navigations.
 */
let currentUserPromise = null;

export async function fetchCurrentUser() {
    if (!getToken()) {
        return null;
    }

    currentUserPromise ??= api
        .get('/auth/me')
        .then(({ data }) => data?.data?.user ?? null)
        .catch((error) => {
            // Only a 401 actually proves the token is dead. A 500, a
            // timeout or a dropped connection says nothing about the
            // session, and dropping the token there logged the user
            // straight back out of a perfectly good login.
            if (error?.response?.status === 401) {
                clearToken();
            }

            return null;
        })
        .finally(() => {
            // Don't cache a failed/null result forever — a later call
            // (a retry, or logging back in on the same page) should ask
            // again instead of replaying this one.
            currentUserPromise = null;
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

    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
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

/**
 * The --hue-* pair an initials avatar takes — the same pick as
 * App\View\Components\Blade\UI\Avatar::hueFor(), so a person keeps one
 * color whether the avatar was rendered by Blade or by JS.
 */
const AVATAR_HUES = [
    'blue',
    'sky',
    'violet',
    'green',
    'amber',
    'rose',
    'teal',
    'orange',
];

export function avatarHue(name) {
    const sum = [...(name || '')].reduce(
        (total, char) => total + char.codePointAt(0),
        0,
    );

    return AVATAR_HUES[sum % AVATAR_HUES.length];
}
