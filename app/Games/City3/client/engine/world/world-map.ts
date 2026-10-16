/**
 * The map: a grid of tiles, each with coordinates, a biome and an
 * elevation, plus which building stands on it. Stored as typed arrays for
 * speed. The tiles themselves never change (the map is the same fixed
 * layout for everyone, see layout.ts); they still travel to the server in
 * its tile row format until saving is reworked.
 */

import type { Content } from '../content/registry';
import type { BiomeDef } from '../content/types';

/**
 * Open water — the sea, deep or shallow. Elevation is 0..1. Anything else
 * that is not walkable stands high instead.
 */
export function isWaterBiome(biome: BiomeDef, elevation: number): boolean {
    return Boolean(biome.water) || (!biome.walkable && elevation < 0.45);
}

export interface Tile {
    x: number;
    y: number;
    biome: BiomeDef;
    elevation: number;
    occupant: number;
}

/**
 * One tile as the server stores it: [x, y, biome id, elevation 0..255,
 * feature]. There are no features any more; the last value is always null.
 */
export type TileRow = [number, number, string, number, null];

export class WorldMap {
    readonly width: number;
    readonly height: number;
    readonly biome: Uint8Array;
    readonly elevation: Uint8Array;
    readonly occupant: Int32Array;
    /** Tiles changed since the last save (none change at the moment). */
    readonly dirty = new Set<number>();

    constructor(
        private content: Content,
        width: number,
        height: number,
    ) {
        this.width = width;
        this.height = height;
        this.biome = new Uint8Array(width * height);
        this.elevation = new Uint8Array(width * height);
        this.occupant = new Int32Array(width * height);
    }

    index(x: number, y: number): number {
        return y * this.width + x;
    }

    inBounds(x: number, y: number): boolean {
        return x >= 0 && y >= 0 && x < this.width && y < this.height;
    }

    biomeAt(x: number, y: number): BiomeDef {
        return this.content.biomes[this.biome[this.index(x, y)]];
    }

    biomeOfIndex(index: number): BiomeDef {
        return this.content.biomes[this.biome[index]];
    }

    occupantAt(x: number, y: number): number {
        return this.inBounds(x, y) ? this.occupant[this.index(x, y)] : 0;
    }

    tile(x: number, y: number): Tile | null {
        if (!this.inBounds(x, y)) {
            return null;
        }

        const index = this.index(x, y);

        return {
            x,
            y,
            biome: this.content.biomes[this.biome[index]],
            elevation: this.elevation[index] / 255,
            occupant: this.occupant[index],
        };
    }

    isWater(x: number, y: number): boolean {
        return (
            this.inBounds(x, y) &&
            Boolean(this.biomeAt(x, y).water || !this.biomeAt(x, y).walkable)
        );
    }

    /** Open water a bridge can span. */
    isOpenWater(x: number, y: number): boolean {
        return (
            this.inBounds(x, y) &&
            isWaterBiome(
                this.biomeAt(x, y),
                this.elevation[this.index(x, y)] / 255,
            )
        );
    }

    toRows(indices?: Iterable<number>): TileRow[] {
        const rows: TileRow[] = [];
        const list =
            indices ??
            Array.from({ length: this.width * this.height }, (_, i) => i);

        for (const index of list) {
            rows.push([
                index % this.width,
                Math.floor(index / this.width),
                this.content.biomes[this.biome[index]].id,
                this.elevation[index],
                null,
            ]);
        }

        return rows;
    }
}
