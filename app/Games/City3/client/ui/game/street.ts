/**
 * «Улучшить улицу (12 участков)» (gdd §11.3, ui-spec §6.5 step 4): the
 * street of a road tile is the straight run of road tiles at the same
 * level through it, along the longer of its two axes.
 */

import type { Amounts } from '../../engine/content/types';
import type { Game } from '../../engine/sim/game';
import type { BuildingState } from '../../engine/sim/state';

function run(
    game: Game,
    road: BuildingState,
    dx: number,
    dy: number,
): BuildingState[] {
    const list: BuildingState[] = [];

    for (const sign of [-1, 1]) {
        let x = road.x + dx * sign;
        let y = road.y + dy * sign;

        for (;;) {
            const next = game.buildingAt(x, y);

            if (
                !next ||
                game.roleOf(next) !== 'road' ||
                next.level !== road.level
            ) {
                break;
            }

            list.push(next);
            x += dx * sign;
            y += dy * sign;
        }
    }

    return list;
}

/** The road tiles of a street, the tile itself included. */
export function streetOf(game: Game, road: BuildingState): BuildingState[] {
    const across = run(game, road, 1, 0);
    const along = run(game, road, 0, 1);

    return [road, ...(across.length >= along.length ? across : along)];
}

/** What upgrading a street one level costs; null when it cannot go up. */
export function streetUpgrade(
    game: Game,
    road: BuildingState,
): { tiles: BuildingState[]; cost: Amounts; level: number } | null {
    const level = road.level + 1;
    const def = game.def(road);

    if (!def.levels[level - 1] || game.levelLock(def, level)) {
        return null;
    }

    const tiles = streetOf(game, road).filter((tile) => game.isComplete(tile));
    const cost: Amounts = {};

    for (const tile of tiles) {
        for (const [id, value] of Object.entries(
            game.relevelCost(tile, level),
        )) {
            cost[id] = (cost[id] ?? 0) + value;
        }
    }

    return { tiles, cost, level };
}

/** Upgrades the street while money lasts; how many tiles went up. */
export function upgradeStreet(game: Game, road: BuildingState): number {
    const plan = streetUpgrade(game, road);
    let done = 0;

    if (!plan) {
        return 0;
    }

    for (const tile of plan.tiles) {
        if (game.relevel(tile.uid, plan.level, true).ok) {
            done++;
        } else {
            break;
        }
    }

    if (done) {
        game.structureChanged();
    }

    return done;
}
