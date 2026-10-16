/**
 * The game's API client (/api/city3/*). It shares exactly one thing with
 * the host application: the bearer token the user signed in with. The
 * server turns it into the user's id, which is all the game knows about
 * the player.
 */

const TOKEN_KEY = 'auth_token';

/** How often the playtime heartbeat goes out; the hub counts at most this much per beat. */
const HEARTBEAT_MS = 60_000;

export class GameApiError extends Error {
    constructor(
        public status: number,
        message: string,
        public data: unknown = null,
    ) {
        super(message || `Request failed (${status})`);
    }
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

/**
 * Calls /api/city3/{path} and answers with the envelope's `data`. A
 * missing or expired token sends the player to the app's login page; any
 * other failure throws a GameApiError with the status and the envelope's
 * message and data (a 409 save conflict carries the current revision).
 */
export async function api<T = unknown>(
    path: string,
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
    const bearer = token();

    if (bearer) {
        headers.Authorization = `Bearer ${bearer}`;
    }

    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`/api/city3/${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'same-origin',
        keepalive,
    });

    const payload = await response.json().catch(() => null);

    if (response.status === 401) {
        goToLogin();
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

/**
 * Tells the games hub the player is playing (POST
 * /api/games/city3/playtime), so the game can be rated there after a few
 * minutes of play. The hub measures the time between beats itself, so a
 * missed or extra beat can't make the clock run faster. Without the hub
 * this simply fails, quietly.
 */
export function playtimeBeat(): void {
    const bearer = token();

    if (!bearer || document.visibilityState !== 'visible') {
        return;
    }

    fetch('/api/games/city3/playtime', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            Authorization: `Bearer ${bearer}`,
        },
        credentials: 'same-origin',
    }).catch(() => {
        // Offline or throttled: the next beat catches up.
    });
}

/**
 * Beats now and then once a minute while the tab is visible. Returns the
 * function that stops it.
 */
export function startPlaytime(): () => void {
    playtimeBeat();

    const timer = window.setInterval(playtimeBeat, HEARTBEAT_MS);

    return () => window.clearInterval(timer);
}
