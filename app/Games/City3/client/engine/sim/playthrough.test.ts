import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import { Game } from './game';

const { content } = loadContent();

/**
 * A plain player around the Town Hall (x 49–50, rows 19–20): a street
 * under it, homes on both sides with wells between them and a farm at the
 * end, two lumber camps for materials, then a temple, parks, the school,
 * the agora and a theatre — every home in reach of water, most of leisure
 * or education. Discoveries in the gate's order (Masonry and Writing as
 * soon as affordable, the rest when the next build is still paid for);
 * the chief's house at 30 citizens, adobe houses after Masonry, and the
 * Middle Ages as soon as the gate opens.
 */
function play(years: number): Game {
    const game = Game.create(content, 7);
    const plan: [string, number, number][] = [];
    const street = (from: number, to: number) => {
        for (let x = from; x <= to; x++) {
            plan.push(['road', x, 21]);
        }
    };
    const homes = (y: number, xs: number[]) => {
        for (const x of xs) {
            plan.push(['house', x, y]);
        }
    };

    street(43, 61);
    plan.push(['well', 46, 20], ['well', 53, 20], ['farm', 56, 22]);
    homes(20, [47, 48, 51, 52, 45, 54, 44, 55]);
    plan.push(['lumber', 61, 20], ['lumber', 61, 22]);
    plan.push(['well', 47, 22], ['well', 52, 22]);
    homes(22, [46, 48, 51, 53]);
    plan.push(['temple', 42, 22]);
    street(42, 42);
    homes(22, [44, 45, 54, 55]);
    plan.push(['park', 43, 20], ['park', 56, 20], ['school', 49, 22]);
    street(38, 41);
    plan.push(['well', 40, 20]);
    homes(20, [41, 42, 39, 38]);
    plan.push(['market', 58, 22], ['well', 59, 20]);
    homes(20, [57, 58, 60]);
    homes(22, [41]);
    plan.push(['theater', 39, 22]);

    const order = ['masonry', 'writing', 'coinage', 'agriculture'].map((id) =>
        content.tech(id)!,
    );

    for (let tick = 0; tick < years * 25 && game.state.epoch === 0; tick++) {
        game.tick(1, true);

        if (tick % 5) {
            continue;
        }

        while (plan.length) {
            const [type, x, y] = plan[0];
            const def = content.building(type);

            if (game.lockReason(def) || !game.canAfford(game.buildCost(def))) {
                break;
            }

            expect(game.place(type, x, y).ok, `${type} at ${x},${y}`).toBe(
                true,
            );
            plan.shift();
        }

        const center = game.center!;

        if (
            center.level === 1 &&
            !game.upgradeBlock(center) &&
            game.canAfford(game.upgradeCost(center))
        ) {
            game.upgrade(center.uid);
        }

        if (!plan.length && game.money > 300 && game.hasTech('masonry')) {
            game.upgradeAll('house', 1);
        }

        const next = order.find(
            (tech) => !game.hasTech(tech.id) && !game.techLock(tech),
        );
        const reserve =
            plan.length && game.state.techs.length >= 2
                ? game.quote(game.buildCost(content.building(plan[0][0]))).total
                : 0;

        if (
            !game.state.research &&
            next &&
            game.money - (next.cost.money ?? 0) >= reserve
        ) {
            game.research(next.id);
        }

        if (game.canAdvance()) {
            expect(game.advanceEpoch().ok).toBe(true);
        }
    }

    return game;
}

describe('a whole era', () => {
    it('plays from the first hut into the Middle Ages', () => {
        const game = play(300);

        expect(
            game.state.epoch,
            JSON.stringify({
                year: game.year,
                gate: game.epochChecklist(),
                population: game.state.population,
                target: game.stats.target,
                happiness: game.stats.happiness,
                money: game.money,
            }),
        ).toBe(1);
        expect(game.center!.level).toBe(3);
        expect(game.state.population).toBeGreaterThanOrEqual(80);
        // Within the sim's typical range (gdd §12.3: 71–106; ★★ by year 76).
        // Measured: year 86.
        expect(game.year).toBeGreaterThanOrEqual(71);
        expect(game.year).toBeLessThanOrEqual(106);
        expect(game.state.achievements).toEqual(
            expect.arrayContaining(['first_homes', 'fields', 'agora']),
        );
        expect(game.money).toBeGreaterThanOrEqual(0);
    });
});
