/**
 * The game's API client (/api/sandbox/*). It shares exactly one thing with
 * the host application: the bearer token the user signed in with.
 */

import type { SavedHero } from './hero';
import type { Stack, Worn } from './inventory';
import type { SavedResearch } from './research';
import type { Stats } from './stats';
import type { Harvested, Placed } from './world/resources';
import type { PlacedStructure } from './world/structures';

const TOKEN_KEY = 'auth_token';

export interface PlayerState {
    hero: SavedHero;
    x: number;
    y: number;
    z: number;
    yaw: number;
    health: number;
    mana: number;
    inventory: (Stack | null)[];
    equipment: Worn;
    harvested: Harvested[];
    placed: (Placed | PlacedStructure)[];
    stats: Stats;
    research: SavedResearch;
}

export interface SavedPlayer extends Omit<
    PlayerState,
    'hero' | 'health' | 'mana' | 'research'
> {
    /** Null for a character saved before there were heroes (and so on). */
    hero: SavedHero | null;
    health: number | null;
    mana: number | null;
    research: SavedResearch | null;
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

    const response = await fetch(`/api/sandbox/${path}`, {
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

/**
 * Tells the games hub the player is playing (POST
 * /api/games/sandbox/playtime), so the Sandbox can be rated there after a
 * few minutes of play. The hub measures the time between beats itself.
 * Without the hub this simply fails, quietly.
 */
export function playtimeBeat(): void {
    const bearer = token();

    if (!bearer) {
        return;
    }

    fetch('/api/games/sandbox/playtime', {
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

export function loadPlayer(): Promise<SavedPlayer | null> {
    return request<SavedPlayer | null>('player');
}

/** Deletes the character and everything it did: the next visit starts over. */
export function resetPlayer(): Promise<null> {
    return request<null>('player', 'DELETE');
}

export function savePlayer(
    player: Partial<PlayerState>,
    keepalive = false,
): Promise<SavedPlayer> {
    return request<SavedPlayer>('player', 'PUT', player, keepalive);
}
