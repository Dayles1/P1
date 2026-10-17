/**
 * One game second of the city's economy (gdd §4.0–§4.6, §4.8), as a pure
 * function of cached aggregates: labour in priority classes, fuel and
 * power, production, food, automatic imports while there is money,
 * exports through the trade capacity, storage, then money — taxes,
 * exports, tourism (saturating) and fares in; upkeep and imports out.
 *
 * The aggregates (`EconomyCity`) are rebuilt by the game only when the
 * map changes, so a tick costs the same for ten buildings or a thousand.
 * Every rate is per year; a tick moves `rate × dt / secondsPerYear`.
 * Money never goes below 0 (and never NaN): a tick whose costs exceed the
 * treasury leaves it at 0 and the city in arrears.
 */

import type { Amounts, JobClass, WorldFile } from '../content/types';

type EconomyRules = WorldFile['economy'];

/** Labour priority (gdd §4.1): services, food, raw materials, industry, commerce. */
export const LABOUR_ORDER: readonly JobClass[] = [
    'svc',
    'food',
    'raw',
    'ind',
    'com',
];

const FUEL = 'fuel';

/**
 * Producers that share a labour class, whether they use power and whether
 * they burn fuel, summed: what they make and use per year at full staff,
 * with their own multipliers (windmill, deposit, charter) applied.
 */
export interface ProductionLine {
    jobClass: JobClass;
    powered: boolean;
    burnsFuel: boolean;
    produces: Amounts;
    consumes: Amounts;
}

/** The city's economy as the map makes it (per year). */
export interface EconomyCity {
    jobs: Record<JobClass, number>;
    lines: ProductionLine[];
    /** Fuel-burning power plants (staffed as services): power made, fuel burnt. */
    plants: { power: number; fuel: number };
    /** Windmills and solar farms. */
    cleanPower: number;
    powerUse: number;
    /** Trade capacity: what can be exported per year. */
    trade: number;
    /** One cap for each of food, materials and goods. */
    storage: number;
    upkeep: number;
    /** Shares, 0..1. */
    importDiscount: number;
    goodsPremium: number;
    /** Tourism demand X (money per year) and visitor capacity C. */
    attraction: number;
    visitors: number;
    /** Housing-weighted tax multiplier of the homes' level eras. */
    taxMult: number;
    /** Housing-weighted tax bonus of the homes (charters, data centres), a share. */
    homeTaxBonus: number;
    /** Housing-weighted share of the homes a working metro station serves. */
    metroCoverage: number;
}

export interface Stocks {
    food: number;
    mat: number;
    goods: number;
}

export interface EconomyInput {
    population: number;
    money: number;
    stocks: Stocks;
    /** Shares (0.1 = +10 %): every product, per product, taxes, trade capacity. */
    bonuses: {
        prod: number;
        produces: Record<string, number>;
        tax: number;
        trade: number;
    };
    /** Golden Age bonus, a share (slice 4). */
    golden: number;
    /** Tax policy multiplier (slice 3). */
    taxPolicy: number;
    /** Stock kept for open port orders (slice 8). */
    reserved: Stocks;
    /** Production efficiency through traffic (slice 6). */
    congestion: number;
    /** Last tick's power ratio: fuel makers that use power run on it. */
    previousPowerRatio: number;
}

/** What one tick did, as rates per year. */
export interface Flows {
    workers: number;
    jobs: number;
    staff: Record<JobClass, number>;
    unemployment: number;
    made: Amounts;
    used: Amounts;
    eaten: number;
    fuel: { made: number; need: number; ratio: number; surplus: number };
    power: { supply: number; use: number; ratio: number };
    starving: boolean;
    /** Units bought per year (power: units from the regional grid). */
    imports: { food: number; fuel: number; power: number };
    /** Units sold per year. */
    exports: { goods: number; fuel: number; food: number; mat: number };
    /** Units per year the trade capacity allows. */
    exportCapacity: number;
    /** Stock lost per year to full stores. */
    waste: Amounts;
    happiness: number;
    income: { tax: number; trade: number; tourism: number; fares: number };
    costs: { upkeep: number; food: number; fuel: number; power: number };
    tourism: { demand: number; capacity: number };
    gross: number;
    spent: number;
    net: number;
}

export interface Settlement {
    money: number;
    stocks: Stocks;
    /** The tick's costs exceeded the treasury: money stays at 0. */
    arrears: boolean;
    flows: Flows;
}

/** Happiness the city has after this tick's food and power (gdd §4.0: before money). */
export type HappinessOf = (city: {
    starving: boolean;
    powerRatio: number;
}) => number;

const finite = (value: number, fallback = 0) =>
    Number.isFinite(value) ? value : fallback;

/** `X·C / (X + C)`: never above the demand nor the capacity (gdd §4.5). */
export function tourismIncome(demand: number, capacity: number): number {
    return demand > 0 && capacity > 0
        ? (demand * capacity) / (demand + capacity)
        : 0;
}

export function settle(
    city: EconomyCity,
    input: EconomyInput,
    rules: EconomyRules,
    dt: number,
    secondsPerYear: number,
    happinessOf: HappinessOf,
): Settlement {
    const year = dt / secondsPerYear;
    const perYear = (amount: number) => (year > 0 ? amount / year : 0);
    const prices = rules.prices;
    const bonuses = input.bonuses;
    const population = Math.max(0, finite(input.population));
    const money0 = Math.max(0, finite(input.money));
    const canImport = money0 > 0;
    const discount = 1 - city.importDiscount;

    // ——— Labour, in priority classes.
    const workers = population * rules.workforceShare;
    const staff = {} as Record<JobClass, number>;
    let left = workers;
    let jobs = 0;

    for (const jobClass of LABOUR_ORDER) {
        const need = city.jobs[jobClass] ?? 0;

        jobs += need;
        staff[jobClass] = need > 0 ? Math.min(1, left / need) : 1;
        left = Math.max(0, left - need);
    }

    const unemployment =
        workers > 0 ? Math.max(0, workers - jobs) / workers : 0;
    const productivity = Math.max(
        0,
        input.congestion * (1 + bonuses.prod + input.golden),
    );
    const shortfall = (ratio: number) =>
        rules.powerShortfall.base + rules.powerShortfall.share * ratio;
    const efficiency = (
        line: ProductionLine,
        powerRatio: number,
        fuelRatio: number,
    ) =>
        staff[line.jobClass] *
        productivity *
        (line.powered ? shortfall(powerRatio) : 1) *
        (line.burnsFuel ? fuelRatio : 1);
    const bonusOf = (id: string) => 1 + (bonuses.produces[id] ?? 0);

    // ——— Fuel: made by mines and wells, burnt by industry and power plants.
    let fuelMade = 0;
    let fuelIndustry = 0;

    for (const line of city.lines) {
        const e = efficiency(line, input.previousPowerRatio, 1);

        fuelMade += (line.produces[FUEL] ?? 0) * e * bonusOf(FUEL);
        fuelIndustry += (line.consumes[FUEL] ?? 0) * e;
    }

    const fuelNeed = fuelIndustry + city.plants.fuel * staff.svc;
    let fuelRatio = 1;
    let fuelImported = 0;

    if (fuelNeed > fuelMade + 1e-12) {
        if (canImport) {
            fuelImported = fuelNeed - fuelMade;
        } else {
            fuelRatio = fuelMade / fuelNeed;
        }
    }

    const fuelSurplus = Math.max(0, fuelMade - fuelNeed);

    // ——— Power: plants (as their fuel allows), windmills and solar; the rest from the grid.
    const supply =
        (city.plants.power * fuelRatio + city.cleanPower) * staff.svc;
    let powerRatio = 1;
    let powerBought = 0;

    if (city.powerUse > supply + 1e-12) {
        if (canImport) {
            powerBought = city.powerUse - supply;
        } else {
            powerRatio = Math.min(1, supply / city.powerUse);
        }
    }

    // ——— Production of everything else.
    const made: Amounts = { [FUEL]: fuelMade };
    const used: Amounts = { [FUEL]: fuelNeed * fuelRatio };

    for (const line of city.lines) {
        const e = efficiency(line, powerRatio, fuelRatio);

        for (const [id, amount] of Object.entries(line.produces)) {
            if (id !== FUEL) {
                made[id] = (made[id] ?? 0) + amount * e * bonusOf(id);
            }
        }

        for (const [id, amount] of Object.entries(line.consumes)) {
            if (id !== FUEL) {
                used[id] = (used[id] ?? 0) + amount * e;
            }
        }
    }

    // ——— Food: citizens and industry eat; a shortfall is bought, or the city starves.
    const eaten = population * rules.foodPerCitizen;
    const stocks: Stocks = {
        food:
            finite(input.stocks.food) +
            ((made.food ?? 0) - eaten - (used.food ?? 0)) * year,
        mat: Math.max(
            0,
            finite(input.stocks.mat) +
                ((made.mat ?? 0) - (used.mat ?? 0)) * year,
        ),
        goods: Math.max(
            0,
            finite(input.stocks.goods) +
                ((made.goods ?? 0) - (used.goods ?? 0)) * year,
        ),
    };
    let starving = false;
    let foodImported = 0;
    let foodCost = 0;

    if (stocks.food < 0) {
        const need = -stocks.food;
        const cost = need * prices.foodImport * discount;

        if (money0 >= cost) {
            foodImported = need;
            foodCost = cost;
        } else {
            starving = true;
        }

        stocks.food = 0;
    }

    // ——— Exports through the trade capacity: goods, spare fuel, then food
    // and materials above the export line of the stores.
    const exportCapacity =
        Math.max(0, city.trade) * (1 + bonuses.trade) * staff.com;
    let room = exportCapacity * year;
    let trade = 0;
    const sell = (stock: number, keep: number, price: number) => {
        const amount = Math.max(0, Math.min(stock - keep, room));

        room -= amount;
        trade += amount * price;

        return amount;
    };
    const exportLine = city.storage * rules.exportAbove;
    const soldGoods = sell(
        stocks.goods,
        Math.min(input.reserved.goods, city.storage),
        prices.goodsExport * (1 + city.goodsPremium),
    );

    stocks.goods -= soldGoods;

    const soldFuel = sell(fuelSurplus * year, 0, prices.fuelExport);
    const soldFood = sell(
        stocks.food,
        Math.max(exportLine, input.reserved.food),
        prices.foodExport,
    );

    stocks.food -= soldFood;

    const soldMat = sell(
        stocks.mat,
        Math.max(exportLine, input.reserved.mat),
        prices.matExport,
    );

    stocks.mat -= soldMat;
    trade *= 1 + input.golden;

    // ——— Storage: what does not fit is lost.
    const waste: Amounts = {};

    for (const id of ['food', 'mat', 'goods'] as const) {
        if (stocks[id] > city.storage) {
            waste[id] = perYear(stocks[id] - city.storage);
            stocks[id] = city.storage;
        }
    }

    // ——— Happiness (city terms) before money: tax depends on it.
    const happiness = Math.max(
        0,
        Math.min(100, finite(happinessOf({ starving, powerRatio }), 50)),
    );

    // ——— Money.
    const tax =
        population *
        rules.taxPerCitizen *
        city.taxMult *
        (0.5 + happiness / 100) *
        (1 - rules.unemploymentTaxLoss * unemployment) *
        input.taxPolicy *
        (1 + bonuses.tax + input.golden + city.homeTaxBonus) *
        year;
    const tourism = tourismIncome(city.attraction, city.visitors) * year;
    const fares =
        population *
        city.metroCoverage *
        rules.faresShareOfTax *
        rules.taxPerCitizen *
        city.taxMult *
        year;
    const upkeep = city.upkeep * year;
    const fuelCost = fuelImported * prices.fuelImport * discount * year;
    const powerCost = powerBought * prices.gridPower * year;
    const income = finite(tax + trade + tourism + fares);
    const spent = finite(upkeep + foodCost + fuelCost + powerCost);
    const after = money0 + income - spent;
    const arrears = after < 0;

    return {
        money: after > 0 ? after : 0,
        stocks,
        arrears,
        flows: {
            workers,
            jobs,
            staff,
            unemployment,
            made,
            used,
            eaten,
            fuel: {
                made: fuelMade,
                need: fuelNeed,
                ratio: fuelRatio,
                surplus: fuelSurplus,
            },
            power: { supply, use: city.powerUse, ratio: powerRatio },
            starving,
            imports: {
                food: perYear(foodImported),
                fuel: fuelImported,
                power: powerBought,
            },
            exports: {
                goods: perYear(soldGoods),
                fuel: perYear(soldFuel),
                food: perYear(soldFood),
                mat: perYear(soldMat),
            },
            exportCapacity,
            waste,
            happiness,
            income: {
                tax: perYear(tax),
                trade: perYear(trade),
                tourism: perYear(tourism),
                fares: perYear(fares),
            },
            costs: {
                upkeep: city.upkeep,
                food: perYear(foodCost),
                fuel: perYear(fuelCost),
                power: perYear(powerCost),
            },
            tourism: { demand: city.attraction, capacity: city.visitors },
            gross: perYear(income),
            spent: perYear(spent),
            net: perYear(income - spent),
        },
    };
}
