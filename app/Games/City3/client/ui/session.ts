/**
 * Saving (ui-spec §6.12): changes go up every 20 s when the game changed,
 * and once more when the tab hides or the player leaves. One request at a
 * time. A 409 means another tab or device saved meanwhile: saving stops
 * and the conflict dialog offers to load that version or to keep this one
 * — a forced overwrite that sends the whole city (lead decision 5).
 */

import { api, GameApiError } from '../api';
import { restoreChanges, takeChanges } from '../engine/save/serializer';
import type { Game } from '../engine/sim/game';
import type { SaveState } from './store/hud-store';

export const AUTOSAVE_MS = 20_000;

export interface SessionHooks {
    onState: (state: SaveState, savedAt?: number) => void;
    onConflict: () => void;
}

export class SaveSession {
    /** The server's revision of the world. */
    private revision: number;
    /** The game revision of the last save sent. */
    private savedGameRevision: number;
    private inFlight: Promise<unknown> | null = null;
    private conflict = false;

    constructor(
        private game: Game,
        revision: number,
        private hooks: SessionHooks,
    ) {
        this.revision = revision;
        this.savedGameRevision = game.revision;
    }

    get blocked(): boolean {
        return this.conflict;
    }

    dirty(): boolean {
        return this.game.revision !== this.savedGameRevision;
    }

    async save(keepalive = false): Promise<void> {
        if (this.conflict || this.inFlight) {
            return;
        }

        const game = this.game;

        this.savedGameRevision = game.revision;
        this.hooks.onState('saving');

        const payload = takeChanges(game, this.revision);
        const request = api<{ revision: number }>('world', {
            method: 'PUT',
            body: payload,
            keepalive,
        });

        // Kept until it settles, so leaving the page can wait for it.
        this.inFlight = request.catch(() => null);

        try {
            const result = await request;

            this.revision = result.revision;
            this.hooks.onState('saved', Date.now());
        } catch (failure) {
            restoreChanges(game, payload);

            if (failure instanceof GameApiError && failure.status === 409) {
                this.conflict = true;
                this.hooks.onState('off');
                this.hooks.onConflict();
            } else {
                this.savedGameRevision = -1;
                this.hooks.onState('failed');
            }
        } finally {
            this.inFlight = null;
        }
    }

    /**
     * «Оставить эту версию»: sends the whole city with `force`, so the
     * server takes it over the newer save. True when it went through.
     */
    async keepThisVersion(): Promise<boolean> {
        await this.flush();

        const game = this.game;

        for (const uid of game.buildings.keys()) {
            game.changedBuildings.add(uid);
        }

        this.savedGameRevision = game.revision;
        this.hooks.onState('saving');

        const payload = takeChanges(game, this.revision);

        try {
            const result = await api<{ revision: number }>('world', {
                method: 'PUT',
                body: { ...payload, force: true },
            });

            this.revision = result.revision;
            this.conflict = false;
            this.hooks.onState('saved', Date.now());

            return true;
        } catch {
            restoreChanges(game, payload);
            this.hooks.onState('off');

            return false;
        }
    }

    /** Waits for the save in flight, if any. */
    async flush(): Promise<void> {
        while (this.inFlight) {
            await this.inFlight;
        }
    }

    /** Autosave and the last save on hide; returns the cleanup. */
    start(): () => void {
        const timer = window.setInterval(() => {
            if (this.dirty()) {
                void this.save();
            }
        }, AUTOSAVE_MS);
        const onHide = () => {
            if (document.visibilityState === 'hidden' && this.dirty()) {
                void this.save(true);
            }
        };

        document.addEventListener('visibilitychange', onHide);

        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onHide);

            if (this.dirty()) {
                void this.save(true);
            }
        };
    }
}
