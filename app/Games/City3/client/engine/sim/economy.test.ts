import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import { Game } from './game';

const { content } = loadContent();

/** A new world whose farm (east of the Town Hall, so connected) is built. */
function withFarm(population = 8): Game {
    const game = Game.create(content, 7);

    expect(game.place('farm', 51, 19).ok).toBe(true);
    game.testerFinish();
    game.state.population = population;
    game.tick(1, true);

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

        expect(game.status.get(farm.uid)!.output.food).toBeCloseTo(28);
        // 8 citizens eat 0.4 a year each.
        expect(game.stats.rates.food).toBeCloseTo(28 - 8 * 0.4);

        for (let i = 0; i < 25; i++) {
            game.tick(1, true);
        }

        expect(game.state.resources.food - before).toBeCloseTo(28 - 3.2, 5);
    });

    it('taxes 1.0 a citizen a year, by happiness and the homes’ level era', () => {
        const game = withFarm();
        const money = game.money;

        // No homes but the Town Hall: city happiness is base + 20 = 55.
        expect(game.stats.happiness).toBe(55);
        expect(game.stats.taxMult).toBe(1);
        expect(game.stats.tax).toBeCloseTo(8 * 1.0 * (0.5 + 0.55));
        expect(game.stats.rates.money).toBeCloseTo(game.stats.tax);

        for (let i = 0; i < 25; i++) {
            game.tick(1, true);
        }

        expect(game.money - money).toBeCloseTo(8.4, 5);
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

    it('returns half the current level’s money on demolition', () => {
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
        expect(game.canPlace('quarry', 40, 0).ok).toBe(true);
        expect(game.canPlace('quarry', 40, 1).ok).toBe(false);
        expect(game.canPlace('farm', 40, 38).ok).toBe(true);
        expect(game.canPlace('farm', 40, 39).ok).toBe(false);
    });
});

describe('the gate into the next era', () => {
    it('lists citizens, the buildings asked for, discoveries and the Town Hall price', () => {
        const game = Game.create(content, 7);
        const labels = game.epochChecklist().map((line) => line.label);

        expect(labels).toEqual([
            'Жители',
            'Агора',
            'Школа философов',
            'Открытия эпохи «Античность»',
            'Ратуша → «Ратуша»',
        ]);
        expect(game.epochChecklist().at(-1)!.cost).toEqual({
            money: 2400,
            mat: 140,
        });
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
        expect(game.state.epoch).toBe(1);
        expect(game.center!.level).toBe(3);
        expect(game.isComplete(game.center!)).toBe(true);
        expect(game.money).toBe(money - price);
        expect(game.epochChecklist().at(-1)!.label).toBe('Ратуша → «Дворец»');
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
