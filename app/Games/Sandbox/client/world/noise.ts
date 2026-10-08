/**
 * Deterministic noise: the same seed always grows the same world, so the
 * terrain is never stored — only computed.
 */

function hash(x: number, z: number, seed: number): number {
    let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;

    return (h >>> 0) / 4294967295;
}

function smooth(t: number): number {
    return t * t * (3 - 2 * t);
}

/** Smooth value noise in [-1, 1]. */
export function valueNoise(x: number, z: number, seed: number): number {
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const u = smooth(x - xi);
    const v = smooth(z - zi);
    const a = hash(xi, zi, seed);
    const b = hash(xi + 1, zi, seed);
    const c = hash(xi, zi + 1, seed);
    const d = hash(xi + 1, zi + 1, seed);
    const top = a + (b - a) * u;
    const bottom = c + (d - c) * u;

    return (top + (bottom - top) * v) * 2 - 1;
}

/** Fractal sum of value noise: big shapes with smaller detail on top. */
export function fbm(x: number, z: number, seed: number, octaves: number) {
    let sum = 0;
    let amplitude = 0.5;
    let frequency = 1;

    for (let octave = 0; octave < octaves; octave++) {
        sum +=
            valueNoise(x * frequency, z * frequency, seed + octave * 101) *
            amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }

    return sum;
}

/** Seeded random numbers in [0, 1) (mulberry32). */
export function createRandom(seed: number): () => number {
    let state = seed >>> 0;

    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));

    return t * t * (3 - 2 * t);
}
