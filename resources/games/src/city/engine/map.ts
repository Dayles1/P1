/**
 * The land the city is built on: a square of tiles with grass, forests,
 * rocks and a lake, generated from a seed so a save only has to store the
 * seed and which tiles the player cleared.
 */

import type { Terrain } from './data';

export const MAP_SIZE = 48;
export const CENTER = MAP_SIZE / 2 - 1;

export const GRASS = 0;
export const FOREST = 1;
export const ROCK = 2;
export const WATER = 3;

export const TERRAIN_CODE: Record<Terrain, number> = {
    forest: FOREST,
    rock: ROCK,
    water: WATER,
};

export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;

    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** A stable pseudo-random number in [0, 1) for a tile — for looks only. */
export function tileHash(x: number, y: number, salt = 0): number {
    let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);

    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(
    random: () => number,
    cell: number,
): (x: number, y: number) => number {
    const size = Math.ceil(MAP_SIZE / cell) + 2;
    const grid = Array.from({ length: size * size }, () => random());
    const at = (gx: number, gy: number) => grid[gy * size + gx];
    const smooth = (t: number) => t * t * (3 - 2 * t);

    return (x, y) => {
        const fx = x / cell;
        const fy = y / cell;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = smooth(fx - x0);
        const ty = smooth(fy - y0);
        const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
        const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;

        return top * (1 - ty) + bottom * ty;
    };
}

export function generateTerrain(seed: number): Uint8Array {
    const random = mulberry32(seed);
    const forestNoise = valueNoise(random, 6);
    const rockNoise = valueNoise(random, 4);
    const lakeNoise = valueNoise(random, 3);
    const terrain = new Uint8Array(MAP_SIZE * MAP_SIZE);

    const lake = { x: 37, y: 11 };
    const forestPatch = { x: CENTER - 6, y: CENTER + 4 };
    const rockPatch = { x: CENTER + 5, y: CENTER - 5 };

    for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < MAP_SIZE; x++) {
            const fromCenter = Math.max(
                Math.abs(x - CENTER - 0.5),
                Math.abs(y - CENTER - 0.5),
            );
            const edge = Math.min(x, y, MAP_SIZE - 1 - x, MAP_SIZE - 1 - y);
            let tile = GRASS;

            if (
                Math.hypot(x - lake.x, y - lake.y) <
                5 + lakeNoise(x, y) * 2.2
            ) {
                tile = WATER;
            } else if (fromCenter > 3) {
                const forest = forestNoise(x, y) + (edge < 3 ? 0.25 : 0);

                if (
                    forest > 0.63 ||
                    Math.hypot(x - forestPatch.x, y - forestPatch.y) < 2.3
                ) {
                    tile = FOREST;
                } else if (
                    rockNoise(x, y) > 0.76 ||
                    Math.hypot(x - rockPatch.x, y - rockPatch.y) < 1.6
                ) {
                    tile = ROCK;
                }
            }

            terrain[y * MAP_SIZE + x] = tile;
        }
    }

    return terrain;
}

export function inMap(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE;
}
