import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import type { BuildingDef } from '../content/types';
import {
    addStrip,
    depositAt,
    landOf,
    nextStrip,
    siteOf,
    stripFeature,
    stripPrice,
    stripsOwned,
} from './land';
import type { Side } from './land';
import { mapLayout } from './layout';

const { content, issues } = loadContent();
const map = content.world.map;
const rules = content.world.land;
const layout = mapLayout(content);

/** gdd §5.2: the price of the k-th purchase, whichever side. */
const PRICES = [
    2000, 4400, 9600, 21000, 48000, 105000, 230000, 500000, 1200000, 2800000,
    6400000, 16000000, 40000000, 100000000,
];

describe('the land in world.json', () => {
    it('is valid content', () => {
        expect(issues).toEqual([]);
    });

    it('lays out every deposit and feature of gdd §5.3', () => {
        const spots = (minX: number, maxX: number) =>
            map.deposits
                .filter((s) => s.x >= minX && s.x <= maxX)
                .map((s) => `${s.kind}${s.rich ? '!' : ''}@${s.x}`);

        expect(spots(35, 64)).toEqual([
            'coal@37',
            'coal@40',
            'ore@56',
            'ore@59',
        ]);
        expect(spots(30, 34)).toEqual(['ore!@30', 'ore!@33']);
        expect(spots(15, 19)).toEqual(['oil@15', 'oil@16', 'oil@18', 'oil@19']);
        expect(spots(85, 89)).toEqual([
            'oil!@85',
            'oil!@86',
            'oil!@88',
            'oil!@89',
        ]);
        expect(map.portals.toSorted((a, b) => a - b)).toEqual([22, 46, 77]);
        expect(map.airportPlot).toMatchObject({ x: 44, y: 46, w: 12, h: 4 });

        for (const spot of map.deposits) {
            expect(spot.y).toBe(spot.kind === 'oil' ? layout.seaY - 1 : 0);
        }
    });
});

describe('expansion strips', () => {
    it('cost by how many are owned, either side: 2,0K up to 100M', () => {
        expect(PRICES.map((_, k) => stripPrice(k, rules))).toEqual(PRICES);
        expect(stripPrice(14, rules)).toBeNull();
    });

    it('are bought outwards in order, so the land stays one piece', () => {
        let land = { ...map.start };

        expect(nextStrip(land, 'west', map.start, rules, 100)).toEqual({
            minX: 30,
            maxX: 34,
        });
        expect(nextStrip(land, 'east', map.start, rules, 100)).toEqual({
            minX: 65,
            maxX: 69,
        });

        const order: Side[] = ['west', 'east', 'west', 'west', 'east'];

        for (const side of order) {
            const strip = nextStrip(land, side, map.start, rules, 100)!;

            // It touches the land: no gap, no overlap.
            expect(
                side === 'west'
                    ? strip.maxX + 1 === land.minX
                    : strip.minX - 1 === land.maxX,
            ).toBe(true);
            expect(strip.maxX - strip.minX + 1).toBe(5);
            land = addStrip(land, strip);
        }

        expect(land).toEqual({ minX: 20, maxX: 74 });
        expect(stripsOwned(land, map.start, rules)).toEqual({
            west: 3,
            east: 2,
        });
    });

    it('end at the map edges, seven a side', () => {
        let land = { ...map.start };

        for (let i = 0; i < 7; i++) {
            land = addStrip(
                land,
                nextStrip(land, 'west', map.start, rules, 100)!,
            );
        }

        expect(land.minX).toBe(0);
        expect(nextStrip(land, 'west', map.start, rules, 100)).toBeNull();
        expect(nextStrip(land, 'east', map.start, rules, 100)).not.toBeNull();
    });

    it('are kept in a save as a count per side', () => {
        expect(landOf(map.start, 2, 1, rules, 100)).toEqual({
            minX: 25,
            maxX: 69,
        });
        expect(landOf(map.start, 0, 0, rules, 100)).toEqual(map.start);
        // Nonsense from a save is clamped to the map's seven a side.
        expect(landOf(map.start, 99, -3, rules, 100)).toEqual({
            minX: 0,
            maxX: 64,
        });
    });

    it('name what they hold on their plaque', () => {
        const feature = (minX: number) =>
            stripFeature(map, { minX, maxX: minX + 4 });

        expect(feature(30)).toBe('богатая руда');
        expect(feature(65)).toBe('бухта');
        expect(feature(25)).toBe('уголь');
        expect(feature(20)).toBe('портал');
        expect(feature(15)).toBe('нефть');
        expect(feature(10)).toBe('богатый уголь');
        expect(feature(75)).toBe('уголь, портал');
        expect(feature(85)).toBe('богатая нефть');
        expect(feature(90)).toBe('солнечный склон');
        expect(feature(0)).toBe('мыс с маяком');
        expect(feature(95)).toBe('мыс с маяком');
    });
});

describe('what a place gives', () => {
    const def = (id: string): BuildingDef => content.building(id);
    const port: BuildingDef = {
        ...def('fishery'),
        id: 'port',
        size: { w: 3, h: 2 },
    };

    it('a rich deposit: ×1.5 output for the extractor standing on it', () => {
        const rich = depositAt(map, { x: 30, y: 0, w: 2, h: 2 })!;
        const plain = depositAt(map, { x: 56, y: 0, w: 2, h: 2 })!;

        expect(rich.rich).toBe(true);
        expect(siteOf(def('mine'), rich, layout, map).output).toBe(1.5);
        expect(siteOf(def('mine'), plain, layout, map).output).toBe(1);
        // A coal mine is not a mine: the ore under it is nothing to it.
        expect(siteOf(def('coal_mine'), rich, layout, map).output).toBe(1);
        expect(
            siteOf(def('oil_well'), { x: 85, y: 59, w: 1, h: 1 }, layout, map)
                .output,
        ).toBe(1.5);
    });

    it('the deep bay: its port trades and hosts more, its first fisheries catch more', () => {
        const inBay = { x: 66, y: 58, w: 3, h: 2 };

        expect(siteOf(port, inBay, layout, map)).toMatchObject({
            trade: 1.5,
            visitors: 1.2,
        });
        expect(siteOf(port, { ...inBay, x: 68 }, layout, map).trade).toBe(1);
        expect(
            siteOf(
                def('fishery'),
                { x: 65, y: 59, w: 1, h: 1 },
                layout,
                map,
                true,
            ).output,
        ).toBe(1.25);
        expect(
            siteOf(
                def('fishery'),
                { x: 65, y: 59, w: 1, h: 1 },
                layout,
                map,
                false,
            ).output,
        ).toBe(1);
    });

    it('a cape: attraction on its beach; the sunny slope: solar power', () => {
        expect(
            siteOf(def('theater'), { x: 1, y: 50, w: 2, h: 2 }, layout, map)
                .attraction,
        ).toBe(1.25);
        expect(
            siteOf(def('theater'), { x: 1, y: 20, w: 2, h: 2 }, layout, map)
                .attraction,
        ).toBe(1);
        expect(
            siteOf(def('solar_farm'), { x: 91, y: 30, w: 2, h: 2 }, layout, map)
                .power,
        ).toBe(1.25);
        expect(
            siteOf(def('solar_farm'), { x: 94, y: 30, w: 2, h: 2 }, layout, map)
                .power,
        ).toBe(1);
    });
});
