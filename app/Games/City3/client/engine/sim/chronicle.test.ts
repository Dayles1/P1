import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import {
    gateShare,
    goldenBonus,
    happinessAverage,
    liveLead,
    scoreOf,
    starsFor,
} from './chronicle';
import type { GateProgress } from './chronicle';
import { Game } from './game';

const { content } = loadContent();
const rules = content.world.chronicle;
const SPY = content.world.time.secondsPerYear;

/** The Middle Ages' gate of the GDD: 460 citizens, two items, 3 of 4 discoveries. */
const gate = (patch: Partial<GateProgress> = {}): GateProgress => ({
    population: 0,
    populationGate: 460,
    items: 0,
    itemsTotal: 2,
    discoveries: 0,
    discoveriesNeeded: 3,
    ...patch,
});

describe('the live lead (gdd §2.3)', () => {
    it('is E(t) − year with E = H + 0.95·g·(H_next − H)', () => {
        expect(gateShare(gate())).toBe(0);
        expect(gateShare(gate({ population: 230 }))).toBeCloseTo(0.25);
        expect(
            gateShare(gate({ population: 9999, items: 2, discoveries: 4 })),
        ).toBe(1);

        const lead = liveLead(
            {
                year: 80,
                eraYear: 1000,
                nextEraYear: 1500,
                building: false,
                gate: gate({ population: 230 }),
            },
            rules,
        );

        expect(lead.cityYear).toBeCloseTo(1000 + 0.95 * 0.25 * 500);
        expect(lead.lead).toBeCloseTo(lead.cityYear - 80);
    });

    it('jumps ≈ 79 years when an item of the Middle Ages turns green', () => {
        const input = {
            year: 100,
            eraYear: 1000,
            nextEraYear: 1500,
            building: false,
        };
        const before = liveLead({ ...input, gate: gate() }, rules).lead;
        const after = liveLead(
            { ...input, gate: gate({ items: 1 }) },
            rules,
        ).lead;

        expect(after - before).toBeCloseTo(79.2, 1);
    });

    it('stands at 98 % of the way while the Town Hall builds, and is H − year in the last era', () => {
        expect(
            liveLead(
                {
                    year: 150,
                    eraYear: 1000,
                    nextEraYear: 1500,
                    building: true,
                    gate: gate(),
                },
                rules,
            ).cityYear,
        ).toBe(1490);
        expect(
            liveLead(
                {
                    year: 2134,
                    eraYear: 2100,
                    nextEraYear: undefined,
                    building: false,
                    gate: null,
                },
                rules,
            ).lead,
        ).toBe(-34);
    });

    it('remembers the gate line that moved it (the lead tooltip)', () => {
        const game = Game.create(content, 7);

        for (let t = 0; t < 5; t++) {
            game.tick(1, true);
        }

        game.state.techs = ['agriculture', 'masonry', 'writing'];

        for (let t = 0; t < 5; t++) {
            game.tick(1, true);
        }

        // A third of the gate's half × 0.95 × 1 000 years ≈ 158.
        expect(game.leadCause?.label).toBe('Открытия эпохи «Античность»');
        expect(game.leadCause!.years).toBeGreaterThanOrEqual(150);
        expect(game.leadCause!.years).toBeLessThanOrEqual(170);
    });
});

describe('stars (gdd §2.3, thresholds in epochs.json)', () => {
    it('gives ★ by the era’s year, ★★ and ★★★ by the sim’s thresholds', () => {
        const middleAges = content.epochs[1];

        expect(middleAges.entry!.stars).toEqual([76, 72]);
        expect(starsFor(72, 1000, [76, 72])).toBe(3);
        expect(starsFor(76, 1000, [76, 72])).toBe(2);
        expect(starsFor(77, 1000, [76, 72])).toBe(1);
        expect(starsFor(1000, 1000, [76, 72])).toBe(1);
        expect(starsFor(1001, 1000, [76, 72])).toBe(0);
        expect(content.epochs.slice(1).map((e) => e.entry!.stars)).toEqual([
            [76, 72],
            [157, 143],
            [235, 222],
            [366, 341],
            [558, 517],
            [750, 714],
        ]);
    });

    it('are recorded when the Town Hall finishes, with the lead and a Golden Age', () => {
        const game = Game.create(content, 7);

        game.state.time = 74 * SPY;
        game.testerNextEpoch();

        expect(game.chronicle()).toEqual([
            { era: 1, year: 74, lead: 926, stars: 2 },
        ]);
        expect(game.golden()).toBe(0);
        game.state.time += SPY;
        expect(game.golden()).toBeCloseTo(0.05);
        game.state.time += 4 * SPY;
        expect(game.golden()).toBeCloseTo(0.1);
    });
});

describe('the Golden Age (gdd §2.3)', () => {
    it('gives 5 % a star for 10 years, ramping in and out over 2', () => {
        const golden = rules.golden;

        expect(goldenBonus(0, 3, golden)).toBe(0);
        expect(goldenBonus(1, 3, golden)).toBeCloseTo(0.075);
        expect(goldenBonus(5, 3, golden)).toBeCloseTo(0.15);
        expect(goldenBonus(9, 3, golden)).toBeCloseTo(0.075);
        expect(goldenBonus(10.5, 3, golden)).toBe(0);
        expect(goldenBonus(5, 0, golden)).toBe(0);
    });
});

describe('the score (gdd §10)', () => {
    it('adds the Chronicle, the city, the land and achievements; money is worth nothing', () => {
        const score = scoreOf(
            {
                entries: [
                    { era: 1, year: 74, lead: 926, stars: 2 },
                    { era: 2, year: 160, lead: 1340, stars: 1 },
                ],
                peakPopulation: 10_000,
                bestH50: 75,
                strips: 3,
                achievements: 2,
            },
            rules,
        );

        expect(score).toEqual({
            chronicle: 1000 + 926 + 300 + 1000 + 1340 + 100,
            city: Math.round(20 * 100 * (0.8 + 0.4 * 0.75)),
            land: 300,
            achievements: 500,
            total: 4666 + 2200 + 300 + 500,
        });
        // A late entry has no negative lead.
        expect(
            scoreOf(
                {
                    entries: [{ era: 6, year: 2200, lead: -100, stars: 0 }],
                    peakPopulation: 0,
                    bestH50: 0,
                    strips: 0,
                    achievements: 0,
                },
                rules,
            ).chronicle,
        ).toBe(1000);
    });

    it('averages happiness over 50 years and keeps the best from year 50', () => {
        let average = { h50: 50, bestH50: 0 };

        for (let t = 1; t <= 60 * SPY; t++) {
            average = happinessAverage(average, 90, t, 1, SPY, rules);
        }

        expect(average.h50).toBeGreaterThan(70);
        expect(average.h50).toBeLessThan(90);
        expect(average.bestH50).toBe(average.h50);
        average = happinessAverage(average, 0, 61 * SPY, 1, SPY, rules);
        expect(average.bestH50).toBeGreaterThan(average.h50);
    });

    it('counts the game’s own Chronicle, peak population and happiness', () => {
        const game = Game.create(content, 7);

        game.state.time = 74 * SPY;
        game.testerNextEpoch();
        game.state.peakPopulation = 400;
        game.state.economy.bestH50 = 60;

        expect(game.scoreBreakdown()).toMatchObject({
            chronicle: 1000 + 926 + 300,
            city: Math.round(20 * 20 * (0.8 + 0.4 * 0.6)),
            land: 0,
        });
    });
});

describe('an upgrade under way (gdd §4.9)', () => {
    it('keeps the old level working until the new one is built', () => {
        const game = Game.create(content, 7);

        game.state.resources.money = 10_000;
        game.state.techs = ['agriculture'];
        // Beside the Town Hall: connected without a street.
        expect(game.place('farm', 51, 19).ok).toBe(true);
        game.testerFinish();

        const farm = game.buildingAt(51, 19)!;
        const made = game.status.get(farm.uid)!.output.food;

        expect(made).toBeGreaterThan(0);
        game.testerNextEpoch();
        game.state.techs.push('three_field');
        expect(game.upgrade(farm.uid).ok).toBe(true);
        game.tick(1, true);
        expect(game.isComplete(farm)).toBe(false);
        expect(game.status.get(farm.uid)).toMatchObject({
            working: true,
            level: 1,
        });
        expect(game.status.get(farm.uid)!.upkeep).toBe(
            content.building('farm').levels[0].upkeep,
        );
    });
});
