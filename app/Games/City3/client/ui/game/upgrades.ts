/**
 * «Устаревшие дома в кадре» (ui-spec §5.2 UpgradeSheet, §6.5, gdd §11.3):
 * the homes in view grouped by their target level — the ones that can go
 * up now with their price and gain, the blocked ones with the reason —
 * and upgrading a group (or all of them) while the money lasts.
 */

import type { Amounts } from '../../engine/content/types';
import type { Game } from '../../engine/sim/game';
import type { BuildingState } from '../../engine/sim/state';

export interface UpgradeGroup {
    key: string;
    /** The target level's name. */
    level: string;
    homes: BuildingState[];
    /** Why they cannot go up; null when they can. */
    reason: string | null;
    cost: Amounts;
    /** Places gained. */
    gain: number;
}

function add(sum: Amounts, cost: Amounts): void {
    for (const [id, value] of Object.entries(cost)) {
        sum[id] = (sum[id] ?? 0) + value;
    }
}

/** Homes passing `inView`, grouped by type and level; open groups first. */
export function upgradeGroups(
    game: Game,
    inView: (building: BuildingState) => boolean,
): UpgradeGroup[] {
    const groups = new Map<string, UpgradeGroup>();

    for (const building of game.buildings.values()) {
        const def = game.def(building);
        const next = def.levels[building.level];

        if (
            def.category !== 'housing' ||
            !next ||
            building.mothballed ||
            !game.isComplete(building) ||
            game.content.epochOrder(next.epoch) > game.state.epoch ||
            !inView(building)
        ) {
            continue;
        }

        const reason = game.upgradeBlock(building);
        const key = `${building.type}:${building.level}:${reason ?? ''}`;
        let group = groups.get(key);

        if (!group) {
            group = {
                key,
                level: next.name,
                homes: [],
                reason,
                cost: {},
                gain: 0,
            };
            groups.set(key, group);
        }

        group.homes.push(building);
        add(group.cost, game.upgradeCost(building));
        group.gain +=
            next.effects.housing - game.levelDef(building).effects.housing;
    }

    return [...groups.values()].sort(
        (a, b) =>
            Number(a.reason !== null) - Number(b.reason !== null) ||
            b.homes.length - a.homes.length,
    );
}

/** How many of these homes the treasury can upgrade now, in order. */
export function affordableCount(
    game: Game,
    homes: readonly BuildingState[],
): number {
    const sum: Amounts = {};
    let count = 0;

    for (const home of homes) {
        add(sum, game.upgradeCost(home));

        if (!game.canAfford(sum)) {
            break;
        }

        count++;
    }

    return count;
}

/** Upgrades the homes in order while money lasts; how many went up. */
export function upgradeHomes(
    game: Game,
    homes: readonly BuildingState[],
): number {
    let done = 0;

    for (const home of homes) {
        if (game.upgrade(home.uid, true).ok) {
            done++;
        } else if (!game.canAfford(game.upgradeCost(home))) {
            break;
        }
    }

    if (done) {
        game.structureChanged();
    }

    return done;
}
