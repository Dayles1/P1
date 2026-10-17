/**
 * The city's effect fields (gdd §4.7, §4.13): one grid per service
 * (water, health, education, leisure, data), the auras, the Town Hall's
 * aura, pollution, transit (metro stations), the data-centre tax bonus and
 * the district charters. Every working building stamps its effects as the
 * Manhattan diamond of each radius around its footprint (every tile whose
 * grid distance to the footprint is at most `r`).
 *
 * A structural change does not rebuild the fields: `sync` compares each
 * building's stamp with the one it left last time and re-stamps only the
 * buildings that were added, removed, moved, upgraded or switched on or
 * off. Pure data — no game, no content — so it is tested on its own.
 */

import type { ServiceId } from '../content/types';

export interface Footprint {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** What one working building puts on the fields. */
export interface GridSource extends Footprint {
    coverage: { service: ServiceId; radius: number } | null;
    aura: { radius: number; happiness: number } | null;
    /** The Town Hall's aura: a term of its own, not capped with the others. */
    centerAura: { radius: number; happiness: number } | null;
    pollution: { radius: number; amount: number } | null;
    /** Metro stations: the homes they serve and the appeal they add. */
    transit: { radius: number; happiness: number } | null;
    /** Data centres: percent onto the tax of the homes they reach. */
    dataTax: { radius: number; percent: number } | null;
    /** District charters (slice 7): a kind stamped over the charter radius. */
    charter: { kind: string; radius: number } | null;
}

export const GRID_SERVICES: ServiceId[] = [
    'water',
    'health',
    'education',
    'leisure',
    'data',
];

/** Calls `visit(index)` for every in-bounds tile within Manhattan `radius` of a footprint. */
export function forEachInDiamond(
    width: number,
    height: number,
    area: Footprint,
    radius: number,
    visit: (index: number) => void,
): void {
    const right = area.x + area.w - 1;
    const bottom = area.y + area.h - 1;
    const fromY = Math.max(0, area.y - radius);
    const toY = Math.min(height - 1, bottom + radius);

    for (let y = fromY; y <= toY; y++) {
        const dy = Math.max(0, area.y - y, y - bottom);
        const reach = radius - dy;
        const fromX = Math.max(0, area.x - reach);
        const toX = Math.min(width - 1, right + reach);

        for (let x = fromX; x <= toX; x++) {
            visit(y * width + x);
        }
    }
}

/** Grid distance between two footprints (0 when they touch or overlap). */
export function footprintDistance(a: Footprint, b: Footprint): number {
    const dx = Math.max(0, a.x - (b.x + b.w - 1), b.x - (a.x + a.w - 1));
    const dy = Math.max(0, a.y - (b.y + b.h - 1), b.y - (a.y + a.h - 1));

    return dx + dy;
}

export class Grids {
    readonly width: number;
    readonly height: number;
    /** How many sources of each service reach each tile. */
    readonly coverage: Record<ServiceId, Uint16Array>;
    /** Σ aura happiness reaching each tile (the Town Hall's apart). */
    readonly aura: Float64Array;
    readonly centerAura: Float64Array;
    readonly pollution: Float64Array;
    /** How many metro stations serve each tile, and Σ their appeal. */
    readonly transit: Uint16Array;
    readonly transitAppeal: Float64Array;
    readonly dataTax: Float64Array;
    /** Charter kind → how many charters of that kind reach each tile. */
    readonly charters = new Map<string, Uint16Array>();

    private readonly stamped = new Map<
        number,
        { key: string; source: GridSource }
    >();

    constructor(width: number, height: number) {
        const size = width * height;

        this.width = width;
        this.height = height;
        this.coverage = Object.fromEntries(
            GRID_SERVICES.map((service) => [service, new Uint16Array(size)]),
        ) as Record<ServiceId, Uint16Array>;
        this.aura = new Float64Array(size);
        this.centerAura = new Float64Array(size);
        this.pollution = new Float64Array(size);
        this.transit = new Uint16Array(size);
        this.transitAppeal = new Float64Array(size);
        this.dataTax = new Float64Array(size);
    }

    /**
     * Brings the fields up to date with the working buildings (uid →
     * source); returns how many buildings were stamped or unstamped.
     */
    sync(sources: Map<number, GridSource>): number {
        let changes = 0;

        for (const [uid, old] of this.stamped) {
            const next = sources.get(uid);

            if (!next || stampKey(next) !== old.key) {
                this.stamp(old.source, -1);
                this.stamped.delete(uid);
                changes++;
            }
        }

        for (const [uid, source] of sources) {
            if (!this.stamped.has(uid)) {
                this.stamp(source, 1);
                this.stamped.set(uid, { key: stampKey(source), source });
                changes++;
            }
        }

        return changes;
    }

    /** Whether a service reaches any tile of a footprint. */
    covers(service: ServiceId, area: Footprint): boolean {
        const grid = this.coverage[service];

        return this.someTile(area, (index) => grid[index] > 0);
    }

    /** Whether a metro station serves any tile of a footprint. */
    transitAt(area: Footprint): boolean {
        return this.someTile(area, (index) => this.transit[index] > 0);
    }

    /** Whether a charter of a kind reaches any tile of a footprint. */
    charterAt(kind: string, area: Footprint): boolean {
        const grid = this.charters.get(kind);

        return grid ? this.someTile(area, (index) => grid[index] > 0) : false;
    }

    /** The largest value of a field over a footprint's tiles. */
    maxOver(field: Float64Array, area: Footprint): number {
        let best = -Infinity;

        this.eachTile(area, (index) => {
            best = Math.max(best, field[index]);
        });

        return Number.isFinite(best) ? round(best) : 0;
    }

    private stamp(source: GridSource, sign: 1 | -1): void {
        const add = (field: Float64Array, radius: number, amount: number) =>
            this.diamond(source, radius, (index) => {
                field[index] += sign * amount;
            });
        const count = (grid: Uint16Array, radius: number) =>
            this.diamond(source, radius, (index) => {
                grid[index] += sign;
            });

        if (source.coverage) {
            count(
                this.coverage[source.coverage.service],
                source.coverage.radius,
            );
        }

        if (source.aura) {
            add(this.aura, source.aura.radius, source.aura.happiness);
        }

        if (source.centerAura) {
            add(
                this.centerAura,
                source.centerAura.radius,
                source.centerAura.happiness,
            );
        }

        if (source.pollution) {
            add(
                this.pollution,
                source.pollution.radius,
                source.pollution.amount,
            );
        }

        if (source.transit) {
            count(this.transit, source.transit.radius);
            add(
                this.transitAppeal,
                source.transit.radius,
                source.transit.happiness,
            );
        }

        if (source.dataTax) {
            add(this.dataTax, source.dataTax.radius, source.dataTax.percent);
        }

        if (source.charter) {
            let grid = this.charters.get(source.charter.kind);

            if (!grid) {
                grid = new Uint16Array(this.width * this.height);
                this.charters.set(source.charter.kind, grid);
            }

            count(grid, source.charter.radius);
        }
    }

    private diamond(
        area: Footprint,
        radius: number,
        visit: (index: number) => void,
    ): void {
        forEachInDiamond(this.width, this.height, area, radius, visit);
    }

    private eachTile(area: Footprint, visit: (index: number) => void): void {
        for (let y = Math.max(0, area.y); y < area.y + area.h; y++) {
            for (let x = Math.max(0, area.x); x < area.x + area.w; x++) {
                if (x < this.width && y < this.height) {
                    visit(y * this.width + x);
                }
            }
        }
    }

    private someTile(
        area: Footprint,
        test: (index: number) => boolean,
    ): boolean {
        for (let y = Math.max(0, area.y); y < area.y + area.h; y++) {
            for (let x = Math.max(0, area.x); x < area.x + area.w; x++) {
                if (
                    x < this.width &&
                    y < this.height &&
                    test(y * this.width + x)
                ) {
                    return true;
                }
            }
        }

        return false;
    }
}

function stampKey(source: GridSource): string {
    return JSON.stringify(source);
}

/** Sums of ± stamps drift by float noise; fields are read to 1e-6. */
function round(value: number): number {
    return Math.round(value * 1e6) / 1e6;
}
