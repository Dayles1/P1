/**
 * What the HUD tells the player about the city's troubles: the alert
 * badges (gdd §11.1, ui-spec §5.1 AlertBadges) and the one Advisor line
 * (gdd §9.5: the first matching rule wins; tapping it opens the fix), and
 * the scan of homes behind both the Advisor's «N домов не растут» and the
 * «Улучшить» badge.
 */

import type { NeedDef } from '../../engine/content/types';
import type { Game } from '../../engine/sim/game';
import { formatExact, formatNumber } from '../format';
import { t, word } from '../i18n';
import type { IconName } from '../icons/sprite';
import { tabOf } from './catalog';
import type { TabId } from './catalog';

/** Where a fix leads: a build tab (at a card), a sheet, or the upgrade sheet. */
export type FixTarget =
    | { kind: 'build'; tab: TabId; type?: string }
    | { kind: 'sheet'; sheet: 'city' | 'hall' | 'upgrade' | 'goals' }
    | { kind: 'research' };

export type AlertId =
    'food' | 'power' | 'arrears' | 'traffic' | 'jobless' | 'workers';

export interface AlertView {
    id: AlertId;
    tone: 'bad' | 'warn';
    icon: IconName;
    text: string;
    target: FixTarget;
}

export interface AdvisorView {
    id: string;
    text: string;
    target: FixTarget;
}

/** Homes the next level is open for, and why the others cannot grow. */
export interface HomeScan {
    /** Homes that could be upgraded now (money aside). */
    upgradable: number;
    /** Homes held back by a missing need, most common first. */
    blocked: { need: NeedDef; count: number }[];
}

function mothballedCount(game: Game): number {
    let count = 0;

    for (const building of game.buildings.values()) {
        count += building.mothballed ? 1 : 0;
    }

    return count;
}

function minStaff(game: Game): number {
    return Math.min(1, ...Object.values(game.stats.staff));
}

/** The building that brings a need, if the city can build one now. */
export function fixFor(game: Game, need: NeedDef): FixTarget {
    if (need.need === 'power') {
        return { kind: 'build', tab: 'energy' };
    }

    if (need.need === 'happiness' || need.need === 'aura') {
        return { kind: 'build', tab: 'leisure', type: 'park' };
    }

    if (need.need === 'transit') {
        return { kind: 'build', tab: 'roads' };
    }

    const def = game.content.buildings.find(
        (candidate) =>
            !candidate.hidden &&
            candidate.levels.some(
                (level) => level.effects.coverage?.service === need.need,
            ) &&
            game.availableLevels(candidate).length > 0,
    );

    return def
        ? { kind: 'build', tab: tabOf(game, def) ?? 'services', type: def.id }
        : { kind: 'build', tab: 'services' };
}

/** Walks the homes once: upgradable ones and the needs holding back the rest. */
export function scanHomes(game: Game): HomeScan {
    let upgradable = 0;
    const blocked = new Map<NeedDef, number>();

    for (const building of game.buildings.values()) {
        const def = game.def(building);

        if (
            def.category !== 'housing' ||
            building.mothballed ||
            !def.levels[building.level] ||
            !game.isComplete(building) ||
            game.levelLock(def, building.level + 1)
        ) {
            continue;
        }

        const missing = game.missingNeeds(
            def,
            building.level + 1,
            building.x,
            building.y,
            building.uid,
        );

        if (!missing.length) {
            upgradable++;
        } else {
            blocked.set(missing[0], (blocked.get(missing[0]) ?? 0) + 1);
        }
    }

    return {
        upgradable,
        blocked: [...blocked.entries()]
            .map(([need, count]) => ({ need, count }))
            .sort((a, b) => b.count - a.count),
    };
}

/** The alert badges, in gdd §11.1 order. */
export function alertsOf(game: Game): AlertView[] {
    const stats = game.stats;
    const budget = stats.budget;
    const gross = Math.max(1, budget.gross);
    const list: AlertView[] = [];
    const food = budget.costs.food;
    const power = budget.costs.power + budget.costs.fuel;

    if (stats.starving || food > 0.03 * gross) {
        list.push({
            id: 'food',
            tone: 'bad',
            icon: 'wheat',
            text: t('alert.food', { n: formatExact(food) }),
            target: { kind: 'build', tab: 'food', type: 'farm' },
        });
    }

    if (power > 0.08 * gross) {
        list.push({
            id: 'power',
            tone: 'bad',
            icon: 'bolt',
            text: t('alert.power', { n: formatExact(power) }),
            target: { kind: 'build', tab: 'energy' },
        });
    }

    if (stats.arrears || game.state.economy.arrears) {
        const closed = mothballedCount(game);

        list.push({
            id: 'arrears',
            tone: 'bad',
            icon: 'coin-off',
            text: closed
                ? t('alert.arrears', {
                      n: closed,
                      word: word(closed, 'buildings'),
                  })
                : t('alert.arrearsNow'),
            target: { kind: 'sheet', sheet: 'city' },
        });
    }

    if (stats.traffic > 1) {
        list.push({
            id: 'traffic',
            tone: 'warn',
            icon: 'car',
            text: t('alert.traffic', { pct: Math.round(stats.traffic * 100) }),
            target: { kind: 'build', tab: 'roads' },
        });
    }

    if (stats.unemployment > 0.06) {
        list.push({
            id: 'jobless',
            tone: 'warn',
            icon: 'briefcase',
            text: t('alert.jobless', {
                pct: Math.round(stats.unemployment * 100),
            }),
            target: { kind: 'build', tab: 'industry' },
        });
    }

    if (game.state.population >= 10 && minStaff(game) < 0.9) {
        list.push({
            id: 'workers',
            tone: 'warn',
            icon: 'hardhat',
            text: t('alert.workers'),
            target: { kind: 'build', tab: 'housing' },
        });
    }

    return list;
}

/** The Advisor's line (gdd §9.5): the first rule that matches. */
export function advise(game: Game, scan: HomeScan): AdvisorView | null {
    const stats = game.stats;
    const budget = stats.budget;
    const gross = Math.max(1, budget.gross);

    if (stats.starving || budget.costs.food > 0.03 * gross) {
        return {
            id: 'food',
            text: t('advisor.food'),
            target: { kind: 'build', tab: 'food', type: 'farm' },
        };
    }

    if (budget.costs.power + budget.costs.fuel > 0.08 * gross) {
        return {
            id: 'power',
            text: t('advisor.power'),
            target: { kind: 'build', tab: 'energy' },
        };
    }

    if (stats.arrears || game.state.economy.arrears) {
        const closed = mothballedCount(game);

        return {
            id: 'arrears',
            text: t('advisor.arrears', {
                n: closed,
                word: word(closed, 'buildings'),
            }),
            target: { kind: 'sheet', sheet: 'city' },
        };
    }

    if (budget.gross > 0 && budget.costs.upkeep > 0.9 * budget.gross) {
        return {
            id: 'upkeep',
            text: t('advisor.upkeep'),
            target: { kind: 'sheet', sheet: 'city' },
        };
    }

    const top = scan.blocked[0];

    if (top && top.count >= 3) {
        return {
            id: `needs:${top.need.label}`,
            text: t('advisor.needs', {
                n: top.count,
                homes: word(top.count, 'homes'),
                need: top.need.label,
            }),
            target: fixFor(game, top.need),
        };
    }

    if (stats.unemployment > 0.06) {
        return {
            id: 'jobless',
            text: t('advisor.jobless', {
                pct: Math.round(stats.unemployment * 100),
            }),
            target: { kind: 'build', tab: 'industry' },
        };
    }

    if (game.state.population >= 10 && minStaff(game) < 0.9) {
        return {
            id: 'workers',
            text: t('advisor.workers'),
            target: { kind: 'build', tab: 'housing' },
        };
    }

    if (stats.traffic > 1.2) {
        return {
            id: 'traffic',
            text: t('advisor.traffic'),
            target: { kind: 'build', tab: 'roads' },
        };
    }

    const next = game.nextEpoch;

    if (next && !game.townHallBuilding()) {
        const open = game.gateLines().find((line) => !line.done);

        if (open) {
            return {
                id: `gate:${open.label}`,
                text: t('advisor.gate', {
                    era: next.name,
                    line: open.label,
                    current: formatNumber(open.current),
                    target: formatNumber(open.target),
                }),
                target: { kind: 'sheet', sheet: 'hall' },
            };
        }

        return {
            id: 'gate-ready',
            text: t('advisor.gateReady'),
            target: { kind: 'sheet', sheet: 'hall' },
        };
    }

    if (budget.gross > 0 && game.money > 8 * budget.gross) {
        return {
            id: 'idle',
            text: t('advisor.idle'),
            target: { kind: 'sheet', sheet: 'upgrade' },
        };
    }

    if (
        !game.state.research &&
        game.content.techs.some((tech) => !game.techLock(tech))
    ) {
        return {
            id: 'research',
            text: t('advisor.research'),
            target: { kind: 'research' },
        };
    }

    return null;
}
