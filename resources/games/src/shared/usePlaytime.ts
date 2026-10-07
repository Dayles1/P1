import { useEffect } from 'react';
import { gameApi } from './api';

/** How often the heartbeat goes out; the server counts at most this much per beat. */
const HEARTBEAT_MS = 60_000;

/**
 * Counts the player's time in a game: a heartbeat to
 * POST /api/games/{slug}/playtime on mount and then once a minute while the
 * tab is visible. The server measures the time between beats itself, so a
 * missed or extra beat can't make the clock run faster.
 */
export function usePlaytime(slug: string): void {
    useEffect(() => {
        const beat = () => {
            if (document.visibilityState !== 'visible') {
                return;
            }

            gameApi(`${slug}/playtime`, { method: 'POST' }).catch(() => {
                // Offline or throttled: the next beat catches up.
            });
        };

        beat();

        const timer = window.setInterval(beat, HEARTBEAT_MS);

        return () => window.clearInterval(timer);
    }, [slug]);
}
