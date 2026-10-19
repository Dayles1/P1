import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import {
    fromServer,
    hoursAway,
    migrateEraLog,
    migrateResources,
    toCreatePayload,
} from './serializer';
import type { BuildingRow, LoadedWorld } from './serializer';

const { content } = loadContent();

const row = (
    uid: number,
    type: string,
    x: number,
    y: number,
    level: number,
): BuildingRow => ({
    uid,
    type,
    x,
    y,
    level,
    build_start: 0,
    build_end: 0,
    style: null,
    district: null,
    paid: 100,
    mothballed: false,
    organic: 0,
    built_era: 0,
    from_level: 0,
});

/** A save written before slice 3 has no paid, mothballed, era log or economy. */
const oldRow = (
    uid: number,
    type: string,
    x: number,
    y: number,
    level: number,
): BuildingRow =>
    ({
        uid,
        type,
        x,
        y,
        level,
        build_start: 0,
        build_end: 0,
        style: null,
        district: null,
    }) as unknown as BuildingRow;

/** A save written before slice 1: gold and wood, a spaceport, a house at level 14. */
function oldSave(): LoadedWorld {
    return {
        revision: 3,
        saved_at: null,
        world: {
            seed: 7,
            width: 100,
            height: 64,
            epoch: 'e2300',
            epoch_index: 7,
            year: 40,
            time: 1000,
            population: 12,
            happiness: 60,
            score: 100,
            resources: { gold: 80, wood: 160, knowledge: 5, food: 50 },
            weather: 'clear',
            weather_until: 0,
            next_event_at: 2000,
            moods: [],
            next_uid: 10,
            techs: ['agriculture', 'spaceflight'],
            research: { id: 'pottery', start: 900, end: 1100 },
            blueprints: ['moon_base'],
            achievements: ['first_homes', 'conquer_mars'],
            stats: { built: 3, upgraded: 0, demolished: 0, events: 0 },
        } as unknown as LoadedWorld['world'],
        tiles: [],
        buildings: [
            oldRow(1, 'town_center', 49, 19, 11),
            oldRow(2, 'spaceport', 40, 5, 1),
            oldRow(3, 'house', 45, 10, 14),
        ],
        npcs: [],
    };
}

describe('old saves', () => {
    it('keep their money and drop resources that are gone', () => {
        expect(
            migrateResources(content, { gold: 80, wood: 160, food: 50 }),
        ).toEqual({ money: 80, food: 50, mat: 0, goods: 0, fuel: 0 });
        expect(migrateResources(content, { money: 5, gold: 80 }).money).toBe(5);
        expect(migrateResources(content, null).money).toBe(0);
    });

    it('load without unknown buildings, levels, discoveries or goals', () => {
        const game = fromServer(content, oldSave());

        expect(game.state.epoch).toBe(0);
        expect(game.money).toBe(80);
        expect(game.state.techs).toEqual(['agriculture']);
        expect(game.state.research).toBeNull();
        expect(game.state.blueprints).toEqual([]);
        expect(game.state.achievements).toEqual(['first_homes']);
        expect([...game.buildings.values()].map((b) => b.type)).toEqual([
            'town_center',
            'house',
        ]);
        expect(game.center!.level).toBe(8);
        expect(game.buildingAt(45, 10)!.level).toBe(11);

        // And they save again in today's shape.
        expect(
            Object.keys(toCreatePayload(game).world.resources).sort(),
        ).toEqual(['food', 'fuel', 'goods', 'mat', 'money']);
        game.tick(1, true);
    });
});

describe('slice 3 fields', () => {
    it('credit a building saved before slice 3 with its level list price', () => {
        const game = fromServer(content, oldSave());
        const house = game.buildingAt(45, 10)!;

        expect(house.paid).toBe(
            content.building('house').levels[10].cost.money,
        );
        expect(house.mothballed).toBe(false);
        expect(game.state.eraLog).toEqual([]);
        expect(game.state.economy.policy).toBe('normal');
        expect(game.state.economy.loan).toBe(0);
        expect(game.state.peakPopulation).toBe(12);
    });

    it('round-trip paid, mothballing, organic growth, the era log and the economy', () => {
        const save = oldSave();

        save.world = {
            ...save.world,
            epoch: 'e1000',
            time: 4000,
            peak_population: 300,
            era_log: [{ era: 1, t: 2000 }],
            economy: {
                policy: 'low',
                policyT: 2500,
                dense: false,
                denseT: null,
                loan: 400,
                arrears: false,
                arrearsYears: 2,
                chestT: 3000,
                h50: 61.5,
                bestH50: 0,
                flags: { tester: false },
            },
        };
        save.buildings = [
            row(1, 'town_center', 49, 19, 3),
            { ...row(3, 'farm', 45, 10, 1), paid: 333, mothballed: true },
            { ...row(4, 'house', 40, 10, 2), organic: 0.42, built_era: 1 },
        ];

        const game = fromServer(content, save);
        const payload = toCreatePayload(game);
        const farm = payload.buildings.find((b) => b.uid === 3)!;
        const house = payload.buildings.find((b) => b.uid === 4)!;

        expect(farm).toMatchObject({ paid: 333, mothballed: true });
        expect(house).toMatchObject({ organic: 0.42, built_era: 1 });
        expect(payload.world.era_log).toEqual([{ era: 1, t: 2000 }]);
        expect(payload.world.peak_population).toBe(300);
        expect(payload.world.economy).toMatchObject({
            policy: 'low',
            policyT: 2500,
            loan: 400,
            chestT: 3000,
            arrearsYears: 2,
        });
        expect(game.status.get(3)!.working).toBe(false);
    });

    it('keep only an era log that holds together', () => {
        expect(
            migrateEraLog(
                [
                    { era: 1, t: 100 },
                    { era: 1, t: 200 },
                    { era: 3, t: 50 },
                    { era: 2, t: 300 },
                    { era: 4, t: 400 },
                ],
                3,
                1000,
            ),
        ).toEqual([
            { era: 1, t: 100 },
            { era: 2, t: 300 },
        ]);
        expect(migrateEraLog(null, 2, 10)).toEqual([]);
    });

    it('count the real hours away', () => {
        const now = Date.parse('2026-10-17T12:00:00Z');

        expect(hoursAway('2026-10-17T08:00:00Z', now)).toBe(4);
        expect(hoursAway(null, now)).toBe(0);
        expect(hoursAway('not a date', now)).toBe(0);
    });
});

describe('slice 5 land', () => {
    it('round-trips the strips bought on each side', () => {
        const save = oldSave();

        save.world = { ...save.world, land_left: 2, land_right: 1 };
        save.buildings = [
            row(1, 'town_center', 49, 19, 1),
            row(2, 'house', 26, 10, 1),
        ];

        const game = fromServer(content, save);
        const payload = toCreatePayload(game);

        expect(game.state.land).toEqual({ minX: 25, maxX: 69 });
        expect(game.strips()).toBe(3);
        expect(game.buildingAt(26, 10)?.type).toBe('house');
        expect(payload.world).toMatchObject({ land_left: 2, land_right: 1 });
    });

    it('gives a save from before slice 5 the starting columns', () => {
        const game = fromServer(content, oldSave());

        expect(game.state.land).toEqual(content.world.map.start);
        expect(toCreatePayload(game).world).toMatchObject({
            land_left: 0,
            land_right: 0,
        });
    });
});
