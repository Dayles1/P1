import { describe, expect, it } from 'vitest';
import { forEachInDiamond, footprintDistance, Grids } from './grids';
import type { GridSource } from './grids';

const source = (
    x: number,
    y: number,
    effects: Partial<GridSource> = {},
    w = 1,
    h = 1,
): GridSource => ({
    x,
    y,
    w,
    h,
    coverage: null,
    aura: null,
    centerAura: null,
    pollution: null,
    transit: null,
    dataTax: null,
    charter: null,
    ...effects,
});

describe('diamonds (gdd §4.7: Manhattan radius from every footprint tile)', () => {
    it('covers 2r² + 2r + 1 tiles around one tile, clipped at the edges', () => {
        for (const radius of [0, 1, 3, 6]) {
            let count = 0;

            forEachInDiamond(
                100,
                64,
                { x: 50, y: 30, w: 1, h: 1 },
                radius,
                () => count++,
            );
            expect(count).toBe(2 * radius * radius + 2 * radius + 1);
        }

        let corner = 0;

        forEachInDiamond(
            100,
            64,
            { x: 0, y: 0, w: 1, h: 1 },
            2,
            () => corner++,
        );
        // Only the quarter inside the map: (0,0) (1,0) (2,0) (0,1) (1,1) (0,2).
        expect(corner).toBe(6);
    });

    it('reaches every tile within r of a 2×2 footprint and no further', () => {
        const tiles = new Set<number>();
        const area = { x: 10, y: 10, w: 2, h: 2 };

        forEachInDiamond(40, 40, area, 2, (index) => tiles.add(index));

        for (let y = 0; y < 40; y++) {
            for (let x = 0; x < 40; x++) {
                const inside =
                    footprintDistance(area, { x, y, w: 1, h: 1 }) <= 2;

                expect(tiles.has(y * 40 + x), `${x},${y}`).toBe(inside);
            }
        }
    });
});

describe('the fields', () => {
    it('counts services, sums auras and pollution, and keeps the Town Hall apart', () => {
        const grids = new Grids(30, 20);

        grids.sync(
            new Map([
                [
                    1,
                    source(5, 5, { coverage: { service: 'water', radius: 3 } }),
                ],
                [2, source(7, 5, { aura: { radius: 2, happiness: 4 } })],
                [3, source(8, 5, { aura: { radius: 2, happiness: 6 } })],
                [
                    4,
                    source(
                        12,
                        5,
                        { centerAura: { radius: 4, happiness: 6 } },
                        2,
                        2,
                    ),
                ],
                [5, source(20, 5, { pollution: { radius: 3, amount: 10 } })],
            ]),
        );

        expect(grids.covers('water', { x: 8, y: 5, w: 1, h: 1 })).toBe(true);
        expect(grids.covers('water', { x: 9, y: 5, w: 1, h: 1 })).toBe(false);
        // A 2×2 home is covered if any of its tiles is.
        expect(grids.covers('water', { x: 8, y: 6, w: 2, h: 2 })).toBe(false);
        expect(grids.covers('water', { x: 7, y: 6, w: 2, h: 2 })).toBe(true);
        expect(grids.maxOver(grids.aura, { x: 8, y: 6, w: 1, h: 1 })).toBe(10);
        expect(grids.maxOver(grids.aura, { x: 10, y: 5, w: 1, h: 1 })).toBe(6);
        expect(
            grids.maxOver(grids.centerAura, { x: 9, y: 5, w: 1, h: 1 }),
        ).toBe(6);
        expect(grids.maxOver(grids.aura, { x: 12, y: 5, w: 2, h: 2 })).toBe(0);
        expect(
            grids.maxOver(grids.pollution, { x: 18, y: 6, w: 1, h: 1 }),
        ).toBe(10);
        expect(
            grids.maxOver(grids.pollution, { x: 17, y: 6, w: 1, h: 1 }),
        ).toBe(0);
    });

    it('re-stamps only what changed and returns to zero when everything goes', () => {
        const grids = new Grids(30, 20);
        const well = source(5, 5, {
            coverage: { service: 'water', radius: 3 },
        });
        const park = source(9, 9, { aura: { radius: 2, happiness: 4 } });

        expect(
            grids.sync(
                new Map([
                    [1, well],
                    [2, park],
                ]),
            ),
        ).toBe(2);
        expect(
            grids.sync(
                new Map([
                    [1, { ...well }],
                    [2, park],
                ]),
            ),
        ).toBe(0);

        // The park is upgraded: unstamped and stamped again.
        const bigger = { ...park, aura: { radius: 3, happiness: 6 } };

        expect(
            grids.sync(
                new Map([
                    [1, well],
                    [2, bigger],
                ]),
            ),
        ).toBe(2);
        expect(grids.maxOver(grids.aura, { x: 12, y: 9, w: 1, h: 1 })).toBe(6);

        // A moved well no longer covers its old place.
        const moved = { ...well, x: 20 };

        grids.sync(
            new Map([
                [1, moved],
                [2, bigger],
            ]),
        );
        expect(grids.covers('water', { x: 5, y: 5, w: 1, h: 1 })).toBe(false);
        expect(grids.covers('water', { x: 22, y: 6, w: 1, h: 1 })).toBe(true);

        grids.sync(new Map());
        expect(grids.coverage.water.every((count) => count === 0)).toBe(true);
        expect(grids.aura.every((value) => value === 0)).toBe(true);
    });

    it('stamps transit, data tax and charters for the later slices', () => {
        const grids = new Grids(30, 20);

        grids.sync(
            new Map([
                [
                    1,
                    source(5, 5, {
                        transit: { radius: 4, happiness: 6 },
                        dataTax: { radius: 10, percent: 5 },
                        charter: { kind: 'craft', radius: 6 },
                    }),
                ],
            ]),
        );

        expect(grids.transitAt({ x: 9, y: 5, w: 1, h: 1 })).toBe(true);
        expect(grids.transitAt({ x: 10, y: 5, w: 1, h: 1 })).toBe(false);
        expect(
            grids.maxOver(grids.transitAppeal, { x: 6, y: 6, w: 1, h: 1 }),
        ).toBe(6);
        expect(grids.maxOver(grids.dataTax, { x: 15, y: 5, w: 1, h: 1 })).toBe(
            5,
        );
        expect(grids.charterAt('craft', { x: 11, y: 5, w: 1, h: 1 })).toBe(
            true,
        );
        expect(grids.charterAt('trade', { x: 5, y: 5, w: 1, h: 1 })).toBe(
            false,
        );
    });
});
