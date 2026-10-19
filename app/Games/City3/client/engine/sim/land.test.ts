import { describe, expect, it, vi } from 'vitest';
import { contentBundle, loadContent } from '../../content';
import { Content } from '../content/registry';
import type { BuildingDef } from '../content/types';
import type { GameEvent } from '../core/events';
import { Game } from './game';

const { content } = loadContent();

/** gdd §5.2: the price of the k-th purchase, whichever side. */
const PRICES = [
    2000, 4400, 9600, 21000, 48000, 105000, 230000, 500000, 1200000, 2800000,
    6400000, 16000000, 40000000, 100000000,
];

/** A game owning the whole map, so every zone can be tried. */
function wholeMap(source = content): Game {
    const game = Game.create(source, 7);

    game.setLand(0, 99);

    return game;
}

/** Content with an airport (slice 11) on its plot, as cheap as a park. */
function withAirport(): Content {
    const bundle = contentBundle();
    const park = bundle.buildings.park;

    bundle.buildings.airport = {
        ...structuredClone(park),
        id: 'airport',
        name: 'Аэропорт',
        size: { w: 12, h: 4 },
        unique: true,
        placement: { zone: 'airportPlot', requiresRoad: true },
        levels: [{ ...structuredClone(park.levels[0]), cost: { money: 1000 } }],
    } as BuildingDef;

    return new Content(bundle);
}

describe('placement by zone (gdd §5.1, §5.3, §5.4)', () => {
    /** [type, x, y, true | a word of the reason]. */
    const table: [string, number, number, true | string][] = [
        // The mountain foot: rows 0–1 are land too.
        ['house', 36, 0, true],
        ['house', 37, 0, true],
        ['quarry', 35, 0, true],
        ['quarry', 42, 0, true],
        ['quarry', 42, 1, 'подножия'],
        ['quarry', 37, 0, 'месторождение'],
        ['quarry', 45, 0, 'портал'],
        ['mine', 56, 0, true],
        ['mine', 30, 0, true],
        ['mine', 57, 0, 'точно'],
        ['mine', 42, 0, 'Нужно месторождение: руда'],
        ['mine', 37, 0, 'руда'],
        ['mine', 56, 1, 'подножия'],
        ['coal_mine', 37, 0, true],
        ['coal_mine', 40, 0, true],
        ['coal_mine', 56, 0, 'Нужно месторождение: уголь'],
        // Land rows, then the beach.
        ['house', 40, 39, true],
        ['house', 40, 40, 'суше'],
        ['farm', 40, 38, true],
        ['farm', 40, 39, 'суше'],
        ['manor', 40, 57, true],
        ['manor', 40, 58, 'воды'],
        ['park', 40, 45, true],
        ['road', 40, 58, true],
        ['road', 40, 59, 'воды'],
        // The waterline.
        ['fishery', 40, 59, true],
        ['fishery', 40, 58, 'кромки'],
        ['fishery', 15, 59, 'месторождение'],
        ['oil_well', 15, 59, true],
        ['oil_well', 89, 59, true],
        ['oil_well', 17, 59, 'Нужно месторождение: нефть'],
        ['oil_well', 85, 58, 'кромки'],
        // The future airport's plot: only roads and parks.
        ['park', 44, 46, true],
        ['road', 55, 49, true],
        ['storehouse', 50, 48, 'аэропорта'],
        ['manor', 43, 45, 'аэропорта'],
        ['manor', 42, 45, true],
        ['windmill', 56, 47, true],
    ];

    it.each(table)('%s at %i,%i → %s', (type, x, y, expected) => {
        const result = wholeMap().canPlace(type, x, y);

        if (expected === true) {
            expect(result).toEqual({ ok: true });
        } else {
            expect(result.ok).toBe(false);
            expect(result.reason).toContain(expected);
        }
    });

    it('lets the airport stand only on its plot, clearing it for all it cost', () => {
        const game = wholeMap(withAirport());

        game.state.resources.money = 10_000;
        expect(game.place('park', 44, 46).ok).toBe(true);
        expect(game.place('road', 45, 46).ok).toBe(true);

        const paid = game.plotClearance().reduce((sum, b) => sum + b.paid, 0);

        expect(paid).toBeGreaterThan(0);
        expect(game.canPlace('airport', 43, 46).reason).toBe(
            'Аэропорт строят только на его участке',
        );
        expect(game.canPlace('airport', 44, 46).ok).toBe(true);

        const money = game.money;

        expect(game.place('airport', 44, 46).ok).toBe(true);
        expect(game.money).toBe(money - 1000 + paid);
        expect(game.buildingAt(44, 46)!.type).toBe('airport');
        expect(game.buildingAt(45, 46)!.type).toBe('airport');
        expect([...game.buildings.values()].map((b) => b.type)).not.toContain(
            'park',
        );
        expect(game.plotClearance()).toEqual([]);
    });
});

describe('buying land (gdd §5.2)', () => {
    it('offers the strip right outside each edge, with its price and what it holds', () => {
        const game = Game.create(content, 7);

        expect(game.landOffer('west')).toMatchObject({
            minX: 30,
            maxX: 34,
            price: 2000,
            affordable: false,
            feature: 'богатая руда',
        });
        expect(game.landOffer('east')).toMatchObject({
            minX: 65,
            maxX: 69,
            price: 2000,
            feature: 'бухта',
        });

        game.state.resources.money = 2000;
        expect(game.landOffer('west')!.affordable).toBe(true);
    });

    it('offers the treasury loan when a strip is out of reach (gdd §4.10)', () => {
        const game = Game.create(content, 7);

        vi.spyOn(game, 'loanOffer').mockReturnValue(1000);
        game.state.resources.money = 1200;
        expect(game.landOffer('west')!.loan).toEqual({
            amount: 1000,
            enough: true,
        });

        game.state.resources.money = 500;
        expect(game.landOffer('west')!.loan).toEqual({
            amount: 1000,
            enough: false,
        });

        game.state.resources.money = 5000;
        expect(game.landOffer('west')!.loan).toBeUndefined();
    });

    it('refuses what the treasury cannot pay', () => {
        const game = Game.create(content, 7);
        const events: GameEvent[] = [];

        game.events.on((event) => events.push(event));
        expect(game.buyStrip('west')).toBe(false);
        expect(game.state.land).toEqual({ minX: 35, maxX: 64 });
        expect(game.money).toBe(1200);
        expect(events).toEqual([{ type: 'error', text: 'Не хватает денег' }]);
    });

    it('sells all fourteen strips along the price curve, seven a side, the land one piece', () => {
        const game = Game.create(content, 7);
        const events: GameEvent[] = [];
        const sides = ['east', 'west', 'west', 'east'] as const;

        game.events.on((event) => events.push(event));
        game.state.resources.money = 1e10;

        for (let k = 0; k < 14; k++) {
            const side =
                game.landOffer(sides[k % 4]) !== null
                    ? sides[k % 4]
                    : sides[k % 4] === 'west'
                      ? 'east'
                      : 'west';
            const money = game.money;
            const revision = game.revision;
            const before = game.state.land;

            expect(game.landOffer(side)!.price).toBe(PRICES[k]);
            expect(game.buyStrip(side)).toBe(true);
            expect(money - game.money).toBe(PRICES[k]);
            expect(game.revision).toBeGreaterThan(revision);
            expect(game.strips()).toBe(k + 1);
            // One piece: it grew by one strip at one edge.
            expect(
                game.state.land.maxX -
                    game.state.land.minX -
                    (before.maxX - before.minX),
            ).toBe(5);
        }

        expect(game.state.land).toEqual({ minX: 0, maxX: 99 });
        expect(game.stripsBySide()).toEqual({ west: 7, east: 7 });
        expect(game.landOffer('west')).toBeNull();
        expect(game.landOffer('east')).toBeNull();
        expect(game.buyStrip('east')).toBe(false);
        expect(events.at(-1)).toEqual({
            type: 'error',
            text: 'Вся земля на востоке уже ваша',
        });
        expect(events).toContainEqual({ type: 'sound', id: 'coin' });
        expect(events).toContainEqual({
            type: 'toast',
            text: '🗺️ Новая полоса земли на востоке: бухта',
            tone: 'good',
        });
        // Land scores 100 a strip (gdd §10).
        expect(game.scoreBreakdown().land).toBe(1400);
        expect(
            game.goalProgress({
                id: 'coast',
                name: '',
                epoch: 'e0',
                condition: { type: 'strips', count: 14 },
                reward: {},
            } as never).done,
        ).toBe(true);
    });

    it('builds on a strip once it is bought', () => {
        const game = Game.create(content, 7);

        game.state.resources.money = 5000;
        expect(game.canPlace('house', 33, 10).reason).toBe(
            'За границей ваших земель',
        );
        expect(game.buyStrip('west')).toBe(true);
        expect(game.canPlace('house', 33, 10).ok).toBe(true);
        expect(game.canPlace('house', 29, 10).ok).toBe(false);
    });
});

describe('what a place gives in the economy (gdd §4.2, §5.3)', () => {
    /** A street from the Town Hall down column 49, then along a row. */
    function street(game: Game, row: number, from: number, to: number) {
        for (let y = 21; y <= row; y++) {
            game.place('road', 49, y);
        }

        for (let x = from; x <= to; x++) {
            game.place('road', x, row);
        }
    }

    function settle(game: Game) {
        game.state.population = 1000;

        for (let i = 0; i < 30; i++) {
            game.tick(1, true);
        }
    }

    it('a mine on rich ore makes half as much again as one on plain ore', () => {
        const game = Game.create(content, 7);

        game.testerNextEpoch();
        game.state.techs.push('metallurgy');
        game.setLand(30, 64);
        game.infinite = true;

        for (let y = 2; y <= 19; y++) {
            game.place('road', 48, y);
        }

        for (let x = 31; x <= 57; x++) {
            game.place('road', x, 2);
        }

        expect(game.place('mine', 30, 0).ok).toBe(true);
        expect(game.place('mine', 56, 0).ok).toBe(true);
        settle(game);

        const rich = game.buildingAt(30, 0)!;
        const plain = game.buildingAt(56, 0)!;
        const richOut = game.status.get(rich.uid)!.output.mat!;
        const plainOut = game.status.get(plain.uid)!.output.mat!;

        expect(game.status.get(rich.uid)!.working).toBe(true);
        expect(plainOut).toBeGreaterThan(0);
        expect(richOut / plainOut).toBeCloseTo(1.5, 6);
        expect(game.site(rich).labels).toEqual(['Богатое месторождение ×1,5']);
    });

    it('fisheries in the deep bay catch a quarter more, only the first ones', () => {
        const bundle = contentBundle();

        bundle.world.map.features.bay.fisheryMax = 1;

        const game = Game.create(new Content(bundle), 7);

        game.setLand(35, 69);
        game.infinite = true;
        street(game, 58, 40, 67);

        for (const x of [40, 65, 66]) {
            expect(game.place('fishery', x, 59).ok).toBe(true);
        }

        settle(game);

        const out = (x: number) =>
            game.status.get(game.buildingAt(x, 59)!.uid)!.output.food!;

        expect(out(40)).toBeGreaterThan(0);
        expect(out(65) / out(40)).toBeCloseTo(1.25, 6);
        // The bay favours only its first fishery here.
        expect(out(66) / out(40)).toBeCloseTo(1, 6);
    });
});
