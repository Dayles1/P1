import { describe, expect, it, vi } from 'vitest';
import { loadContent } from '../../content';
import { Game } from './game';

const { content } = loadContent();

describe('a new world', () => {
    it('stands its town hall in the middle of the land, at x 49–50, rows 19–20', () => {
        const game = Game.create(content, 7);
        const center = game.center!;

        expect(center).toBeDefined();
        expect([center.x, center.y]).toEqual([49, 19]);
        expect(game.def(center).size).toEqual({ w: 2, h: 2 });
        expect(game.buildingAt(50, 20)?.uid).toBe(center.uid);
    });

    it('owns a strip of columns 35–64 over the land and the beach', () => {
        const game = Game.create(content, 7);

        expect(game.state.land).toEqual({ minX: 35, maxX: 64 });
        expect(game.territory()).toEqual({
            minX: 35,
            minY: 0,
            maxX: 64,
            maxY: 59,
        });
        expect(game.inTerritory(35, 0)).toBe(true);
        expect(game.inTerritory(64, 59)).toBe(true);
        expect(game.inTerritory(34, 10)).toBe(false);
        expect(game.inTerritory(65, 10)).toBe(false);
        expect(game.inTerritory(40, 60)).toBe(false);
    });

    it('builds only inside the strip', () => {
        const game = Game.create(content, 7);
        const outside = 'За границей ваших земель';

        expect(game.canPlace('house', 35, 5).ok).toBe(true);
        expect(game.canPlace('house', 64, 39).ok).toBe(true);
        expect(game.canPlace('fishery', 40, 59).ok).toBe(true);
        expect(game.canPlace('house', 34, 5)).toEqual({
            ok: false,
            reason: outside,
        });
        expect(game.canPlace('house', 65, 5).reason).toBe(outside);
        expect(game.canPlace('house', 40, 60).reason).toBe(outside);
        expect(game.canPlace('house', -1, 5).reason).toBe(outside);
        // A 2×2 hanging one column over the edge is out too.
        expect(game.canPlace('town_center', 64, 30).reason).toBe(outside);
    });

    it('widens its land through setLand, within the map', () => {
        const game = Game.create(content, 7);

        expect(game.setLand(30, 69).ok).toBe(true);
        expect(game.canPlace('house', 30, 5).ok).toBe(true);
        expect(game.canPlace('house', 29, 5).ok).toBe(false);
        expect(game.setLand(-20, 500).ok).toBe(true);
        expect(game.state.land).toEqual({ minX: 0, maxX: 99 });
        expect(game.setLand(60, 40).ok).toBe(false);
        expect(game.state.land).toEqual({ minX: 0, maxX: 99 });
    });
});

describe('the calendar', () => {
    it('starts at year 0 and counts one year per 25 game seconds', () => {
        const game = Game.create(content, 7);

        expect(content.world.time.secondsPerYear).toBe(25);
        expect(game.state.time).toBe(0);
        expect(game.year).toBe(0);

        for (const [time, year] of [
            [24, 0],
            [25, 1],
            [49.9, 1],
            [50, 2],
            [2500, 100],
            [25_000, 1000],
        ]) {
            game.state.time = time;
            expect(game.year).toBe(year);
        }
    });

    it('runs at one rate whatever the era', () => {
        const game = Game.create(content, 7);

        for (let i = 0; i < 100; i++) {
            game.tick(1, true);
        }

        expect(game.year).toBe(4);
        game.testerNextEpoch();
        game.testerNextEpoch();

        for (let i = 0; i < 100; i++) {
            game.tick(1, true);
        }

        expect(game.state.epoch).toBe(2);
        expect(game.year).toBe(8);
    });

    it('does not jump when a new era begins', () => {
        const game = Game.create(content, 7);

        game.state.time = 30 * 25 + 3;
        game.infinite = true;
        vi.spyOn(game, 'gateBlock').mockReturnValue(null);

        expect(game.year).toBe(30);
        expect(game.advanceEpoch().ok).toBe(true);
        // The era begins when the Town Hall is built (3 years), not before.
        expect(game.state.epoch).toBe(0);
        expect(game.year).toBe(30);

        for (let i = 0; i < 75; i++) {
            game.tick(1, true);
        }

        expect(game.state.epoch).toBe(1);
        expect(game.state.time).toBe(30 * 25 + 3 + 75);
        expect(game.year).toBe(33);

        game.testerNextEpoch();
        expect(game.year).toBe(33);
        expect('year' in game.state).toBe(false);
    });
});
