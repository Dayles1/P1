/**
 * The games SPA's API client. It shares exactly one thing with the main
 * app: the bearer token the user signed in with. The server turns it into
 * the user's id, which is all a game knows about the player.
 */

const TOKEN_KEY = 'auth_token';

export class GameApiError extends Error {
    constructor(
        public status: number,
        message: string,
        public data: unknown = null,
    ) {
        super(message || `Request failed (${status})`);
    }
}

export function hasToken(): boolean {
    try {
        return Boolean(localStorage.getItem(TOKEN_KEY));
    } catch {
        return false;
    }
}

/**
 * Calls /api/games/{path} and answers with the envelope's `data`. A
 * missing or expired token sends the player to the app's login page.
 */
export function gameApi<T = unknown>(
    path: string,
    options: { method?: string; body?: unknown; keepalive?: boolean } = {},
): Promise<T> {
    return apiRequest<T>(`/api/games/${path}`, options);
}

/**
 * The same for any URL — a game with an API of its own (like the Sandbox,
 * under /api/sandbox) answers in the same envelope.
 */
export async function apiRequest<T = unknown>(
    url: string,
    {
        method = 'GET',
        body,
        keepalive = false,
    }: { method?: string; body?: unknown; keepalive?: boolean } = {},
): Promise<T> {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };

    try {
        const token = localStorage.getItem(TOKEN_KEY);

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
    } catch {
        // Storage blocked: the request goes out as a guest.
    }

    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'same-origin',
        keepalive,
    });

    const payload = await response.json().catch(() => null);

    if (response.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
    }

    if (!response.ok) {
        throw new GameApiError(
            response.status,
            payload?.message ?? '',
            payload?.data ?? null,
        );
    }

    return (payload?.data ?? null) as T;
}
