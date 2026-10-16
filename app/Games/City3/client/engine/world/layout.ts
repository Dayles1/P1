/**
 * The one map everyone plays on, built from world.json's map layout — no
 * seed, no noise, the same tiles every time. From north to south: the land
 * rows (row 0 touches the mountain range outside the map), the beach, then
 * a few rows of shallow sea. The ground is flat; only the beach's last rows
 * slope down into the water and the sea floor drops away beyond, and the
 * same profile goes on off the map so the world never ends at an edge.
 */

import type { Content } from '../content/registry';
import { WorldMap } from './world-map';

export type Band = 'land' | 'beach' | 'sea';

export interface MapLayout {
    width: number;
    /** Rows in all: land + beach + sea. */
    height: number;
    landRows: number;
    beachRows: number;
    seaRows: number;
    /** The first beach row and the first sea row (= where the shore is). */
    beachY: number;
    seaY: number;
}

/** Over how many rows the beach slopes into the water. */
export const SHORE_ROWS = 3;
/** Ground height at the shore line (just under the water surface at −0.1). */
export const SHORE_HEIGHT = -0.13;
const SEA_FLOOR = -2.5;

/** Tile elevations (0..255) as the server stores them, per band. */
const ELEVATION: Record<Band, number> = { land: 140, beach: 110, sea: 50 };

export function mapLayout(content: Content): MapLayout {
    const { width, landRows, beachRows, seaRows } = content.world.map;

    return {
        width,
        height: landRows + beachRows + seaRows,
        landRows,
        beachRows,
        seaRows,
        beachY: landRows,
        seaY: landRows + beachRows,
    };
}

/** The band of a row; rows past the map's south edge are open sea. */
export function bandAt(layout: MapLayout, y: number): Band {
    return y < layout.beachY ? 'land' : y < layout.seaY ? 'beach' : 'sea';
}

/**
 * Natural ground height (world Y) at a distance y (in tiles, from the north
 * edge) — the same for every column, on the map and off it.
 */
export function groundHeight(layout: MapLayout, y: number): number {
    const slopeStart = layout.seaY - SHORE_ROWS;

    if (y <= slopeStart) {
        return 0;
    }

    if (y <= layout.seaY) {
        const t = (y - slopeStart) / SHORE_ROWS;

        return SHORE_HEIGHT * t * t;
    }

    const d = y - layout.seaY;

    return Math.max(
        SEA_FLOOR,
        SHORE_HEIGHT - 0.5 * (1 - Math.exp(-d / 1.5)) - 0.02 * d,
    );
}

/** Builds the fixed map. */
export function buildMap(content: Content): WorldMap {
    const layout = mapLayout(content);
    const biomes = content.world.map.biomes;
    const map = new WorldMap(content, layout.width, layout.height);

    for (let y = 0; y < layout.height; y++) {
        const band = bandAt(layout, y);
        const biome = content.biomeIndexOf(biomes[band]);

        for (let x = 0; x < layout.width; x++) {
            const index = map.index(x, y);

            map.biome[index] = biome;
            map.elevation[index] = ELEVATION[band];
        }
    }

    return map;
}
