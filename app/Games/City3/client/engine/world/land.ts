/**
 * The land of the fixed map (gdd §5): the expansion strips and their
 * price, what may stand where — the bands of rows, the mountain foot with
 * its ore and coal spots and tunnel portals, the waterline with its oil
 * spots, the future airport's plot — and the places that change what
 * stands there: rich deposits, the deep bay, the capes and the sunny
 * slope. Pure functions over world.json, shared by the engine, the scene
 * and the tests; the server mirrors the placement rules (WorldPayloadRules).
 */

import type {
    BuildingDef,
    ColumnSpan,
    DepositDef,
    DepositKind,
    WorldFile,
} from '../content/types';
import type { MapLayout } from './layout';

export type Side = 'west' | 'east';
export type MapDef = WorldFile['map'];
export type LandRules = WorldFile['land'];

/** A footprint on the grid. */
export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/**
 * The buildings a place of the map treats specially, by their content ids
 * (stable across versions, gdd conventions).
 */
export const SITE_TYPES = {
    port: 'port',
    fishery: 'fishery',
    solar: 'solar_farm',
} as const;

export const DEPOSIT_NAMES: Record<DepositKind, string> = {
    ore: 'руда',
    coal: 'уголь',
    oil: 'нефть',
};

const RICH_NAMES: Record<DepositKind, string> = {
    ore: 'богатая руда',
    coal: 'богатый уголь',
    oil: 'богатая нефть',
};

export const SIDE_NAMES: Record<Side, string> = {
    west: 'на западе',
    east: 'на востоке',
};

export function overlaps(a: Rect, b: Rect): boolean {
    return (
        a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
    );
}

export function sameRect(a: Rect, b: Rect): boolean {
    return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

/** Every column of a footprint lies inside the span. */
export function inSpan(rect: Rect, span: ColumnSpan): boolean {
    return rect.x >= span.minX && rect.x + rect.w - 1 <= span.maxX;
}

// ———————————————————————————————————————— Strips

/** Strips bought on each side of the starting columns. */
export function stripsOwned(
    land: ColumnSpan,
    start: ColumnSpan,
    rules: LandRules,
): Record<Side, number> {
    return {
        west: Math.max(
            0,
            Math.floor((start.minX - land.minX) / rules.stripWidth),
        ),
        east: Math.max(
            0,
            Math.floor((land.maxX - start.maxX) / rules.stripWidth),
        ),
    };
}

/**
 * What the next strip costs (gdd §5.2): it depends only on how many are
 * owned already, whichever side; null when every strip is bought.
 */
export function stripPrice(owned: number, rules: LandRules): number | null {
    return rules.price[Math.max(0, owned)] ?? null;
}

/**
 * The next strip on a side — the columns right outside the land, so the
 * land stays one piece and is bought outwards in order — or null when that
 * side is all bought (or the map ends).
 */
export function nextStrip(
    land: ColumnSpan,
    side: Side,
    start: ColumnSpan,
    rules: LandRules,
    width: number,
): ColumnSpan | null {
    if (stripsOwned(land, start, rules)[side] >= rules.perSide) {
        return null;
    }

    const strip =
        side === 'west'
            ? { minX: land.minX - rules.stripWidth, maxX: land.minX - 1 }
            : { minX: land.maxX + 1, maxX: land.maxX + rules.stripWidth };

    return strip.minX >= 0 && strip.maxX < width ? strip : null;
}

/** The land with a strip along one of its edges added. */
export function addStrip(land: ColumnSpan, strip: ColumnSpan): ColumnSpan {
    return {
        minX: Math.min(land.minX, strip.minX),
        maxX: Math.max(land.maxX, strip.maxX),
    };
}

/** The owned columns from the strips bought on each side (as a save keeps them). */
export function landOf(
    start: ColumnSpan,
    west: number,
    east: number,
    rules: LandRules,
    width: number,
): ColumnSpan {
    const count = (value: number) =>
        Math.max(0, Math.min(rules.perSide, Math.floor(value) || 0));

    return {
        minX: Math.max(0, start.minX - count(west) * rules.stripWidth),
        maxX: Math.min(width - 1, start.maxX + count(east) * rules.stripWidth),
    };
}

// ———————————————————————————————————————— What stands where

/** The deposit spot a footprint covers exactly, if any. */
export function depositAt(map: MapDef, rect: Rect): DepositDef | undefined {
    return map.deposits.find((spot) => sameRect(spot, rect));
}

/** The deposit spots a footprint touches. */
export function depositsUnder(map: MapDef, rect: Rect): DepositDef[] {
    return map.deposits.filter((spot) => overlaps(spot, rect));
}

/** The column of a tunnel portal a footprint covers (portals are on row 0). */
export function portalUnder(map: MapDef, rect: Rect): number | null {
    return rect.y === 0
        ? (map.portals.find((x) => x >= rect.x && x < rect.x + rect.w) ?? null)
        : null;
}

/** What a strip holds, in a few words for its plaque («богатая руда», «бухта»); null for plain land. */
export function stripFeature(map: MapDef, span: ColumnSpan): string | null {
    const parts: string[] = [];
    const kinds = new Map<DepositKind, boolean>();

    for (const spot of map.deposits) {
        if (inSpan(spot, span)) {
            kinds.set(
                spot.kind,
                (kinds.get(spot.kind) ?? false) || !!spot.rich,
            );
        }
    }

    for (const [kind, rich] of kinds) {
        parts.push(rich ? RICH_NAMES[kind] : DEPOSIT_NAMES[kind]);
    }

    if (map.portals.some((x) => x >= span.minX && x <= span.maxX)) {
        parts.push('портал');
    }

    const { bay, cape, sunny } = map.features;
    const covers = (feature: ColumnSpan) =>
        feature.minX <= span.maxX && span.minX <= feature.maxX;

    if (covers(bay)) {
        parts.push('бухта');
    }

    if (cape.some(covers)) {
        parts.push('мыс с маяком');
    }

    if (covers(sunny)) {
        parts.push('солнечный склон');
    }

    return parts.length ? parts.join(', ') : null;
}

/**
 * Why a building cannot stand on a footprint because of where it is (gdd
 * §5.1, §5.3, §5.4) — its band of rows, its deposit, a portal, the airport
 * plot; null when it can. Ownership and free tiles are checked elsewhere.
 */
export function placementReason(
    def: BuildingDef,
    rect: Rect,
    layout: MapLayout,
    map: MapDef,
): string | null {
    const bottom = rect.y + rect.h - 1;
    const waterline = layout.seaY - 1;
    const plot = map.airportPlot;
    const zone = def.placement.zone;

    if (zone === 'airportPlot') {
        return sameRect(rect, plot)
            ? null
            : 'Аэропорт строят только на его участке';
    }

    if (overlaps(rect, plot) && !plot.allow.includes(def.id)) {
        return 'Участок будущего аэропорта: здесь только дороги и парки';
    }

    switch (zone) {
        case 'land':
            return bottom < layout.beachY
                ? null
                : 'Это здание ставят на суше, не на пляже';
        case 'landOrBeach':
            return bottom < waterline
                ? null
                : 'У самой воды ставят только причалы';
        case 'coast':
            return bottom === waterline
                ? spotReason(def, rect, map)
                : 'Ставится у самой кромки воды';
        case 'mountain':
            return rect.y === 0
                ? spotReason(def, rect, map)
                : 'Ставится у подножия гор — вплотную к ним';
        default:
            return 'Такое здание пока нельзя поставить';
    }
}

/**
 * At the mountain foot and the waterline: an extractor stands exactly on
 * a spot of its kind; everything else there leaves the spots (and the
 * tunnel portals) free.
 */
function spotReason(def: BuildingDef, rect: Rect, map: MapDef): string | null {
    const kind = def.placement.deposit;
    const under = depositsUnder(map, rect);

    if (kind) {
        if (depositAt(map, rect)?.kind === kind) {
            return null;
        }

        return under.some((spot) => spot.kind === kind)
            ? 'Поставьте точно на месторождение'
            : `Нужно месторождение: ${DEPOSIT_NAMES[kind]}`;
    }

    if (under.length) {
        return `Здесь месторождение (${DEPOSIT_NAMES[under[0].kind]}) — оно для шахты, рудника или вышки`;
    }

    return portalUnder(map, rect) !== null
        ? 'Здесь портал тоннеля — его оставляют железной дороге'
        : null;
}

/** What a building's place gives it (gdd §4.2, §4.4, §4.5, §5.3): multipliers and why. */
export interface Site {
    /** Production (rich deposit, fisheries in the bay). */
    output: number;
    trade: number;
    visitors: number;
    power: number;
    attraction: number;
    /** «Богатое месторождение ×1,5», for the inspector. */
    labels: string[];
}

const times = (value: number) => `×${String(value).replace('.', ',')}`;

/**
 * The multipliers a building gets from where it stands: an extractor on a
 * rich deposit, the port and the first fisheries in the deep bay
 * (`firstInBay`: this fishery is one of the first there), buildings on a
 * cape's beach, solar farms on the sunny slope.
 */
export function siteOf(
    def: BuildingDef,
    rect: Rect,
    layout: MapLayout,
    map: MapDef,
    firstInBay = false,
): Site {
    const site: Site = {
        output: 1,
        trade: 1,
        visitors: 1,
        power: 1,
        attraction: 1,
        labels: [],
    };
    const { bay, cape, sunny } = map.features;
    const spot = def.placement.deposit ? depositAt(map, rect) : undefined;

    if (spot?.rich && spot.kind === def.placement.deposit) {
        site.output *= map.richMult;
        site.labels.push(`Богатое месторождение ${times(map.richMult)}`);
    }

    if (inSpan(rect, bay)) {
        if (def.id === SITE_TYPES.port) {
            site.trade *= bay.trade;
            site.visitors *= bay.visitors;
            site.labels.push(
                `Глубокая бухта: торговля ${times(bay.trade)}, гости ${times(bay.visitors)}`,
            );
        } else if (def.id === SITE_TYPES.fishery && firstInBay) {
            site.output *= bay.fishery;
            site.labels.push(`Глубокая бухта ${times(bay.fishery)}`);
        }
    }

    if (
        rect.y + rect.h - 1 >= layout.beachY &&
        cape.some((span) => inSpan(rect, span))
    ) {
        site.attraction *= map.features.capeAttraction;
        site.labels.push(
            `Пляж у маяка: притяжение ${times(map.features.capeAttraction)}`,
        );
    }

    if (def.id === SITE_TYPES.solar && inSpan(rect, sunny)) {
        site.power *= sunny.solar;
        site.labels.push(`Солнечный склон ${times(sunny.solar)}`);
    }

    return site;
}
