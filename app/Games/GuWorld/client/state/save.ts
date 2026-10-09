/**
 * The saved game, format v1, and getting a game back from one.
 *
 * A save holds the format's version, the location the hero is in, the
 * game minutes since the world began (the day and time of day follow),
 * and where the hero stands and faces. The server checks it on the way
 * in (Http/Requests/SaveGameRequest.php); the client checks it again on
 * the way out of the server and before sending.
 *
 * Restoring never trusts what comes back: anything that cannot be used
 * is replaced by something safe — a broken time by the first morning, a
 * broken or out-of-bounds position by the location's spawn, an unknown
 * location or format by the starting location — and each reason is kept
 * in `problems`, so it can be shown and logged. Fields it does not know
 * are ignored.
 */

import { WorldClock } from '../engine/clock';
import type { LocationConfig, LocationId, WorldConfig } from '../world/config';
import { LOCATION_ID } from '../world/config';
import { inside, isPose, wrapAngle } from '../world/space';
import type { Pose } from '../world/space';

export const SAVE_VERSION = 1;

export interface SaveV1 {
    version: typeof SAVE_VERSION;
    location: LocationId;
    world_minutes: number;
    player: Pose;
}

export interface RestoredGame {
    location: LocationId;
    clock: WorldClock;
    player: Pose;
    /** No save at all: a new game. */
    fresh: boolean;
    /** Why parts of the save were replaced; empty when it was sound. */
    problems: string[];
}

type Raw = Record<string, unknown>;

/** A new game: the starting location's spawn, the first morning. */
export function newGame(config: WorldConfig): RestoredGame {
    return {
        location: config.start,
        clock: WorldClock.newGame(),
        player: { ...config.locations.get(config.start)!.spawn },
        fresh: true,
        problems: [],
    };
}

/**
 * The game a save describes. `canBuild` says whether the client can
 * build a location (has its content).
 */
export function restoreGame(
    saved: unknown,
    config: WorldConfig,
    canBuild: (location: LocationId) => boolean = () => true,
): RestoredGame {
    if (saved === null || saved === undefined) {
        return newGame(config);
    }

    const start = newGame(config);
    const problems: string[] = [];

    if (typeof saved !== 'object' || Array.isArray(saved)) {
        return {
            ...start,
            fresh: false,
            problems: ['the save is not an object'],
        };
    }

    const raw = saved as Raw;

    if (raw.version !== SAVE_VERSION) {
        return {
            ...start,
            fresh: false,
            problems: [`unknown save format ${JSON.stringify(raw.version)}`],
        };
    }

    // The location: one of the world's that the client can build.
    let location: LocationConfig = config.locations.get(config.start)!;
    const id = raw.location;
    const accepted =
        typeof id === 'string' && config.locations.has(id) && canBuild(id);

    if (accepted) {
        location = config.locations.get(id)!;
    } else {
        problems.push(
            `unknown location ${JSON.stringify(id)}: back to "${config.start}"`,
        );
    }

    const { clock, repaired } = WorldClock.fromSaved(raw.world_minutes);

    if (repaired) {
        problems.push(
            `broken time ${JSON.stringify(raw.world_minutes) ?? 'undefined'}: the first morning instead`,
        );
    }

    // The hero: where they were, if that is a real point of this location
    // (a position in a location that could not be used means nothing here).
    let player: Pose = { ...location.spawn };

    if (accepted) {
        if (!isPose(raw.player)) {
            problems.push('broken position: back to the spawn');
        } else if (!inside(location.bounds, raw.player)) {
            problems.push('position out of the location: back to the spawn');
        } else {
            const { x, y, z, yaw } = raw.player;
            player = { x, y, z, yaw: wrapAngle(yaw) };
        }
    }

    return { location: location.id, clock, player, fresh: false, problems };
}

/** The save for a game. */
export function makeSave(
    location: LocationId,
    clock: WorldClock,
    player: Pose,
): SaveV1 {
    return {
        version: SAVE_VERSION,
        location,
        world_minutes: clock.minutes,
        player: {
            x: player.x,
            y: player.y,
            z: player.z,
            yaw: wrapAngle(player.yaw),
        },
    };
}

/** What is wrong with a save before it is sent (empty when it is sound). */
export function checkSave(save: SaveV1, config: WorldConfig): string[] {
    const problems: string[] = [];
    const location = config.locations.get(save.location);

    if (save.version !== SAVE_VERSION) {
        problems.push('wrong version');
    }

    if (!LOCATION_ID.test(save.location) || !location) {
        problems.push('unknown location');
    }

    if (WorldClock.fromSaved(save.world_minutes).repaired) {
        problems.push('broken time');
    }

    if (!isPose(save.player)) {
        problems.push('broken position');
    } else if (location && !inside(location.bounds, save.player)) {
        problems.push('position out of the location');
    }

    return problems;
}
