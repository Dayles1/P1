/**
 * GU World's API client (/api/gu-world/*). It shares exactly one thing
 * with the host application: the bearer token the user signed in with.
 */

const TOKEN_KEY = 'auth_token';

/** A saved game as the server keeps it (checked again by the client on load). */
export interface SavedGame {
    version: number;
    location: string;
    world_minutes: number;
    player: { x: number; y: number; z: number; yaw: number };
    saved_at: string | null;
}

function token(): string | null {
    try {
        return localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

export function hasToken(): boolean {
    return Boolean(token());
}

export function goToLogin(): void {
    window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
}

async function request<T>(
    path: string,
    method = 'GET',
    body?: unknown,
    keepalive = false,
): Promise<T> {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };
    const bearer = token();

    if (bearer) {
        headers.Authorization = `Bearer ${bearer}`;
    }

    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`/api/gu-world/${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'same-origin',
        keepalive,
    });

    if (response.status === 401) {
        goToLogin();
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(
            payload?.message || `Request failed (${response.status})`,
        );
    }

    return (payload?.data ?? null) as T;
}

/** The player's saved game, or null for a new one. */
export function loadSave(): Promise<SavedGame | null> {
    return request<SavedGame | null>('save');
}
