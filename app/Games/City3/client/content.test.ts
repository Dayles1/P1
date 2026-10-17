import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contentBundle, loadContent } from './content';
import { validateContent } from './engine/content/registry';
import { CONTENT_FILES } from './engine/content/types';

describe('the content bundle', () => {
    it('has every content file and every building, in file-name order', () => {
        const bundle = contentBundle();
        const ids = Object.keys(bundle.buildings);

        for (const file of CONTENT_FILES) {
            expect(bundle[file]).toBeTypeOf('object');
        }

        const files = readdirSync(
            fileURLToPath(new URL('../content/buildings', import.meta.url)),
        )
            .filter((file) => file.endsWith('.json'))
            .map((file) => file.slice(0, -'.json'.length))
            .sort();

        expect(ids.length).toBeGreaterThan(0);
        expect(ids).toEqual(files);
        expect(ids).toContain('road');
        expect(ids).toContain('town_center');

        for (const id of ids) {
            expect(bundle.buildings[id].id).toBe(id);
        }
    });

    it('passes the content validation without issues', () => {
        const { content, issues } = loadContent();

        expect(issues).toEqual([]);
        expect(content.byRole('road')).toBeDefined();
        expect(content.byRole('center')).toBeDefined();
    });

    it('is a fresh copy on every load', () => {
        const first = contentBundle();
        const second = contentBundle();

        expect(second).toEqual(first);
        expect(second.buildings.house).not.toBe(first.buildings.house);
    });
});

describe('content v3', () => {
    const { content, bundle } = loadContent();

    it('has seven eras with a face of the money, an entry and stars', () => {
        expect(content.epochs.map((e) => e.id)).toEqual([
            'e0',
            'e1000',
            'e1500',
            'e1800',
            'e1900',
            'e2000',
            'e2100',
        ]);
        expect(content.epochs.map((e) => e.currency.symbol)).toEqual([
            '₯',
            '₰',
            'ƒ',
            '₤',
            '¤',
            '▣',
            '◈',
        ]);
        expect(content.epochs[0].entry).toBeUndefined();
        expect(
            content.epochs.slice(1).map((e) => e.entry!.townHallLevel),
        ).toEqual([3, 4, 5, 6, 7, 8]);
        expect(content.epochs.slice(1).map((e) => e.entry!.population)).toEqual(
            [80, 460, 1800, 7000, 20000, 45000],
        );
        expect(content.epochById('e1500').entry!.stars).toEqual([157, 143]);

        for (const epoch of content.epochs) {
            expect(epoch).not.toHaveProperty('theme');
            expect(epoch).not.toHaveProperty('next');
            expect(epoch.accent).toMatch(/^#[0-9a-f]{6}$/i);
        }
    });

    it('has one currency and the short list of resources', () => {
        expect(content.resources.map((r) => [r.id, r.kind])).toEqual([
            ['money', 'currency'],
            ['food', 'stock'],
            ['mat', 'stock'],
            ['goods', 'stock'],
            ['fuel', 'flow'],
        ]);
        expect(content.currency).toBe('money');
        expect(Object.keys(content.world.start.resources)).toEqual([
            'money',
            'food',
            'mat',
            'goods',
        ]);
    });

    it('prices everything in money (buildings also in materials)', () => {
        for (const tech of content.techs) {
            expect(Object.keys(tech.cost)).toEqual(['money']);
        }

        for (const blueprint of content.blueprints) {
            expect(Object.keys(blueprint.cost)).toEqual(['money']);
        }

        for (const goal of content.goals) {
            expect(Object.keys(goal.reward)).toEqual(['money']);
        }

        for (const def of content.buildings) {
            for (const level of def.levels) {
                expect(Object.keys(level.cost)).toEqual(['money', 'mat']);
                expect(level.upkeep).toBeGreaterThanOrEqual(0);
                expect(level).not.toHaveProperty('upgrade');
                expect(level.effects).not.toHaveProperty('seasonal');
                expect(level.effects).not.toHaveProperty('defense');
            }
        }
    });

    it('has 28 discoveries, four per era', () => {
        expect(content.techs).toHaveLength(28);

        for (const epoch of content.epochs) {
            expect(
                content.techs.filter((t) => t.epoch === epoch.id),
            ).toHaveLength(4);
        }
    });

    it('keeps the roster of §8 and nothing after 2100', () => {
        const ids = content.buildings.map((def) => def.id).sort();

        expect(ids).toHaveLength(36);

        for (const gone of [
            'ai_foundry',
            'antimatter_collider',
            'electrolyzer',
            'fusion_reactor',
            'nanofab',
            'spaceport',
        ]) {
            expect(ids).not.toContain(gone);
        }

        const levels = content.buildings.reduce(
            (sum, def) => sum + (def.network ? 0 : def.levels.length),
            0,
        );

        expect(levels).toBe(148);
        expect(content.building('road').levels).toHaveLength(7);
        expect(content.building('house').levels).toHaveLength(11);
        expect(content.building('town_center').levels).toHaveLength(8);

        for (const def of content.buildings) {
            expect(def).not.toHaveProperty('role');
            expect(def.size.w).toBeLessThanOrEqual(12);
            expect(def.size.h).toBeLessThanOrEqual(4);

            for (const level of def.levels) {
                expect(content.epochOrder(level.epoch)).toBeLessThan(7);
            }
        }
    });

    it('states rates per year (gdd §8.2)', () => {
        const farm = content.building('farm').levels[0];
        const steel = content.building('steel_mill').levels[0];
        const house = content.building('house').levels[0];

        expect(farm.effects.produces).toEqual({ food: 28 });
        expect(farm.cost).toEqual({ money: 240, mat: 12 });
        expect(farm.upkeep).toBe(0.5);
        expect(steel.effects.produces).toEqual({ mat: 571 });
        expect(steel.effects.consumes).toEqual({ fuel: 114 });
        expect(house).toMatchObject({ tier: 0, cost: { money: 28, mat: 2.2 } });
        expect(content.building('house').levels[10].tier).toBe(10);
        expect(content.building('town_center').levels[6].cost).toEqual({
            money: 3_500_000,
            mat: 210_000,
        });
    });

    it('places buildings by zone, jobs by class', () => {
        const zone = (id: string) => content.building(id).placement.zone;

        expect(zone('house')).toBe('land');
        expect(zone('park')).toBe('landOrBeach');
        expect(zone('quarry')).toBe('mountain');
        expect(zone('fishery')).toBe('coast');
        expect(content.building('mine').placement.deposit).toBe('ore');
        expect(content.building('farm').jobClass).toBe('food');
        expect(content.building('road').network).toBe('road');
        expect(content.building('road').jobClass).toBeNull();
        expect(content.building('manor').taxMult).toBe(3);
        expect(content.roleOf(content.building('road'))).toBe('road');
        expect(content.roleOf(content.building('district_hall'))).toBe(
            'district',
        );
        expect(content.roleOf(content.building('house'))).toBeNull();
    });

    it('reports broken content', () => {
        const broken = structuredClone(bundle);

        broken.buildings.farm.levels[0].cost = { money: 10, wood: 5 };
        broken.buildings.farm.size = { w: 13, h: 2 };
        broken.buildings.farm.placement.zone = 'moon' as never;
        broken.epochs.epochs[2].entry!.townHallLevel = 9;
        broken.resources.resources.push({
            id: 'gold',
            kind: 'currency',
            name: 'Золото',
            icon: '💰',
            epoch: 'e0',
            description: '',
        });

        const paths = validateContent(broken).map(
            (issue) => `${issue.file}:${issue.path}`,
        );

        expect(paths).toEqual(
            expect.arrayContaining([
                'buildings/farm:levels[0].cost.wood',
                'buildings/farm:size',
                'buildings/farm:placement.zone',
                'epochs:epochs[2].entry.townHallLevel',
                'resources:resources',
            ]),
        );
    });
});
