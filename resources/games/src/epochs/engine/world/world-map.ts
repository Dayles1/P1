/**
 * The map: a grid of tiles, each with coordinates, a biome, an elevation
 * and an optional feature (tree, rock, reeds), plus which building stands
 * on it. Stored as typed arrays for speed; tiles the player changes are
 * tracked so only they are sent to the server.
 */

import type { Content } from '../content/registry';
import type { BiomeDef, FeatureId } from '../content/types';

export const FEATURES: (FeatureId | null)[] = [null, 'tree', 'rock', 'reeds'];

export function featureCode(feature: FeatureId | null): number {
    return Math.max(0, FEATURES.indexOf(feature));
}

export interface Tile {
    x: number;
    y: number;
    biome: BiomeDef;
    elevation: number;
    feature: FeatureId | null;
    occupant: number;
}

/** One tile as stored on the server: [x, y, biome id, elevation 0..255, feature]. */
export type TileRow = [number, number, string, number, FeatureId | null];

export class WorldMap {
    readonly width: number;
    readonly height: number;
    readonly biome: Uint8Array;
    readonly elevation: Uint8Array;
    readonly feature: Uint8Array;
    readonly occupant: Int32Array;
    /** Tiles changed since the last save. */
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
        this.feature = new Uint8Array(width * height);
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

    featureAt(x: number, y: number): FeatureId | null {
        return this.inBounds(x, y)
            ? FEATURES[this.feature[this.index(x, y)]]
            : null;
    }

    setFeature(x: number, y: number, feature: FeatureId | null): void {
        const index = this.index(x, y);

        this.feature[index] = featureCode(feature);
        this.dirty.add(index);
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
            feature: FEATURES[this.feature[index]],
            occupant: this.occupant[index],
        };
    }

    isWater(x: number, y: number): boolean {
        return (
            this.inBounds(x, y) &&
            Boolean(this.biomeAt(x, y).water || !this.biomeAt(x, y).walkable)
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
                FEATURES[this.feature[index]],
            ]);
        }

        return rows;
    }

    static fromRows(
        content: Content,
        width: number,
        height: number,
        rows: TileRow[],
    ): WorldMap {
        const map = new WorldMap(content, width, height);

        for (const [x, y, biome, elevation, feature] of rows) {
            if (!map.inBounds(x, y)) {
                continue;
            }

            const index = map.index(x, y);

            map.biome[index] = content.biomeIndexOf(biome);
            map.elevation[index] = elevation;
            map.feature[index] = featureCode(feature);
        }

        return map;
    }
}
