/** Smooth value noise with octaves — the raw material of the map generator. */

import type { Rng } from './random';

export type Noise2 = (x: number, y: number) => number;

function valueNoise(rng: Rng, cell: number, size: number): Noise2 {
    const n = Math.ceil(size / cell) + 3;
    const grid = Float32Array.from({ length: n * n }, () => rng());
    const at = (gx: number, gy: number) => grid[gy * n + gx];
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

/** Octave noise in [0, 1]: each octave half the cell size and half the weight. */
export function fractalNoise(
    rng: Rng,
    scale: number,
    octaves: number,
    size: number,
): Noise2 {
    const layers = Array.from({ length: Math.max(1, octaves) }, (_, i) =>
        valueNoise(rng, Math.max(1, scale / 2 ** i), size),
    );
    const total = layers.reduce((sum, _, i) => sum + 0.5 ** i, 0);

    return (x, y) =>
        layers.reduce((sum, layer, i) => sum + layer(x, y) * 0.5 ** i, 0) /
        total;
}
