/**
 * Construction prices (gdd §4.9), as pure functions: a level's list price,
 * an upgrade by trade-in — credited with the money actually paid for the
 * building, never more than its current level's list price — the refund
 * of half the money paid, the price of a move and the Spirit of the Age
 * discount (gdd §2.2) of the Town Hall and discoveries.
 *
 * A chain of upgrades never beats a direct build: the credit is at most
 * `tradeIn` (70 %) of what was paid, so paid + upgrade ≥ the target's
 * list price.
 */

import type { Amounts, WorldFile } from '../content/types';

type EconomyRules = WorldFile['economy'];
type SpiritRules = WorldFile['chronicle']['spirit'];

/** A price times a share: money rounded up to whole coins, materials to 0.1. */
export function scalePrice(
    cost: Amounts,
    share: number,
    money: string,
): Amounts {
    return Object.fromEntries(
        Object.entries(cost).map(([id, amount]) => [
            id,
            id === money
                ? Math.ceil(amount * share - 1e-9)
                : Math.round(amount * share * 10) / 10,
        ]),
    );
}

/**
 * Share of the target level's price an upgrade costs:
 * `max(floor, 1 − tradeIn × min(paid, list of the current level) / target)`.
 */
export function tradeInShare(
    paid: number,
    currentList: number,
    targetMoney: number,
    rules: Pick<EconomyRules, 'tradeIn' | 'upgradeFloor'>,
): number {
    if (!(targetMoney > 0)) {
        return 1;
    }

    const credit = Math.min(Math.max(0, paid), Math.max(0, currentList));

    return Math.max(
        rules.upgradeFloor,
        1 - (rules.tradeIn * credit) / targetMoney,
    );
}

/** The price of bringing a building up to `target` (money and materials alike). */
export function upgradePrice(
    target: Amounts,
    money: string,
    paid: number,
    currentList: number,
    rules: Pick<EconomyRules, 'tradeIn' | 'upgradeFloor'>,
): Amounts {
    return scalePrice(
        target,
        tradeInShare(paid, currentList, target[money] ?? 0, rules),
        money,
    );
}

/** Money a demolition returns: a share of the money actually paid (never of the list price). */
export function refundOf(
    paid: number,
    rules: Pick<EconomyRules, 'refundShare'>,
): number {
    return Math.floor(Math.max(0, paid) * rules.refundShare);
}

/** Money a move costs: a share of the current level's list price. */
export function moveCost(
    listMoney: number,
    rules: Pick<EconomyRules, 'moveShare'>,
): number {
    return Math.ceil(Math.max(0, listMoney) * rules.moveShare - 1e-9);
}

/**
 * Spirit of the Age (gdd §2.2): once the calendar is past the next era's
 * historical year, the Town Hall upgrade and every discovery cost
 * `min(cap, perYear × (year − H_next))` less. 0 in the last era.
 */
export function spiritDiscount(
    year: number,
    nextHistoricalYear: number | undefined,
    rules: SpiritRules,
): number {
    if (nextHistoricalYear === undefined) {
        return 0;
    }

    return Math.min(
        rules.cap,
        Math.max(0, (year - nextHistoricalYear) * rules.perYear),
    );
}
