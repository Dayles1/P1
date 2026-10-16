import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import {
    bandAt,
    buildMap,
    groundHeight,
    mapLayout,
    SHORE_ROWS,
} from './layout';

const { content } = loadContent();

describe('the fixed map', () => {
    it('is 100 columns of 40 land, 20 beach and 4 sea rows, north to south', () => {
        const layout = mapLayout(content);
        const map = buildMap(content);

        expect(layout).toMatchObject({
            width: 100,
            height: 64,
            landRows: 40,
            beachRows: 20,
            seaRows: 4,
            beachY: 40,
            seaY: 60,
        });
        expect([map.width, map.height]).toEqual([100, 64]);

        for (const x of [0, 35, 49, 64, 99]) {
            expect(map.biomeAt(x, 0).id).toBe('meadow');
            expect(map.biomeAt(x, 39).id).toBe('meadow');
            expect(map.biomeAt(x, 40).id).toBe('beach');
            expect(map.biomeAt(x, 59).id).toBe('beach');
            expect(map.biomeAt(x, 60).id).toBe('water');
            expect(map.biomeAt(x, 63).id).toBe('water');
        }

        expect(map.biomeAt(10, 61).water).toBe(true);
        expect(map.biomeAt(10, 61).buildable).toBe(false);
        expect(map.isOpenWater(10, 61)).toBe(true);
        expect(map.isOpenWater(10, 59)).toBe(false);
        expect(bandAt(layout, 39)).toBe('land');
        expect(bandAt(layout, 40)).toBe('beach');
        expect(bandAt(layout, 60)).toBe('sea');
        expect(bandAt(layout, 500)).toBe('sea');
    });

    it('is the same every time it is built', () => {
        const first = buildMap(content);
        const second = buildMap(content);

        expect(second.biome).toEqual(first.biome);
        expect(second.elevation).toEqual(first.elevation);
        expect(second.toRows()).toEqual(first.toRows());
        expect(first.toRows()).toHaveLength(100 * 64);
        expect(first.toRows()[0]).toEqual([0, 0, 'meadow', 140, null]);
    });

    it('is flat land that only slopes into the water at the end of the beach', () => {
        const layout = mapLayout(content);

        for (let y = 0; y <= layout.seaY - SHORE_ROWS; y += 0.5) {
            expect(groundHeight(layout, y)).toBe(0);
        }

        let previous = 0;

        for (let y = layout.seaY - SHORE_ROWS; y <= layout.height + 40; y++) {
            const height = groundHeight(layout, y);

            expect(height).toBeLessThanOrEqual(previous);
            previous = height;
        }

        // Dry beach, then the sea floor under the water surface (y = −0.1).
        expect(groundHeight(layout, layout.seaY - 1)).toBeGreaterThan(-0.1);
        expect(groundHeight(layout, layout.seaY)).toBeLessThan(-0.1);
        expect(groundHeight(layout, layout.height)).toBeLessThan(-0.5);
    });
});
