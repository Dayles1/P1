import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import { settle } from './economy';
import type { EconomyCity } from './economy';
import { Game } from './game';
import {
    chestOffer,
    loanLimit,
    mothballPick,
    policyEffects,
    policyFreeAt,
} from './treasury';

const { content } = loadContent();
const treasury = content.world.economy.treasury;
const policies = content.world.economy.policies;
const SPY = content.world.time.secondsPerYear;

const city = (patch: Partial<EconomyCity> = {}): EconomyCity => ({
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
    ...patch,
});

const year = (
    economy: EconomyCity,
    start: { money: number; loan: number; population: number },
) => {
    let money = start.money;
    let loan = start.loan;
    let interest = 0;

    for (let t = 0; t < SPY; t++) {
        const result = settle(
            economy,
            {
                population: start.population,
                money,
                stocks: { food: 1000, mat: 0, goods: 0 },
                bonuses: { prod: 0, produces: {}, tax: 0, trade: 0 },
                golden: 0,
                taxPolicy: 1,
                reserved: { food: 0, mat: 0, goods: 0 },
                congestion: 1,
                previousPowerRatio: 1,
                loan,
            },
            content.world.economy,
            1,
            SPY,
            () => 50,
        );

        money = result.money;
        loan = result.loan;
        interest += result.flows.costs.interest / SPY;
    }

    return { money, loan, interest };
};

describe('mothballing (gdd §4.10)', () => {
    it('closes the costliest open building after a year in arrears at a loss, one a year', () => {
        const candidates = [
            { uid: 4, upkeep: 2 },
            { uid: 9, upkeep: 7.8 },
            { uid: 5, upkeep: 7.8 },
            { uid: 6, upkeep: 0 },
        ];

        expect(mothballPick(true, -10, candidates)).toBe(5);
        expect(mothballPick(true, 0, candidates)).toBeNull();
        expect(mothballPick(false, -10, candidates)).toBeNull();
        expect(mothballPick(true, -10, [{ uid: 6, upkeep: 0 }])).toBeNull();
    });

    it('never closes homes, the Town Hall or streets; the player reopens by hand', () => {
        const game = Game.create(content, 7);

        game.state.resources.money = 5000;
        game.place('road', 40, 11);
        game.place('house', 40, 10);
        game.place('temple', 42, 12);
        game.testerFinish();

        const temple = game.buildingAt(42, 12)!;
        const upkeep = game.stats.budget.costs.upkeep;

        expect(game.mothballBlock(game.buildingAt(40, 10)!)).not.toBeNull();
        expect(game.mothballBlock(game.center!)).not.toBeNull();
        expect(game.mothballBlock(game.buildingAt(40, 11)!)).not.toBeNull();
        expect(game.mothball(temple.uid).ok).toBe(true);
        expect(game.status.get(temple.uid)).toMatchObject({
            working: false,
            upkeep: 0,
        });
        expect(game.stats.budget.costs.upkeep).toBeCloseTo(upkeep - 1.6);
        expect(game.count('temple')).toBe(0);
        expect(game.reopen(temple.uid).ok).toBe(true);
        expect(game.stats.budget.costs.upkeep).toBeCloseTo(upkeep);
    });
});

describe('the treasury loan (gdd §4.10)', () => {
    it('lends up to 3 years of gross, one at a time', () => {
        expect(loanLimit(1000, treasury)).toBe(3000);
        expect(loanLimit(-5, treasury)).toBe(0);

        const game = Game.create(content, 7);

        game.stats.budget.gross = 100;
        expect(game.loanOffer()).toBe(300);
        expect(game.takeLoan().ok).toBe(true);
        expect(game.state.economy.loan).toBe(300);
        expect(game.money).toBe(1500);
        expect(game.loanOffer()).toBe(0);
        expect(game.takeLoan(10).ok).toBe(false);
    });

    it('charges 10 % a year and repays itself with a quarter of a positive net', () => {
        // Taxes of 100 citizens at happiness 50, all of them jobless: 70 a year.
        const repaid = year(city(), {
            money: 0,
            loan: 10_000,
            population: 100,
        });

        // Interest 1 000 a year is more than the income: no repayment, money runs dry.
        expect(repaid.loan).toBe(10_000);
        expect(repaid.money).toBe(0);
        expect(repaid.interest).toBeCloseTo(1000);

        const small = year(city(), { money: 0, loan: 100, population: 100 });

        // Net = 70 − 10 = 60; a quarter repays ≈ 15 a year, the rest stays.
        expect(small.loan).toBeGreaterThan(84);
        expect(small.loan).toBeLessThan(86);
        expect(small.money).toBeGreaterThan(44);
        expect(small.money).toBeLessThan(46);
    });
});

describe('the Treasury chest (gdd §4.12)', () => {
    const offer = (patch: Partial<Parameters<typeof chestOffer>[0]>) =>
        chestOffer(
            {
                net: 1000,
                hoursAway: 8,
                time: 100 * SPY,
                lastClaim: null,
                secondsPerYear: SPY,
                ...patch,
            },
            treasury,
        );

    it('holds up to a year of net after 8 hours away', () => {
        expect(offer({})).toBe(1000);
        expect(offer({ hoursAway: 2 })).toBe(250);
        expect(offer({ hoursAway: 30 })).toBe(1000);
        expect(offer({ net: -5 })).toBe(0);
        expect(offer({ hoursAway: 0 })).toBe(0);
    });

    it('opens once per 25 game years', () => {
        expect(offer({ lastClaim: 90 * SPY })).toBe(0);
        expect(offer({ lastClaim: 75 * SPY + 1 })).toBe(0);
        expect(offer({ lastClaim: 75 * SPY })).toBe(1000);

        const game = Game.create(content, 7);

        game.state.time = 30 * SPY;
        game.stats.budget.net = 400;
        expect(game.chestOffer(4)).toBe(200);
        expect(game.claimChest(200).ok).toBe(true);
        expect(game.money).toBe(1400);
        expect(game.chestOffer(8)).toBe(0);
        expect(game.claimChest(200).ok).toBe(false);
        game.state.time = 55 * SPY;
        expect(game.chestOffer(8)).toBe(400);
    });
});

describe('policies (gdd §4.11)', () => {
    it('trade tax for happiness, and density for housing', () => {
        expect(policyEffects('low', false, policies)).toEqual({
            tax: 0.8,
            happiness: 8,
            housing: 0,
            trips: 0,
        });
        expect(policyEffects('high', true, policies)).toEqual({
            tax: 1.2,
            happiness: -16,
            housing: 0.15,
            trips: 0.1,
        });
        expect(policyFreeAt(null, policies, SPY)).toBe(0);
        expect(policyFreeAt(100, policies, SPY)).toBe(100 + 5 * SPY);
    });

    it('open with their era and lock for 5 years after a change', () => {
        const game = Game.create(content, 7);

        expect(game.policyLock('tax')).toBe(
            'Откроется в эпоху «Средневековье»',
        );
        expect(game.setTaxPolicy('high').ok).toBe(false);
        game.testerNextEpoch();
        expect(game.policyLock('tax')).toBeNull();
        expect(game.setTaxPolicy('high').ok).toBe(true);
        expect(game.policies().tax).toBe(1.2);
        expect(game.setTaxPolicy('low').ok).toBe(false);
        game.state.time += 5 * SPY;
        expect(game.setTaxPolicy('low').ok).toBe(true);
        expect(game.policyLock('dense')).toBe(
            'Откроется в эпоху «Индустриальная эра»',
        );
    });
});
