import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import { mulberry32 } from '../core/random';
import { settle, tourismIncome } from './economy';
import type { EconomyCity, EconomyInput } from './economy';
import { Game } from './game';

const { content } = loadContent();

/**
 * A new world whose farm (east of the Town Hall, so connected) is built,
 * with `population` citizens; the stats show the next tick (nothing moved).
 */
function withFarm(population = 8): Game {
    const game = Game.create(content, 7);

    expect(game.place('farm', 51, 19).ok).toBe(true);
    game.testerFinish();
    game.state.population = population;
    game.structureChanged();

    return game;
}

describe('one currency', () => {
    it('starts with money, food, materials and goods only', () => {
        const game = Game.create(content, 7);

        expect(content.currency).toBe('money');
        expect(game.money).toBe(1200);
        expect(Object.keys(game.state.resources).sort()).toEqual(
            ['food', 'fuel', 'goods', 'mat', 'money'].sort(),
        );
        expect(game.state.resources).toMatchObject({
            food: 160,
            mat: 160,
            goods: 0,
        });
    });

    it('wears the current era’s face', () => {
        const game = Game.create(content, 7);

        expect(game.content.currencyFace(game.state.epoch).symbol).toBe('₯');
        game.testerNextEpoch();
        expect(game.content.currencyFace(game.state.epoch).short).toBe('Гроши');
    });
});

describe('per-year rates', () => {
    it('applies a farm’s 28 food a year as 28/25 per game second', () => {
        const game = withFarm();
        const farm = [...game.buildings.values()].find(
            (b) => b.type === 'farm',
        )!;
        const before = game.state.resources.food;

        // 8 citizens: 4 workers fill the farm's 4 jobs.
        expect(game.status.get(farm.uid)!.output.food).toBeCloseTo(28);
        // 8 citizens eat 0.4 a year each.
        expect(game.stats.rates.food).toBeCloseTo(28 - 8 * 0.4);

        game.tick(1, true);

        expect(game.state.resources.food - before).toBeCloseTo(
            (28 - 3.2) / 25,
            9,
        );
    });

    it('taxes 1.0 a citizen a year, by happiness and the homes’ level era', () => {
        const game = withFarm();
        const money = game.money;

        // No homes but the Town Hall's rooms: base 35 + its own aura 6.
        expect(game.stats.happiness).toBe(41);
        expect(game.stats.taxMult).toBe(1);
        expect(game.stats.tax).toBeCloseTo(8 * 1.0 * (0.5 + 0.41));
        // Net of the farm's upkeep, 0.5 a year.
        expect(game.stats.rates.money).toBeCloseTo(game.stats.tax - 0.5);

        // No goal reward in the way.
        game.state.achievements = content.goals.map((goal) => goal.id);
        game.tick(1, true);

        expect(game.money - money).toBeCloseTo((7.28 - 0.5) / 25, 9);
    });

    it('makes discoveries faster with schools', () => {
        const game = Game.create(content, 7);
        const tech = content.tech('agriculture')!;

        expect(game.researchTime(tech)).toBe(32);
        game.stats.research = 15;
        expect(game.researchTime(tech)).toBeCloseTo(32 / 1.15);
        game.stats.research = 400;
        expect(game.researchTime(tech)).toBeCloseTo(32 / 2.5);
    });
});

describe('prices', () => {
    it('buys the materials the stores lack for money, on the spot', () => {
        const game = Game.create(content, 7);
        const house = content.building('house');

        game.state.resources.mat = 0;

        expect(game.buildCost(house, 1)).toEqual({ money: 28, mat: 2.2 });
        expect(game.quote(game.buildCost(house, 1))).toEqual({
            money: 28,
            mat: 2.2,
            fromStock: 0,
            bought: 2.2,
            importMoney: 9,
            total: 37,
        });
        expect(game.place('house', 40, 10).ok).toBe(true);
        expect(game.money).toBe(1200 - 37);
        expect(game.state.resources.mat).toBe(0);
    });

    it('takes materials from the stores while they last', () => {
        const game = Game.create(content, 7);

        game.state.resources.mat = 1;
        expect(game.place('house', 40, 10).ok).toBe(true);
        // 1 from the stores, 1.2 bought for ceil(4.8) = 5.
        expect(game.money).toBe(1200 - 28 - 5);
        expect(game.state.resources.mat).toBe(0);
    });

    it('refuses what the treasury cannot pay', () => {
        const game = Game.create(content, 7);

        game.state.resources.money = 20;
        expect(game.place('house', 40, 10)).toEqual({
            ok: false,
            reason: 'Не хватает денег',
        });
    });

    it('trades the current level in when upgrading, down to a floor', () => {
        const game = Game.create(content, 7);

        game.place('house', 40, 10);
        game.testerFinish();

        const house = game.buildingAt(40, 10)!;

        // 48 × max(0.25, 1 − 0.7 × 28 / 48) for money and materials alike.
        expect(game.upgradeCost(house)).toEqual({ money: 29, mat: 2.2 });
        // House L1 → L11: 570K × max(0.25, 1 − 0.7 × 28 / 570K) ≈ full price.
        expect(game.relevelCost(house, 11).money).toBe(570_000 - 19);
    });

    it('returns half the money paid on demolition', () => {
        const game = Game.create(content, 7);

        game.place('farm', 40, 10);

        const money = game.money;

        game.demolish(game.buildingAt(40, 10)!.uid);
        expect(game.money).toBe(money + 120);
    });
});

describe('zones', () => {
    it('keeps each building to its band of rows', () => {
        const game = Game.create(content, 7);

        expect(game.canPlace('house', 40, 39).ok).toBe(true);
        expect(game.canPlace('house', 40, 40).ok).toBe(false);
        expect(game.canPlace('park', 40, 45).ok).toBe(true);
        expect(game.canPlace('park', 40, 59).ok).toBe(false);
        expect(game.canPlace('fishery', 40, 59).ok).toBe(true);
        expect(game.canPlace('fishery', 40, 50).ok).toBe(false);
        // Columns 40–41 at the mountain foot are a coal spot (gdd §5.3).
        expect(game.canPlace('quarry', 42, 0).ok).toBe(true);
        expect(game.canPlace('quarry', 42, 1).ok).toBe(false);
        expect(game.canPlace('farm', 40, 38).ok).toBe(true);
        expect(game.canPlace('farm', 40, 39).ok).toBe(false);
    });
});

describe('the gate into the next era', () => {
    it('lists citizens, the buildings asked for and discoveries; the Town Hall upgrade is the button', () => {
        const game = Game.create(content, 7);
        const labels = game.gateLines().map((line) => line.label);

        expect(labels).toEqual([
            'Жители',
            'Агора',
            'Школа философов',
            'Открытия эпохи «Античность»',
        ]);
        expect(game.townHallUpgrade()).toMatchObject({
            cost: { money: 2400, mat: 140 },
            spirit: 0,
            buildTime: 75,
        });
        expect(game.gateBlock()).toBe('Ещё 4 условия');
        expect(game.canAdvance()).toBe(false);
        expect(game.advanceEpoch().ok).toBe(false);
    });

    it('opens the era by paying for the Town Hall level of the era', () => {
        const game = Game.create(content, 7);

        game.state.techs = ['agriculture', 'masonry', 'writing'];
        game.state.resources.money = 10_000;
        expect(game.place('market', 40, 10).ok).toBe(true);
        expect(game.place('school', 44, 10).ok).toBe(true);
        game.testerFinish();
        game.state.population = 80;

        expect(game.canAdvance()).toBe(true);

        const price = game.quote(game.townHallUpgrade()!.cost).total;
        const money = game.money;

        expect(game.advanceEpoch().ok).toBe(true);
        // A visible build: the era begins when the Town Hall is finished.
        expect(game.state.epoch).toBe(0);
        expect(game.center!.level).toBe(3);
        expect(game.townHallBuilding()).toBe(true);
        expect(game.workingLevel(game.center!)).toBe(1);
        expect(game.money).toBe(money - price);
        expect(game.gateBlock()).toBe('Ратуша уже строится');

        for (let t = 0; t < 75; t++) {
            game.tick(1, true);
        }

        expect(game.state.epoch).toBe(1);
        expect(game.isComplete(game.center!)).toBe(true);
        expect(game.state.eraLog).toEqual([{ era: 1, t: 75 }]);
        expect(game.gateLines().map((line) => line.label)).toEqual([
            'Жители',
            '2 кузницы',
            'Открытия эпохи «Средневековье»',
        ]);
    });

    it('keeps the chief’s house for 30 citizens', () => {
        const game = Game.create(content, 7);
        const center = game.center!;

        expect(game.upgradeBlock(center)).toBe('Нужно 30 жителей');
        game.state.population = 30;
        expect(game.upgradeBlock(center)).toBeNull();
        expect(game.upgradeCost(center)).toEqual({ money: 400, mat: 24 });
    });
});

/** A settlement of one game second at happiness 60. */
function settleOnce(city: Partial<EconomyCity>, input: Partial<EconomyInput>) {
    const full: EconomyCity = {
        jobs: { svc: 0, food: 0, raw: 0, ind: 0, com: 0 },
        lines: [],
        plants: { power: 0, fuel: 0 },
        cleanPower: 0,
        powerUse: 0,
        trade: 0,
        storage: 2400,
        upkeep: 0,
        importDiscount: 0,
        goodsPremium: 0,
        attraction: 0,
        visitors: 0,
        taxMult: 1,
        homeTaxBonus: 0,
        metroCoverage: 0,
        ...city,
    };

    return settle(
        full,
        {
            population: 0,
            money: 1000,
            stocks: { food: 0, mat: 0, goods: 0 },
            bonuses: { prod: 0, produces: {}, tax: 0, trade: 0 },
            golden: 0,
            taxPolicy: 1,
            reserved: { food: 0, mat: 0, goods: 0 },
            congestion: 1,
            previousPowerRatio: 1,
            loan: 0,
            ...input,
        },
        content.world.economy,
        1,
        content.world.time.secondsPerYear,
        () => 60,
    );
}

describe('bounds (gdd §4.4, §4.5, §4.14)', () => {
    it('never exports more than the trade capacity, nor earns more than K × 10', () => {
        const rng = mulberry32(5);

        for (let i = 0; i < 300; i++) {
            const result = settleOnce(
                {
                    jobs: { svc: 0, food: 0, raw: 0, ind: 0, com: 50 },
                    lines: [
                        {
                            jobClass: 'raw',
                            powered: false,
                            burnsFuel: false,
                            produces: { fuel: rng() * 5000 },
                            consumes: {},
                        },
                    ],
                    trade: rng() < 0.2 ? 0 : rng() * 3000,
                    storage: 1000 + rng() * 50_000,
                    goodsPremium: rng() < 0.5 ? 0.25 : 0,
                },
                {
                    population: 20 + rng() * 200,
                    golden: rng() * 0.15,
                    bonuses: { prod: 0, produces: {}, tax: 0, trade: rng() },
                    stocks: {
                        food: rng() * 60_000,
                        mat: rng() * 60_000,
                        goods: rng() * 60_000,
                    },
                },
            );
            const flows = result.flows;
            const sold =
                flows.exports.goods +
                flows.exports.fuel +
                flows.exports.food +
                flows.exports.mat;

            expect(sold).toBeLessThanOrEqual(flows.exportCapacity + 1e-6);
            // 6 × (1 + 25 % premium + 10 % freight + 10 % cargo) × Golden Age 1.15 < 10.
            expect(flows.income.trade).toBeLessThanOrEqual(
                flows.exportCapacity * 10 + 1e-6,
            );
            expect(result.stocks.goods).toBeGreaterThanOrEqual(0);
        }
    });

    it('sells goods first, then spare fuel, then food and materials above 90 % of the stores', () => {
        const result = settleOnce(
            {
                jobs: { svc: 0, food: 0, raw: 0, ind: 0, com: 1 },
                trade: 250,
                storage: 1000,
            },
            { population: 2, stocks: { food: 980, mat: 950, goods: 4 } },
        );
        const exports = result.flows.exports;

        // 250 a year = 10 a tick: the 4 goods, then 6 of the food above 900.
        expect(exports.goods).toBeCloseTo(4 * 25);
        expect(exports.food).toBeCloseTo(6 * 25);
        expect(exports.mat).toBe(0);
        expect(result.flows.income.trade).toBeCloseTo((4 * 6 + 6 * 0.4) * 25);
    });

    it('saturates tourism: never above the demand nor the visitor capacity', () => {
        for (const [demand, capacity] of [
            [0, 100],
            [100, 0],
            [10, 10],
            [1e6, 600],
            [40, 2000],
        ]) {
            const income = tourismIncome(demand, capacity);

            expect(income).toBeLessThanOrEqual(Math.min(demand, capacity));
            expect(income).toBeGreaterThanOrEqual(0);
        }

        expect(tourismIncome(1e9, 600)).toBeCloseTo(600, 0);

        // In a city: every temple adds less; the Town Hall's 10 visitors cap it.
        const game = Game.create(content, 7);
        const tourism: number[] = [];

        game.state.resources.money = 50_000;
        game.state.population = 40;

        for (let x = 36; x <= 60; x++) {
            expect(game.place('road', x, 21).ok).toBe(true);
        }

        for (let i = 0; i < 8; i++) {
            expect(game.place('temple', 36 + i * 2, 22).ok).toBe(true);
            game.testerFinish();
            tourism.push(game.stats.tourism);
        }

        expect(tourism.at(-1)!).toBeLessThan(10);
        expect(tourism.at(-1)! - tourism.at(-2)!).toBeLessThan(
            tourism[1] - tourism[0],
        );
    });
});

describe('upkeep (gdd §4.8)', () => {
    it('charges every finished building’s upkeep; homes and the Town Hall are free', () => {
        const game = Game.create(content, 7);

        game.state.resources.money = 10_000;
        expect(game.place('well', 48, 21).ok).toBe(true);
        expect(game.place('house', 47, 21).ok).toBe(true);
        expect(game.place('temple', 51, 21).ok).toBe(true);
        // Under construction: nothing charged yet.
        expect(game.stats.budget.costs.upkeep).toBe(0);

        game.testerFinish();
        expect(game.stats.budget.costs.upkeep).toBeCloseTo(0.6 + 1.6);
        expect(game.status.get(game.buildingAt(51, 21)!.uid)!.upkeep).toBe(1.6);

        // Nobody to tax: a year costs the upkeep, money only.
        game.state.population = 0;
        game.state.achievements = content.goals.map((goal) => goal.id);
        game.structureChanged();

        const money = game.money;

        for (let i = 0; i < 25; i++) {
            game.tick(1, true);
        }

        const income = game.stats.budget.gross;

        expect(game.stats.budget.spent).toBeCloseTo(2.2);
        // Newcomers start paying tax during the year; upkeep is still charged.
        expect(game.money).toBeLessThan(money + income);
        expect(game.money).toBeGreaterThan(money - 2.2 - 1e-9);
        expect(settleOnce({ upkeep: 2.2 }, {}).flows.net).toBeCloseTo(-2.2);
    });
});

describe('an empty treasury', () => {
    it('stays at zero, never NaN, and mothballs the costliest buildings until the net is positive', () => {
        const game = Game.create(content, 7);

        game.state.resources.money = 50_000;

        for (let x = 38; x <= 61; x++) {
            expect(game.place('road', x, 21).ok).toBe(true);
        }

        for (let i = 0; i < 6; i++) {
            expect(game.place('temple', 38 + i * 2, 22).ok).toBe(true);
        }

        game.testerFinish();
        // No goal rewards to refill the treasury.
        game.state.achievements = content.goals.map((goal) => goal.id);
        game.state.resources.money = 0;
        game.state.resources.food = 0;
        game.state.population = 30;

        const closedAt: number[] = [];

        for (let tick = 0; tick < 100 * 25; tick++) {
            game.tick(1, true);

            expect(Number.isFinite(game.money)).toBe(true);
            expect(game.money).toBeGreaterThanOrEqual(0);

            const closed = [...game.buildings.values()].filter(
                (building) => building.mothballed,
            ).length;

            if (closed > closedAt.length) {
                closedAt.push(game.year);
            }
        }

        const temples = [...game.buildings.values()].filter(
            (building) => building.type === 'temple',
        );
        const closed = temples.filter((temple) => temple.mothballed).length;

        // One a year at most, only temples (homes and the Town Hall stay).
        expect(closed).toBeGreaterThan(0);
        expect(closedAt.length).toBe(closed);
        expect(new Set(closedAt).size).toBe(closed);
        expect(game.state.economy.arrearsYears).toBeGreaterThan(0);
        expect(game.stats.budget.costs.upkeep).toBeCloseTo((6 - closed) * 1.6);
        expect(game.stats.budget.net).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(game.state.population)).toBe(true);
        expect(game.state.population).toBeGreaterThanOrEqual(0);

        for (const amount of Object.values(game.state.resources)) {
            expect(Number.isFinite(amount)).toBe(true);
        }

        // Broke with nothing in the stores: the city starves instead of buying food.
        game.state.resources.money = 0;
        game.state.resources.food = 0;
        game.tick(1, true);
        expect(game.stats.starving).toBe(true);
        expect(game.money).toBeGreaterThanOrEqual(0);
    });

    it('buys food, fuel and grid power while there is money, and stops at zero', () => {
        const city: Partial<EconomyCity> = {
            jobs: { svc: 10, food: 0, raw: 0, ind: 0, com: 0 },
            plants: { power: 10, fuel: 20 },
            powerUse: 30,
        };
        const rich = settleOnce(city, { population: 100 }).flows;

        expect(rich.imports.food).toBeCloseTo(40);
        expect(rich.imports.fuel).toBeCloseTo(20);
        expect(rich.imports.power).toBeCloseTo(20);
        expect(rich.power.ratio).toBe(1);
        expect(rich.costs.power).toBeCloseTo(20 * 100);

        // Broke, and the upkeep is more than the taxes bring.
        const broke = settleOnce(
            { ...city, upkeep: 500 },
            { population: 100, money: 0 },
        );

        expect(broke.flows.starving).toBe(true);
        expect(broke.flows.imports).toEqual({ food: 0, fuel: 0, power: 0 });
        expect(broke.flows.fuel.ratio).toBe(0);
        // No fuel: the plants make nothing — 0 of 30 units of power.
        expect(broke.flows.power.ratio).toBe(0);
        expect(broke.money).toBe(0);
        expect(broke.arrears).toBe(true);
    });
});
