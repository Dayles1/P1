/**
 * Where each kind of land is. The world is laid out by two broad
 * gradients bent by noise — warm to the south (+Z) and cold to the north,
 * wet to the east (+X), dry and mountainous to the west — so every biome is within a walk of the spawn,
 * which itself always sits in a meadow. Mountains rise wherever the peak
 * noise is high.
 *
 * - meadow: grass, bushes, a few trees, ponds
 * - forest: dense woods, mushrooms, berries
 * - desert: sand dunes, cacti, flint, no water
 * - snow: white plains, fir trees
 * - mountains: a range in the dry west plus lone peaks — rock, iron
 *   ore, snowy tops
 *
 * Qing Mao Mountain (qingmao.ts) is wooded up its slopes and bare only
 * at the top; the wild peaks and ranges give way to it.
 */

import { fbm, smoothstep } from './noise';
import { mountainShare } from './qingmao';

export type Biome = 'meadow' | 'forest' | 'desert' | 'snow' | 'mountains';

export interface BiomeWeights {
    meadow: number;
    forest: number;
    desert: number;
    snow: number;
    mountains: number;
}

const SEED = 7331;

/** 0 at the spawn, 1 far from it: biomes start a little way out. */
function awayFromSpawn(x: number, z: number): number {
    return smoothstep(30, 120, Math.hypot(x, z));
}

/** Raw peak strength (0…~0.6); the terrain turns it into height. */
export function peaksAt(x: number, z: number): number {
    return Math.max(0, fbm(x / 140, z / 140, 1337 + 13, 3) - 0.12);
}

export function biomeWeights(x: number, z: number): BiomeWeights {
    const away = awayFromSpawn(x, z);
    const temperature = (z / 230 + fbm(x / 110, z / 110, SEED, 3) * 0.8) * away;
    const moisture =
        (x / 200 + fbm(x / 110 + 40, z / 110 - 17, SEED + 5, 3) * 0.8) * away;

    const qingMao = mountainShare(x, z);
    const slopes = smoothstep(0.05, 0.3, qingMao);
    const desert = smoothstep(0.38, 0.62, temperature) * (1 - slopes);
    const snow = smoothstep(0.38, 0.62, -temperature) * (1 - slopes);
    const forest = Math.max(
        smoothstep(0.2, 0.45, moisture) * (1 - desert) * (1 - snow * 0.6),
        slopes * 0.85,
    );
    // A range in the dry west, and lone peaks anywhere; Qing Mao's top.
    const highlands = smoothstep(0.3, 0.55, -moisture) * (1 - desert);
    const mountains = Math.max(
        Math.max(highlands, smoothstep(0.08, 0.2, peaksAt(x, z))) *
            (1 - slopes),
        smoothstep(0.72, 0.9, qingMao),
    );
    const meadow = Math.max(0, 1 - desert - snow - forest);

    return { meadow, forest, desert, snow, mountains };
}

export function dominantBiome(weights: BiomeWeights): Biome {
    if (weights.mountains > 0.55) {
        return 'mountains';
    }

    let best: Biome = 'meadow';

    for (const biome of ['forest', 'desert', 'snow'] as const) {
        if (weights[biome] > weights[best]) {
            best = biome;
        }
    }

    return best;
}

export function biomeAt(x: number, z: number): Biome {
    return dominantBiome(biomeWeights(x, z));
}
