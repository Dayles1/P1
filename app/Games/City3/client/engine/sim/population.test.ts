import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import type { ServiceId } from '../content/types';
import { Game } from './game';
import {
    cityTerms,
    effectiveHousing,
    growPopulation,
    missingNeeds,
    occupancy,
    organicStart,
    organicStep,
    settleHomes,
    staticHappiness,
} from './population';

const { content } = loadContent();
const world = content.world;
const needs = world.population.needs;

const nothing = {
    comfort: 0,
    aura: 0,
    centerAura: 0,
    transit: 0,
    roadAppeal: 0,
    pollution: 0,
    traffic: 0,
    noise: 0,
    charter: 0,
};

describe('happiness (gdd §4.7)', () => {
    it('adds services, capped auras and appeal, and takes capped pollution', () => {
        expect(staticHappiness(world.happiness, nothing)).toBe(35);
        expect(
            staticHappiness(world.happiness, {
                ...nothing,
                comfort: 2 / 3,
                aura: 22,
                centerAura: 6,
                transit: 13,
                roadAppeal: 2,
                pollution: 50,
            }),
        ).toBeCloseTo(35 + 20 + 15 + 6 + 8 + 2 - 30);
    });

    it('shares the city terms; power at money 0 hurts only homes that use it', () => {
        const terms = cityTerms(world.happiness, {
            discoveries: 3,
            moods: -6,
            policy: 0,
            golden: 0,
            density: 0,
            starving: true,
            powerRatio: 0.6,
        });

        expect(terms.all).toBe(3 - 6 - 25);
        expect(terms.powered).toBeCloseTo(-15 * 0.4);
    });

    it('fills homes from 25 to 70 and settles P* and the city mean', () => {
        expect(occupancy(25, world.population.occupancy)).toBe(0);
        expect(occupancy(47.5, world.population.occupancy)).toBeCloseTo(0.5);
        expect(occupancy(90, world.population.occupancy)).toBe(1);
        expect(effectiveHousing(10, 1 / 3, world.population)).toBeCloseTo(8);

        const out = new Float64Array(2);
        const settled = settleHomes(
            [
                { housing: 10, heff: 8, staticHappiness: 60, powered: false },
                { housing: 30, heff: 30, staticHappiness: 50, powered: true },
            ],
            { all: 5, powered: -10 },
            world.population,
            55,
            out,
        );

        expect([...out]).toEqual([65, 45]);
        expect(settled.happiness).toBeCloseTo((65 * 10 + 45 * 30) / 40);
        expect(settled.target).toBeCloseTo(8 * (40 / 45) + 30 * (20 / 45));
    });
});

describe('growth (gdd §4.7)', () => {
    const rules = world.population;

    it('moves towards P*: in by 3 % of the gap (slower when unhappy), out by 5 %', () => {
        expect(growPopulation(10, 110, 70, false, 1, rules)).toBeCloseTo(
            10 + 100 * 0.03 + 0.2,
        );
        expect(growPopulation(10, 110, 35, false, 1, rules)).toBeCloseTo(
            10 + 100 * 0.03 * 0.5 + 0.2,
        );
        expect(growPopulation(109.9, 110, 70, false, 1, rules)).toBe(110);
        expect(growPopulation(200, 100, 70, false, 1, rules)).toBeCloseTo(195);
        expect(growPopulation(100.1, 100, 70, false, 1, rules)).toBe(100);
    });

    it('loses 0.4 % a second while starving, never NaN', () => {
        expect(growPopulation(100, 200, 50, true, 1, rules)).toBeCloseTo(99.6);
        expect(growPopulation(NaN, 10, 50, false, 1, rules)).toBe(0);
    });

    it('fills homes in about a year or two', () => {
        let population = 6;

        for (let tick = 0; tick < 50; tick++) {
            population = growPopulation(population, 100, 70, false, 1, rules);
        }

        expect(population).toBeGreaterThan(75);
    });
});

describe('the need ladder (gdd §4.7)', () => {
    const at = (services: ServiceId[], extra = {}) => ({
        services: (service: ServiceId) => services.includes(service),
        happiness: 60,
        aura: 0,
        powerRatio: 1,
        transit: false,
        ...extra,
    });

    it('asks a tier-T home for the first T needs', () => {
        expect(missingNeeds(needs, 0, at([]))).toEqual([]);
        expect(missingNeeds(needs, 1, at([])).map((n) => n.label)).toEqual([
            'Вода',
        ]);
        expect(
            missingNeeds(needs, 4, at(['water', 'education'])).map(
                (n) => n.label,
            ),
        ).toEqual(['Досуг', 'Здоровье']);
        expect(
            missingNeeds(
                needs,
                7,
                at(['water', 'leisure', 'health', 'education'], {
                    happiness: 49,
                    aura: 4,
                    powerRatio: 0.9,
                }),
            ).map((n) => n.need),
        ).toEqual(['happiness', 'power']);
        expect(
            missingNeeds(
                needs,
                10,
                at(['water', 'leisure', 'health', 'education', 'data'], {
                    happiness: 66,
                    aura: 5,
                    transit: true,
                }),
            ),
        ).toEqual([]);
    });

    it('lets a house be built or upgraded only where its tier is met', () => {
        const game = Game.create(content, 7);

        game.state.techs = ['masonry'];
        game.state.resources.money = 10_000;

        for (let x = 40; x <= 60; x++) {
            expect(game.place('road', x, 21).ok).toBe(true);
        }

        // Adobe houses (tier 1) need water at their tile.
        expect(game.place('house', 44, 20, 2)).toEqual({
            ok: false,
            reason: 'Для «Глинобитный дом» нужно: Вода',
        });
        expect(game.place('house', 44, 20).ok).toBe(true);
        game.testerFinish();

        const hut = game.buildingAt(44, 20)!;

        expect(game.upgradeBlock(hut)).toBe(
            'Для «Глинобитный дом» нужно: Вода',
        );
        expect(game.place('well', 46, 20).ok).toBe(true);
        game.testerFinish();
        expect(game.upgradeBlock(hut)).toBeNull();
        expect(game.place('house', 48, 20, 2).ok).toBe(true);
        // Out of the well's reach (r3).
        expect(game.canPlace('house', 52, 20, 0, 2).ok).toBe(false);
    });
});

describe('organic growth (gdd §4.7)', () => {
    it('starts each home at a stable 0..1 and climbs at 1', () => {
        const start = organicStart(17);

        expect(start).toBeGreaterThanOrEqual(0);
        expect(start).toBeLessThan(1);
        expect(organicStart(17)).toBe(start);
        expect(organicStep(0.5, 0.015)).toEqual({
            progress: 0.515,
            climb: false,
        });
        expect(organicStep(0.99, 0.015).climb).toBe(true);
        expect(organicStep(0.99, 0.015).progress).toBeCloseTo(0.005);
    });

    it('modernises old homes for free once their era is past, never current-era levels', () => {
        const game = Game.create(content, 7);

        game.state.techs = ['masonry'];
        game.state.resources.money = 10_000;

        for (let x = 40; x <= 50; x++) {
            game.place('road', x, 21);
        }

        game.place('well', 45, 20);
        game.place('house', 44, 20);
        game.testerFinish();

        const hut = game.buildingAt(44, 20)!;

        hut.organic = 0.99;

        // Antiquity: adobe houses are a current-era level, so no free climb.
        for (let i = 0; i < 25; i++) {
            game.tick(1, true);
        }

        expect(hut.level).toBe(1);

        // In the Middle Ages the hut becomes an adobe house by itself.
        game.testerNextEpoch();
        hut.organic = 0.99;

        const money = game.money;

        for (let i = 0; i < 25; i++) {
            game.tick(1, true);
        }

        expect(hut.level).toBe(2);
        expect(hut.organic).toBeCloseTo(0.005);
        expect(game.money).toBeGreaterThanOrEqual(money - 5);
    });
});

describe('heritage (gdd §4.5)', () => {
    it('doubles an old temple’s tourism, ramped over 20 years from the era it qualifies in', () => {
        const game = Game.create(content, 7);

        game.state.resources.money = 10_000;

        for (let x = 40; x <= 50; x++) {
            game.place('road', x, 21);
        }

        game.place('temple', 44, 22);
        game.testerFinish();

        const temple = game.buildingAt(44, 22)!;

        expect(temple.builtEra).toBe(0);
        expect(game.attractionOf(temple)).toBe(4);
        game.testerNextEpoch();
        expect(game.heritageMult(temple)).toBe(1);
        game.testerNextEpoch();
        // Two eras older than the city: the ramp starts now.
        expect(game.heritageMult(temple)).toBe(1);

        game.state.time += 10 * 25;
        expect(game.heritageMult(temple)).toBeCloseTo(1.5);
        game.state.time += 20 * 25;
        expect(game.heritageMult(temple)).toBe(2);
        expect(game.attractionOf(temple)).toBe(8);
    });
});
