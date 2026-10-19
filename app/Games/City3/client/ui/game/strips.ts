/**
 * Expansion strips on screen (gdd §5.2–§5.3, ui-spec §5.1 StripPlaque,
 * §5.2 StripSheet, §6.6). The engine's land API (`Game.landOffer`,
 * `Game.buyStrip`) is reached through this one adapter, so the interface
 * builds whether or not the engine has it yet; without it no plaques show.
 * What each strip holds (bay, ore, portal, …) is described here from the
 * fixed map of gdd §5.3.
 */

import type { Game } from '../../engine/sim/game';
import type { Renderer } from '../../scene/renderer';
import type { IconName } from '../icons/sprite';

export type Side = 'west' | 'east';

/** What `Game.landOffer(side)` answers: the next strip on a side. */
export interface LandOffer {
    minX: number;
    maxX: number;
    price: number;
    affordable: boolean;
    /** What it holds, as the engine words it («богатая руда»). */
    feature?: string | null;
    loan?: unknown;
}

interface StripScene {
    pickStrip?: (px: number, py: number) => Side | null;
    stripPlaqueOnScreen?: (
        side: Side,
    ) => { x: number; y: number; visible: boolean } | null;
}

function scene(renderer: Renderer): StripScene {
    return renderer as unknown as StripScene;
}

/** The scene draws the plaques itself (3D, on posts); the UI only adds edge chips. */
export function sceneDrawsPlaques(renderer: Renderer): boolean {
    return typeof scene(renderer).stripPlaqueOnScreen === 'function';
}

/** The side whose 3D plaque is under a point, if the scene has them. */
export function pickStripAt(
    renderer: Renderer,
    px: number,
    py: number,
): Side | null {
    const pick = scene(renderer).pickStrip;

    return typeof pick === 'function' ? (pick.call(renderer, px, py) ?? null) : null;
}

/** Where a side's 3D plaque is on screen (null: not shown). */
export function scenePlaque(
    renderer: Renderer,
    side: Side,
): { x: number; y: number; visible: boolean } | null {
    const at = scene(renderer).stripPlaqueOnScreen;

    return typeof at === 'function' ? (at.call(renderer, side) ?? null) : null;
}

interface LandApi {
    landOffer?: (side: Side) => LandOffer | null;
    buyStrip?: (side: Side) => boolean;
}

function api(game: Game): LandApi {
    return game as unknown as LandApi;
}

/** The engine can sell land. */
export function canSellLand(game: Game): boolean {
    return typeof api(game).landOffer === 'function';
}

/** The next strip on a side, or null (none left, or no land API). */
export function landOffer(game: Game, side: Side): LandOffer | null {
    const land = api(game);

    if (typeof land.landOffer !== 'function') {
        return null;
    }

    try {
        return land.landOffer.call(game, side) ?? null;
    } catch {
        return null;
    }
}

/** Buys the next strip on a side; false when it could not. */
export function buyStrip(game: Game, side: Side): boolean {
    const land = api(game);

    if (typeof land.buyStrip !== 'function') {
        return false;
    }

    return Boolean(land.buyStrip.call(game, side));
}

/** The loan the engine offers for a strip, when it says (a number), else null. */
export function offerLoan(offer: LandOffer): number | null {
    const loan = offer.loan;

    if (typeof loan === 'number') {
        return loan;
    }

    if (loan && typeof loan === 'object' && 'amount' in loan) {
        const amount = (loan as { amount: unknown }).amount;

        return typeof amount === 'number' ? amount : null;
    }

    return null;
}

export interface StripFeature {
    icon: IconName;
    title: string;
    detail: string;
}

export interface StripInfo {
    /** The sheet title: «Глубокая бухта». */
    name: string;
    /** The plaque's word: «бухта». */
    word: string;
    icon: IconName;
    features: StripFeature[];
}

const ORE: StripFeature = {
    icon: 'pick',
    title: 'Рудная жила',
    detail: 'место для рудников у подножия гор',
};
const RICH_ORE: StripFeature = {
    icon: 'pick',
    title: 'Богатая руда',
    detail: 'рудники здесь дают в полтора раза больше',
};
const COAL: StripFeature = {
    icon: 'pick',
    title: 'Угольный пласт',
    detail: 'для угольных шахт Индустриальной эры',
};
const RICH_COAL: StripFeature = {
    icon: 'pick',
    title: 'Богатый уголь',
    detail: 'шахты здесь дают в полтора раза больше',
};
const PORTAL: StripFeature = {
    icon: 'portal',
    title: 'Горный портал',
    detail: 'отсюда железная дорога уйдёт за горы',
};
const OIL: StripFeature = {
    icon: 'oil',
    title: 'Нефть',
    detail: 'четыре места для скважин у самой воды',
};
const RICH_OIL: StripFeature = {
    icon: 'oil',
    title: 'Богатая нефть',
    detail: 'скважины здесь дают в полтора раза больше',
};
const CAPE: StripFeature = {
    icon: 'lighthouse',
    title: 'Мыс с маяком',
    detail: 'гостей на здешнем пляже больше на четверть',
};

/** gdd §5.3, by the strip's first column. */
const STRIPS: Record<number, StripInfo> = {
    30: {
        name: 'Богатая руда',
        word: 'руда, богатая',
        icon: 'pick',
        features: [RICH_ORE],
    },
    25: {
        name: 'Угольный пласт',
        word: 'уголь',
        icon: 'pick',
        features: [COAL],
    },
    20: {
        name: 'Горный портал',
        word: 'портал',
        icon: 'portal',
        features: [PORTAL],
    },
    15: { name: 'Нефтяной берег', word: 'нефть', icon: 'oil', features: [OIL] },
    10: {
        name: 'Богатый уголь',
        word: 'уголь, богатый',
        icon: 'pick',
        features: [RICH_COAL],
    },
    5: { name: 'Рудная жила', word: 'руда', icon: 'pick', features: [ORE] },
    0: {
        name: 'Западный мыс',
        word: 'мыс',
        icon: 'lighthouse',
        features: [CAPE],
    },
    65: {
        name: 'Глубокая бухта',
        word: 'бухта',
        icon: 'anchor',
        features: [
            {
                icon: 'anchor',
                title: 'Порт в бухте',
                detail: 'торговля ×1,5, гостей ×1,2',
            },
            {
                icon: 'fish',
                title: 'Рыбный промысел',
                detail: 'первые 5 причалов в бухте дают ×1,25 еды',
            },
        ],
    },
    70: { name: 'Рудная жила', word: 'руда', icon: 'pick', features: [ORE] },
    75: {
        name: 'Уголь и портал',
        word: 'уголь, портал',
        icon: 'portal',
        features: [COAL, PORTAL],
    },
    80: {
        name: 'Богатая руда',
        word: 'руда, богатая',
        icon: 'pick',
        features: [RICH_ORE],
    },
    85: {
        name: 'Богатая нефть',
        word: 'нефть, богатая',
        icon: 'oil',
        features: [RICH_OIL],
    },
    90: {
        name: 'Солнечный склон',
        word: 'солнце',
        icon: 'sun',
        features: [
            {
                icon: 'sun',
                title: 'Солнечный склон',
                detail: 'солнечные станции дают на четверть больше',
            },
        ],
    },
    95: {
        name: 'Восточный мыс',
        word: 'мыс',
        icon: 'lighthouse',
        features: [CAPE],
    },
};

/** What a strip holds, by its first column; a plain strip when unknown. */
export function stripInfo(minX: number, feature?: string | null): StripInfo {
    const known = STRIPS[minX] ?? {
        name: 'Новая земля',
        word: 'земля',
        icon: 'house',
        features: [],
    };

    return feature ? { ...known, word: feature } : known;
}

/** The 14-strip diagram: one cell per strip, the town in the middle. */
export interface StripCell {
    minX: number;
    state: 'own' | 'pick' | 'locked';
}

export function stripCells(
    game: Game,
    pick: LandOffer | null,
): { west: StripCell[]; east: StripCell[] } {
    const land = game.state.land;
    const start = game.content.world.map.start;
    const width = 5;
    const cells = (from: number, to: number): StripCell[] => {
        const list: StripCell[] = [];

        for (let x = from; x <= to; x += width) {
            list.push({
                minX: x,
                state:
                    pick && pick.minX === x
                        ? 'pick'
                        : x >= land.minX && x + width - 1 <= land.maxX
                          ? 'own'
                          : 'locked',
            });
        }

        return list;
    };

    return {
        west: cells(start.minX - 7 * width, start.minX - width),
        east: cells(start.maxX + 1, start.maxX + 7 * width),
    };
}
