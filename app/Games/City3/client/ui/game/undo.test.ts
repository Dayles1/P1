import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import { Game } from '../../engine/sim/game';
import { demolish, undoDemolition } from './undo';

const { content } = loadContent();

function cityWithHouse() {
    const game = Game.create(content, 7);
    const center = game.center!;
    let placed: { x: number; y: number } | null = null;

    game.state.resources[content.currency] = 1_000_000;

    for (let y = center.y - 4; y < center.y + 6 && !placed; y++) {
        for (let x = center.x - 4; x < center.x + 6 && !placed; x++) {
            if (game.place('house', x, y, 1).ok) {
                placed = { x, y };
            }
        }
    }

    const house = game.buildingAt(placed!.x, placed!.y)!;

    return { game, house };
}

describe('demolition with undo (ui-spec §6.3)', () => {
    it('gives the refund and takes it back on undo, the house in place', () => {
        const { game, house } = cityWithHouse();
        const before = game.money;
        const done = demolish(game, [house.uid])!;

        expect(done.refund).toBeGreaterThan(0);
        expect(game.money).toBeCloseTo(before + done.refund);
        expect(game.buildings.has(house.uid)).toBe(false);
        expect(game.deletedBuildings.has(house.uid)).toBe(true);

        expect(undoDemolition(game, done)).toBe(true);
        expect(game.money).toBeCloseTo(before);
        expect(game.buildingAt(house.x, house.y)?.uid).toBe(house.uid);
        expect(game.deletedBuildings.has(house.uid)).toBe(false);
        expect(game.changedBuildings.has(house.uid)).toBe(true);
    });

    it('refuses when the tile was built on meanwhile or the refund is spent', () => {
        const { game, house } = cityWithHouse();
        const done = demolish(game, [house.uid])!;

        game.state.resources[content.currency] = 0;
        expect(undoDemolition(game, done)).toBe(false);

        game.state.resources[content.currency] = 1_000_000;
        expect(game.place('house', house.x, house.y, 1).ok).toBe(true);
        expect(undoDemolition(game, done)).toBe(false);
    });

    it('never takes the Town Hall', () => {
        const game = Game.create(content, 7);

        expect(demolish(game, [game.center!.uid])).toBeNull();
        expect(game.center).toBeDefined();
    });
});
