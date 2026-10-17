import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import { Game } from './game';
import {
    moveCost,
    refundOf,
    scalePrice,
    spiritDiscount,
    tradeInShare,
    upgradePrice,
} from './pricing';

const { content } = loadContent();
const rules = content.world.economy;

describe('trade-in (gdd §4.9)', () => {
    it('credits 70 % of what was paid, at most the current list price, down to a 25 % floor', () => {
        // House L1 (28) → L2 (48): 1 − 0.7 × 28 / 48.
        expect(tradeInShare(28, 28, 48, rules)).toBeCloseTo(
            1 - (0.7 * 28) / 48,
        );
        // Paid more than the list (imports): only the list counts.
        expect(tradeInShare(40, 28, 48, rules)).toBeCloseTo(
            1 - (0.7 * 28) / 48,
        );
        // Paid nothing (the start's Town Hall, a free gift): no credit.
        expect(tradeInShare(0, 28, 48, rules)).toBe(1);
        // A cheap target: never below a quarter of its price.
        expect(tradeInShare(1000, 1000, 100, rules)).toBe(0.25);
        expect(
            upgradePrice({ money: 48, mat: 3.8 }, 'money', 28, 28, rules),
        ).toEqual({ money: 29, mat: 2.2 });
    });

    it('never lets a chain beat the direct build', () => {
        for (const id of ['house', 'farm', 'market', 'school', 'temple']) {
            const levels = content.building(id).levels;

            for (let from = 0; from < levels.length - 1; from++) {
                for (let to = from + 1; to < levels.length; to++) {
                    const paid = levels[from].cost.money;
                    const step = upgradePrice(
                        levels[to].cost,
                        'money',
                        paid,
                        paid,
                        rules,
                    );

                    expect(
                        paid + step.money,
                        `${id} L${from + 1} → L${to + 1}`,
                    ).toBeGreaterThanOrEqual(levels[to].cost.money);
                }
            }
        }
    });

    it('chains in the game cost at least the direct build, with the money really paid', () => {
        const chain = Game.create(content, 7);
        const direct = Game.create(content, 7);

        for (const game of [chain, direct]) {
            game.state.resources.money = 100_000;
            game.state.techs = ['masonry'];
            game.state.population = 30;
        }

        for (const game of [chain, direct]) {
            // Water for the house’s second level (tier 1).
            // Beside the Town Hall (x 49–50, rows 19–20): connected without a street.
            expect(game.place('well', 51, 20).ok).toBe(true);
            game.testerFinish();
        }

        const before = chain.money;

        expect(chain.place('house', 51, 19, 1).ok).toBe(true);
        chain.testerFinish();

        const house = chain.buildingAt(51, 19)!;

        // Materials came from the stores: the money paid is the list price.
        expect(house.paid).toBe(28);
        expect(chain.upgrade(house.uid).ok).toBe(true);
        expect(chain.workingLevel(house)).toBe(1);

        const chainCost = before - chain.money;
        const directBefore = direct.money;

        expect(direct.place('house', 51, 19, 2).ok).toBe(true);
        expect(chainCost).toBeGreaterThanOrEqual(directBefore - direct.money);
        expect(house.paid).toBe(chainCost);
    });
});

describe('refunds and moves (gdd §4.9)', () => {
    it('return half of the money paid, never of the list price', () => {
        expect(refundOf(570, rules)).toBe(285);
        expect(refundOf(0, rules)).toBe(0);
        expect(moveCost(360, rules)).toBe(36);
    });

    it('refund an organically grown home on what was paid for it', () => {
        const game = Game.create(content, 7);

        game.state.resources.money = 1000;
        game.place('road', 40, 11);
        expect(game.place('house', 40, 10).ok).toBe(true);
        game.testerFinish();

        const house = game.buildingAt(40, 10)!;
        const paid = house.paid;

        // Two free climbs: the list price is far above what was paid.
        house.level = 3;
        game.structureChanged();
        expect(game.refund(house)).toBe(Math.floor(paid / 2));

        const money = game.money;

        expect(game.demolish(house.uid).ok).toBe(true);
        expect(game.money).toBe(money + Math.floor(paid / 2));
    });

    it('do not move what is being built or the Town Hall', () => {
        const game = Game.create(content, 7);

        game.state.resources.money = 1000;
        game.place('road', 40, 11);
        game.place('farm', 40, 12);

        const farm = game.buildingAt(40, 12)!;

        expect(game.moveBlock(farm)).toBe('Идёт стройка');
        expect(game.moveBlock(game.center!)).toBe(
            'Это здание нельзя перенести',
        );
        game.testerFinish();
        expect(game.moveBlock(farm)).toBeNull();
    });
});

describe('Spirit of the Age (gdd §2.2)', () => {
    const spirit = content.world.chronicle.spirit;

    it('takes 0.1 % a year off once the calendar passes the next era, at most 30 %', () => {
        expect(spiritDiscount(900, 1000, spirit)).toBe(0);
        expect(spiritDiscount(1120, 1000, spirit)).toBeCloseTo(0.12);
        expect(spiritDiscount(1900, 1000, spirit)).toBe(0.3);
        expect(spiritDiscount(3000, undefined, spirit)).toBe(0);
        expect(scalePrice({ money: 2400, mat: 140 }, 0.88, 'money')).toEqual({
            money: 2112,
            mat: 123.2,
        });
    });

    it('makes the Town Hall upgrade and discoveries cheaper in a late city', () => {
        const game = Game.create(content, 7);
        const writing = content.tech('writing')!;

        game.state.time = 1120 * 25;
        expect(game.spirit()).toBeCloseTo(0.12);
        expect(game.townHallUpgrade()!.cost.money).toBe(2112);
        expect(game.techCost(writing).money).toBe(
            Math.ceil((writing.cost.money ?? 0) * 0.88 - 1e-9),
        );
    });
});
