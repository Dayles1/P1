import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import { Game } from './game';

const { content } = loadContent();

/**
 * A plain player around the Town Hall (x 49–50, rows 19–20): a street
 * under it, homes on both sides with wells between them, a temple, the
 * agora and the school among the homes, two farms at the end; the
 * cheapest open discovery whenever none is running; the chief's house at
 * 30 citizens, adobe houses after Masonry, and the Middle Ages as soon as
 * the gate opens.
 */
function play(years: number): Game {
    const game = Game.create(content, 7);
    const plan: [string, number, number][] = [];

    for (let x = 40; x <= 63; x++) {
        plan.push(['road', x, 21]);
    }

    plan.push(['well', 47, 20], ['well', 52, 20], ['farm', 60, 22]);

    for (const x of [46, 48, 51, 53, 45, 54, 44, 55, 43, 56]) {
        plan.push(['house', x, 20]);
    }

    plan.push(['well', 47, 22], ['well', 52, 22], ['temple', 44, 22]);

    for (const x of [46, 48, 51, 53, 43]) {
        plan.push(['house', x, 22]);
    }

    plan.push(['market', 49, 22], ['farm', 62, 22], ['school', 54, 22]);
    plan.push(['well', 42, 20], ['well', 57, 20], ['well', 42, 22]);

    for (const x of [41, 40, 58, 59]) {
        plan.push(['house', x, 20]);
    }

    for (const x of [41, 40, 56, 57, 58, 59]) {
        plan.push(['house', x, 22]);
    }

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

        const next = content.techs
            .filter((tech) => !game.techLock(tech))
            .sort((a, b) => a.cost.money - b.cost.money)[0];

        if (!game.state.research && next && game.canAfford(next.cost)) {
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
        // Near the sim's pace (★★ by year 76; typical players 71–106).
        expect(game.year).toBeGreaterThan(40);
        expect(game.year).toBeLessThan(200);
        expect(game.state.achievements).toEqual(
            expect.arrayContaining(['first_homes', 'fields', 'agora']),
        );
        expect(game.money).toBeGreaterThanOrEqual(0);
    });
});
