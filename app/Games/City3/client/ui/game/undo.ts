/**
 * Demolition with a 5-second «Отменить» instead of confirmation dialogs
 * (ui-spec §6.3, lead decision 4). The buildings are copied before the
 * engine removes them; undoing puts the copies back on their tiles and
 * takes the refund back out of the treasury. Undo is refused when a tile
 * was taken meanwhile or the refund has already been spent.
 */

import type { Game } from '../../engine/sim/game';
import type { BuildingState } from '../../engine/sim/state';

export interface Demolition {
    buildings: BuildingState[];
    refund: number;
    name: string;
}

/** Demolishes the buildings (the Town Hall is skipped); null when none went. */
export function demolish(
    game: Game,
    uids: readonly number[],
): Demolition | null {
    const taken: BuildingState[] = [];
    const before = game.money;
    let name = '';

    for (const uid of uids) {
        const building = game.buildings.get(uid);

        if (!building || game.roleOf(building) === 'center') {
            continue;
        }

        const copy = structuredClone(building);
        const label = game.nameOf(building);

        if (game.demolish(uid).ok) {
            taken.push(copy);
            name ||= label;
        }
    }

    return taken.length
        ? { buildings: taken, refund: Math.max(0, game.money - before), name }
        : null;
}

function footprintFree(game: Game, building: BuildingState): boolean {
    const { w, h } = game.def(building).size;

    for (let y = building.y; y < building.y + h; y++) {
        for (let x = building.x; x < building.x + w; x++) {
            if (game.map.occupantAt(x, y) !== 0) {
                return false;
            }
        }
    }

    return true;
}

/** Puts a demolition back; false when it can no longer be undone. */
export function undoDemolition(game: Game, demolition: Demolition): boolean {
    const currency = game.content.currency;

    if (
        (!game.infinite && game.money < demolition.refund - 1e-6) ||
        !demolition.buildings.every((building) => footprintFree(game, building))
    ) {
        return false;
    }

    for (const building of demolition.buildings) {
        const { w, h } = game.def(building).size;

        game.buildings.set(building.uid, building);

        for (let y = building.y; y < building.y + h; y++) {
            for (let x = building.x; x < building.x + w; x++) {
                if (game.map.inBounds(x, y)) {
                    game.map.occupant[game.map.index(x, y)] = building.uid;
                }
            }
        }

        game.deletedBuildings.delete(building.uid);
        game.changedBuildings.add(building.uid);
    }

    game.state.resources[currency] = Math.max(
        0,
        (game.state.resources[currency] ?? 0) - demolition.refund,
    );
    game.state.stats.demolished = Math.max(
        0,
        game.state.stats.demolished - demolition.buildings.length,
    );
    game.structureChanged();

    return true;
}
