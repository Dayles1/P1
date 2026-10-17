import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import type { JobClass } from '../content/types';
import { settle } from './economy';
import type { EconomyCity, EconomyInput } from './economy';
import { Game } from './game';

const { content } = loadContent();
const rules = content.world.economy;
const SPY = content.world.time.secondsPerYear;

/**
 * A city in the balance sim's own aggregate terms
 * (docs/design/sim/sim-final.mjs, City.recompute → `this.s`).
 */
interface SimCity {
    pop: number;
    money: number;
    food: number;
    mat: number;
    goods: number;
    jobs: Record<JobClass, number>;
    out: {
        food: { food: number };
        raw: { mat: number; fuel: number };
        ind: { mat: number; goods: number };
    };
    fuelUseInd: number;
    foodUseInd: number;
    fuelUsePower: number;
    power: number;
    pu: number;
    trade: number;
    storage: number;
    upkeep: number;
    tourX: number;
    visitors: number;
    taxMult: number;
    importDisc: number;
    goodsPremium: number;
    bo: {
        food: number;
        mat: number;
        goods: number;
        tax: number;
        trade: number;
        prod: number;
    };
    /** Happiness before the starving penalty. */
    h: number;
}

/**
 * One tick of the sim (City.tick: labour → energy → production → food →
 * exports → money), transcribed line by line with the terms slice 2 has —
 * no Golden Age, charters, stations, routes, programs, orders or loans,
 * normal tax policy, no traffic.
 */
function simTick(c: SimCity): void {
    const y = 1 / SPY;
    const workers = c.pop * 0.5;
    const staff = {} as Record<JobClass, number>;
    let left = workers;
    let jobsAll = 0;

    for (const cl of ['svc', 'food', 'raw', 'ind', 'com'] as JobClass[]) {
        const j = c.jobs[cl];

        jobsAll += j;
        staff[cl] = j > 0 ? Math.min(1, left / j) : 1;
        left = Math.max(0, left - j);
    }

    const unemp = workers > 0 ? Math.max(0, workers - jobsAll) / workers : 0;
    const fuelPower = c.fuelUsePower * staff.svc;
    const supply = c.power * staff.svc;
    let gridBuy = Math.max(0, c.pu - supply);
    let powerRatio = 1;

    if (gridBuy > 0 && c.money <= 0) {
        powerRatio = c.pu > 0 ? Math.min(1, supply / c.pu) : 1;
        gridBuy = 0;
    }

    const base = (1 + c.bo.prod) * (c.pu > 0 ? 0.6 + 0.4 * powerRatio : 1);
    const effFood = staff.food * base;
    const effRaw = staff.raw * base;
    const effInd = staff.ind * base;

    c.food += c.out.food.food * effFood * (1 + c.bo.food) * y;
    c.mat +=
        (c.out.raw.mat * effRaw + c.out.ind.mat * effInd) * (1 + c.bo.mat) * y;
    c.goods += c.out.ind.goods * effInd * (1 + c.bo.goods) * y;

    const fuelMade = c.out.raw.fuel * effRaw * y;
    const fuelNeed = (c.fuelUseInd * effInd + fuelPower) * y;

    c.food -= (c.pop * 0.4 + c.foodUseInd * effInd) * y;

    let starving = false;
    let costs = 0;
    const imp = 1 - c.importDisc;

    if (c.food < 0) {
        const need = -c.food;
        const cost = need * 1.0 * imp;

        if (c.money >= cost) {
            costs += cost;
            c.food = 0;
        } else {
            c.food = 0;
            starving = true;
        }
    }

    let fuelSurplus = 0;

    if (fuelNeed > fuelMade) {
        costs += (fuelNeed - fuelMade) * 3.0 * imp;
    } else {
        fuelSurplus = fuelMade - fuelNeed;
    }

    if (gridBuy > 0) {
        costs += gridBuy * 100 * y;
    }

    const capTotal = c.trade * (1 + c.bo.trade) * staff.com * y;
    let cap = capTotal;
    let trade = 0;
    const sell = (stock: number, price: number, keep: number) => {
        const x = Math.max(0, Math.min(stock - keep, cap));

        cap -= x;
        trade += x * price;

        return x;
    };

    c.goods -= sell(c.goods, 6.0 * (1 + c.goodsPremium), 0);

    if (fuelSurplus > 0) {
        sell(fuelSurplus, 1.2, 0);
    }

    c.food -= sell(c.food, 0.4, c.storage * 0.9);
    c.mat -= sell(c.mat, 1.5, c.storage * 0.9);

    for (const r of ['food', 'mat', 'goods'] as const) {
        if (c[r] > c.storage) {
            c[r] = c.storage;
        }
    }

    const h = c.h - (starving ? 25 : 0);
    const tax =
        c.pop *
        1.0 *
        c.taxMult *
        (0.5 + h / 100) *
        (1 - 0.3 * unemp) *
        (1 + c.bo.tax) *
        y;
    const tour =
        (c.tourX > 0 && c.visitors > 0
            ? (c.tourX * c.visitors) / (c.tourX + c.visitors)
            : 0) * y;

    costs += c.upkeep * y;
    c.money += tax + trade + tour - costs;

    if (c.money < 0) {
        c.money = 0;
    }
}

/** The same city as the engine's cached aggregates. */
function engineCity(c: SimCity): EconomyCity {
    return {
        jobs: { ...c.jobs },
        lines: [
            {
                jobClass: 'food',
                powered: false,
                burnsFuel: false,
                produces: { food: c.out.food.food },
                consumes: {},
            },
            {
                jobClass: 'raw',
                powered: false,
                burnsFuel: false,
                produces: { mat: c.out.raw.mat, fuel: c.out.raw.fuel },
                consumes: {},
            },
            {
                jobClass: 'ind',
                powered: false,
                burnsFuel: c.fuelUseInd > 0,
                produces: { mat: c.out.ind.mat, goods: c.out.ind.goods },
                consumes: { fuel: c.fuelUseInd, food: c.foodUseInd },
            },
        ],
        plants: { power: c.power, fuel: c.fuelUsePower },
        cleanPower: 0,
        powerUse: c.pu,
        trade: c.trade,
        storage: c.storage,
        upkeep: c.upkeep,
        importDiscount: c.importDisc,
        goodsPremium: c.goodsPremium,
        attraction: c.tourX,
        visitors: c.visitors,
        taxMult: c.taxMult,
        homeTaxBonus: 0,
        metroCoverage: 0,
    };
}

/** One game year of both, from the same start; population held. */
function year(c: SimCity) {
    const sim = structuredClone(c);
    const city = engineCity(c);
    let money = c.money;
    let stocks = { food: c.food, mat: c.mat, goods: c.goods };
    let powerRatio = 1;
    let gross = 0;

    for (let t = 0; t < SPY; t++) {
        simTick(sim);

        const input: EconomyInput = {
            population: c.pop,
            money,
            stocks,
            bonuses: {
                prod: c.bo.prod,
                produces: { food: c.bo.food, mat: c.bo.mat, goods: c.bo.goods },
                tax: c.bo.tax,
                trade: c.bo.trade,
            },
            golden: 0,
            taxPolicy: 1,
            reserved: { food: 0, mat: 0, goods: 0 },
            congestion: 1,
            previousPowerRatio: powerRatio,
            loan: 0,
        };
        const result = settle(city, input, rules, 1, SPY, ({ starving }) =>
            starving ? c.h - 25 : c.h,
        );

        money = result.money;
        stocks = result.stocks;
        powerRatio = result.flows.power.ratio;
        gross += result.flows.gross / SPY;
    }

    return { sim, engine: { money, ...stocks }, gross };
}

const village: SimCity = {
    pop: 100,
    money: 500,
    food: 300,
    mat: 2600,
    goods: 0,
    jobs: { svc: 10, food: 8, raw: 6, ind: 0, com: 4 },
    out: {
        food: { food: 56 },
        raw: { mat: 14.4, fuel: 0 },
        ind: { mat: 0, goods: 0 },
    },
    fuelUseInd: 0,
    foodUseInd: 0,
    fuelUsePower: 0,
    power: 0,
    pu: 0,
    trade: 15.9,
    storage: 2800,
    upkeep: 8,
    tourX: 20,
    visitors: 20,
    taxMult: 1.2,
    importDisc: 0,
    goodsPremium: 0,
    bo: { food: 0.25, mat: 0.2, goods: 0, tax: 0.1, trade: 0.2, prod: 0 },
    h: 62,
};

const industrial: SimCity = {
    pop: 3000,
    money: 10_000,
    food: 900,
    mat: 1000,
    goods: 500,
    // 1 500 workers for 1 800 jobs: industry half staffed, commerce empty.
    jobs: { svc: 300, food: 200, raw: 400, ind: 600, com: 300 },
    out: {
        food: { food: 1500 },
        raw: { mat: 600, fuel: 400 },
        ind: { mat: 571, goods: 300 },
    },
    fuelUseInd: 114,
    foodUseInd: 0,
    fuelUsePower: 0,
    power: 0,
    pu: 0,
    trade: 400,
    storage: 40_000,
    upkeep: 2500,
    tourX: 5000,
    visitors: 600,
    taxMult: 4,
    importDisc: 0.1,
    goodsPremium: 0.15,
    bo: { food: 0, mat: 0, goods: 0, tax: 0.2, trade: 0.45, prod: 0.1 },
    h: 58,
};

const modern: SimCity = {
    pop: 8000,
    money: 50_000,
    food: 0,
    mat: 5000,
    goods: 2000,
    jobs: { svc: 1200, food: 600, raw: 800, ind: 900, com: 400 },
    out: {
        food: { food: 2500 },
        raw: { mat: 1000, fuel: 300 },
        ind: { mat: 1200, goods: 900 },
    },
    fuelUseInd: 470,
    foodUseInd: 200,
    fuelUsePower: 200,
    power: 80,
    pu: 120,
    trade: 1500,
    storage: 80_000,
    upkeep: 30_000,
    tourX: 40_000,
    visitors: 8000,
    taxMult: 6,
    importDisc: 0,
    goodsPremium: 0,
    bo: { food: 0.5, mat: 0.2, goods: 0, tax: 0.25, trade: 0.45, prod: 0.15 },
    h: 66,
};

describe('parity with the balance sim (sim-final.mjs)', () => {
    it.each([
        ['an Antiquity village (materials above the export line)', village],
        ['an industrial town short of workers, burning fuel', industrial],
        ['a modern city buying fuel, power and food', modern],
    ])('moves a year of %s like the sim', (_, city) => {
        const { sim, engine, gross } = year(city);

        for (const key of ['money', 'food', 'mat', 'goods'] as const) {
            expect(engine[key], key).toBeCloseTo(sim[key], 6);
        }

        expect(gross).toBeGreaterThan(0);
    });

    it('starves like the sim when the treasury cannot buy food', () => {
        const broke: SimCity = {
            ...village,
            money: 0,
            food: 0,
            out: { ...village.out, food: { food: 10 } },
        };
        const { sim, engine } = year(broke);

        expect(engine.money).toBeCloseTo(sim.money, 6);
        expect(engine.food).toBe(0);
        expect(sim.food).toBe(0);
    });
});

describe('a small city’s yearly flows (formulas of gdd §4 on the real content)', () => {
    /**
     * The Town Hall, a street, two huts by a well and the Town Hall, a
     * farm and the agora; 10 citizens.
     */
    function smallCity(): Game {
        const game = Game.create(content, 7);

        for (let x = 44; x <= 55; x++) {
            expect(game.place('road', x, 21).ok).toBe(true);
        }

        expect(game.place('well', 47, 20).ok).toBe(true);
        expect(game.place('house', 48, 20).ok).toBe(true);
        expect(game.place('house', 46, 20).ok).toBe(true);
        expect(game.place('market', 51, 19).ok).toBe(true);
        expect(game.place('farm', 53, 19).ok).toBe(true);
        game.testerFinish();
        game.state.population = 10;
        game.structureChanged();

        return game;
    }

    it('fills jobs in class order and taxes by the homes’ happiness', () => {
        const game = smallCity();
        const stats = game.stats;
        const flows = stats.flows!;

        // 5 workers: the farm's 4 food jobs first, 1 left for the agora's 4.
        expect(stats.workers).toBe(5);
        expect(flows.staff.food).toBe(1);
        expect(flows.staff.com).toBeCloseTo(0.25);
        expect(stats.unemployment).toBe(0);
        // Upkeep: well 0.6 + agora 0.9 + farm 0.5 (homes and streets free).
        expect(stats.budget.costs.upkeep).toBeCloseTo(2.0);
        expect(stats.budget.upkeepBy).toEqual({
            services: 0.6,
            trade: 0.9,
            food: 0.5,
        });
        // Export capacity: (Town Hall 6 + agora 9.9) × 25 % commerce staff.
        expect(flows.exportCapacity).toBeCloseTo((6 + 9.9) * 0.25);
        // The farm makes 28 food; 10 citizens eat 4.
        expect(stats.rates.food).toBeCloseTo(28 - 4);

        // Tax = P × 1.0 × taxMult × (0.5 + h/100): h is the homes' housing-weighted mean.
        const homes = [...game.buildings.values()].filter(
            (b) => game.status.get(b.uid)!.happiness !== null,
        );
        let weighted = 0;
        let weight = 0;

        for (const home of homes) {
            const housing = game.effects(home).housing;

            weighted += game.status.get(home.uid)!.happiness! * housing;
            weight += housing;
        }

        expect(stats.happiness).toBeCloseTo(weighted / weight, 9);
        expect(stats.taxMult).toBe(1);
        expect(stats.tax).toBeCloseTo(10 * (0.5 + stats.happiness / 100), 9);
        expect(stats.budget.net).toBeCloseTo(
            stats.tax + stats.budget.income.trade + stats.tourism - 2.0,
            9,
        );
    });

    it('gives each home its static happiness (gdd §4.7)', () => {
        const game = smallCity();
        const hut = game.buildingAt(48, 20)!;
        const status = game.status.get(hut.uid)!;

        // Water of 3 services (+10), the Town Hall's aura (+6) and the
        // agora's (+4, r3); a footpath has no appeal.
        expect(status.services).toEqual(['water']);
        expect(status.comfort).toBeCloseTo(1 / 3);
        expect(status.surroundings).toBeCloseTo(35 + 10 + 6 + 4);
        // P*: places × (0.7 + 0.3 × comfort) × occupancy((h − 25) / 45).
        const heff = 4 * (0.7 + 0.3 / 3);

        expect(status.residents).toBe(
            Math.floor(
                heff *
                    Math.min(1, (status.happiness! - 25) / 45) *
                    Math.min(1, 10 / game.stats.target),
            ),
        );
    });
});
