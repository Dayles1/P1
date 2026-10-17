import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import { fromServer, migrateResources, toCreatePayload } from './serializer';
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
});

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
        },
        tiles: [],
        buildings: [
            row(1, 'town_center', 49, 19, 11),
            row(2, 'spaceport', 40, 5, 1),
            row(3, 'house', 45, 10, 14),
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
