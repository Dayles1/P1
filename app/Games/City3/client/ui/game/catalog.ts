/**
 * The build tray's content (gdd §11.2, ui-spec §5.2 BuildTray/BuildCard):
 * the ten tabs, one card per building at its best open level (roads: one
 * per open level), the lock line, the «Новое» badge and the one effect
 * line of each card.
 */

import type {
    Amounts,
    BuildingDef,
    LevelDef,
} from '../../engine/content/types';
import type { Game } from '../../engine/sim/game';
import { formatNumber } from '../format';
import { t } from '../i18n';
import type { CopyKey } from '../i18n';
import type { IconName } from '../icons/sprite';

export type TabId =
    | 'housing'
    | 'food'
    | 'mat'
    | 'industry'
    | 'trade'
    | 'services'
    | 'leisure'
    | 'energy'
    | 'transport'
    | 'roads';

export const TABS: readonly { id: TabId; icon: IconName; label: CopyKey }[] = [
    { id: 'housing', icon: 'house', label: 'build.tab.housing' },
    { id: 'food', icon: 'wheat', label: 'build.tab.food' },
    { id: 'mat', icon: 'mat', label: 'build.tab.mat' },
    { id: 'industry', icon: 'factory', label: 'build.tab.industry' },
    { id: 'trade', icon: 'stall', label: 'build.tab.trade' },
    { id: 'services', icon: 'service', label: 'build.tab.services' },
    { id: 'leisure', icon: 'masks', label: 'build.tab.leisure' },
    { id: 'energy', icon: 'bolt', label: 'build.tab.energy' },
    { id: 'transport', icon: 'train', label: 'build.tab.transport' },
    { id: 'roads', icon: 'road', label: 'build.tab.roads' },
];

const TRANSPORT = new Set(['port', 'rail_station', 'airport', 'metro_station']);

/** Which tab a building lives on; null for what is never built by hand. */
export function tabOf(game: Game, def: BuildingDef): TabId | null {
    const role = game.content.roleOf(def);

    if (def.hidden || role === 'center') {
        return null;
    }

    if (role === 'road' || def.network === 'road') {
        return 'roads';
    }

    if (def.network === 'rail' || TRANSPORT.has(def.id)) {
        return 'transport';
    }

    switch (def.category) {
        case 'housing':
            return 'housing';
        case 'food':
            return 'food';
        case 'resources':
            return 'mat';
        case 'industry':
            return 'industry';
        case 'trade':
            return 'trade';
        case 'power':
            return 'energy';
        case 'services':
        case 'science': {
            const effects = def.levels[0].effects;
            const service = effects.coverage?.service;

            return service === 'leisure' || (!service && effects.aura)
                ? 'leisure'
                : 'services';
        }
        default:
            return 'services';
    }
}

/** Repeatable types keep the tool after a build (ui-spec §6.1 step 6). */
export function isRepeatable(game: Game, def: BuildingDef): boolean {
    return (
        !def.unique &&
        (def.category === 'housing' ||
            ['park', 'farm', 'fishery', 'lumber'].includes(def.id) ||
            game.content.roleOf(def) === 'road')
    );
}

/** Homes and parks can be painted in a row (ui-spec §6.1 step 7). */
export function isPaintable(def: BuildingDef): boolean {
    return (
        !def.unique &&
        def.size.w === 1 &&
        def.size.h === 1 &&
        (def.category === 'housing' || def.id === 'park')
    );
}

export interface Card {
    def: BuildingDef;
    level: LevelDef;
    /** Lock line, when nothing of it can be built yet. */
    locked: string | null;
    isNew: boolean;
    /** Unique and already standing: the card shows it instead. */
    builtUid: number | null;
    cost: Amounts;
    effect: string;
}

/** «Откроется: Мореплавание» — why a level is closed, in the card's words. */
export function lockLine(
    game: Game,
    def: BuildingDef,
    level: LevelDef,
): string {
    const era = game.content.epochOrder(level.epoch);

    if (era > game.state.epoch) {
        return t('build.lockEra', { era: game.content.epoch(era).name });
    }

    if (level.tech && !game.hasTech(level.tech)) {
        return t('build.lockTech', {
            tech: game.content.tech(level.tech)?.name ?? level.tech,
        });
    }

    if (
        level.requires?.population &&
        game.state.population < level.requires.population
    ) {
        return t('build.lockPop', { n: level.requires.population });
    }

    if (level.requires?.townHallLevel) {
        return t('build.lockHall', { n: level.requires.townHallLevel });
    }

    return game.levelLock(def, level.level) ?? '';
}

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** One effect line for a card or the placement bar (gdd §11.2 style). */
export function effectLine(
    game: Game,
    def: BuildingDef,
    level: LevelDef,
): string {
    const effects = level.effects;
    const parts: string[] = [];
    const role = game.content.roleOf(def);

    if (role === 'road') {
        return t('fx.road', { n: level.capacity ?? 0 });
    }

    if (effects.housing) {
        parts.push(t('fx.homes', { n: effects.housing }));

        const needs = game.content.world.population.needs
            .slice(0, level.tier)
            .map((need) => lower(need.label));

        if (needs.length) {
            parts.push(t('fx.needs', { list: needs.join(', ') }));
        }

        return parts.join('. ');
    }

    for (const [id, value] of Object.entries(effects.produces)) {
        parts.push(
            t('fx.produces', {
                n: formatNumber(value),
                res: lower(game.content.resource(id)?.name ?? id),
            }),
        );
    }

    if (effects.coverage) {
        parts.push(
            t('fx.coverage', {
                service: t(`service.${effects.coverage.service}` as CopyKey),
                r: effects.coverage.radius,
            }),
        );
    }

    if (effects.power) {
        parts.push(t('fx.power', { n: formatNumber(effects.power) }));
    }

    if (effects.trade) {
        parts.push(t('fx.trade', { n: formatNumber(effects.trade) }));
    }

    if (effects.storage) {
        parts.push(t('fx.storage', { n: formatNumber(effects.storage) }));
    }

    if (effects.research) {
        parts.push(t('fx.research', { n: effects.research }));
    }

    if (effects.charterRadius) {
        parts.push(t('fx.charter', { r: effects.charterRadius }));
    }

    if (effects.boost) {
        parts.push(
            t('fx.boost', {
                n: effects.boost.percent,
                list: effects.boost.targets
                    .map((id) =>
                        game.content.hasBuilding(id)
                            ? lower(game.content.building(id).name)
                            : id,
                    )
                    .join(', '),
            }),
        );
    }

    if (effects.aura && effects.aura.happiness > 0) {
        parts.push(
            t('fx.aura', { n: effects.aura.happiness, r: effects.aura.radius }),
        );
    }

    if (!parts.length && effects.attraction) {
        parts.push(t('fx.attraction'));
    }

    if (!parts.length && effects.jobs) {
        parts.push(t('fx.jobs', { n: effects.jobs }));
    }

    return parts
        .slice(0, 2)
        .map((part, index) => (index ? lower(part) : part))
        .join(', ');
}

function bestLevel(game: Game, def: BuildingDef): LevelDef | null {
    const open = game.availableLevels(def);

    return open.length ? game.content.level(def, open[open.length - 1]) : null;
}

/** Every tab's cards, in content order (first era first). */
export function buildCatalog(game: Game): Record<TabId, Card[]> {
    const catalog = Object.fromEntries(
        TABS.map((tab) => [tab.id, [] as Card[]]),
    ) as Record<TabId, Card[]>;
    const epoch = game.state.epoch;

    for (const def of game.content.buildings) {
        const tab = tabOf(game, def);

        if (!tab || game.content.firstEpoch(def) > epoch + 1) {
            continue;
        }

        const isNew =
            epoch > 0 &&
            game.content.firstEpoch(def) === epoch &&
            !game.has(def.id);

        if (tab === 'roads') {
            const open = game.availableLevels(def);

            for (const number of [...open].reverse()) {
                const level = game.content.level(def, number);

                catalog.roads.push({
                    def,
                    level,
                    locked: null,
                    isNew: false,
                    builtUid: null,
                    cost: level.cost,
                    effect: effectLine(game, def, level),
                });
            }

            const next = def.levels[open[open.length - 1] ?? 0];

            if (next && game.content.epochOrder(next.epoch) <= epoch + 1) {
                catalog.roads.push({
                    def,
                    level: next,
                    locked: lockLine(game, def, next),
                    isNew: false,
                    builtUid: null,
                    cost: next.cost,
                    effect: effectLine(game, def, next),
                });
            }

            continue;
        }

        const best = bestLevel(game, def);
        const level = best ?? def.levels[0];
        let builtUid: number | null = null;

        if (def.unique) {
            for (const building of game.buildings.values()) {
                if (building.type === def.id) {
                    builtUid = building.uid;
                    break;
                }
            }
        }

        catalog[tab].push({
            def,
            level,
            locked: best ? null : lockLine(game, def, level),
            isNew: isNew && best !== null,
            builtUid,
            cost: level.cost,
            effect: effectLine(game, def, level),
        });
    }

    for (const tab of TABS) {
        // Open cards first, the next era's locked ones after.
        catalog[tab.id].sort(
            (a, b) => Number(Boolean(a.locked)) - Number(Boolean(b.locked)),
        );
    }

    return catalog;
}
