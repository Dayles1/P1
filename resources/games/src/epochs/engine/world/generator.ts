/**
 * Builds a new map from biomes.json: elevation, moisture and temperature
 * noise, lakes and a river carved in, a clear meadow around the centre,
 * then biomes by the first matching rule and features by chance.
 */

import type { Content } from '../content/registry';
import type { BiomeDef } from '../content/types';
import { fractalNoise } from '../core/noise';
import { between, mulberry32 } from '../core/random';
import { WorldMap, featureCode } from './world-map';

function matches(
    biome: BiomeDef,
    values: { elevation: number; moisture: number; temperature: number },
): boolean {
    return (
        Object.entries(biome.when ?? {}) as [
            keyof typeof values,
            [number, number],
        ][]
    ).every(([key, [min, max]]) => values[key] >= min && values[key] <= max);
}

export function generateMap(content: Content, seed: number): WorldMap {
    const { width, height } = content.world.map;
    const config = content.bundle.biomes.generator;
    const rng = mulberry32(seed);
    const size = Math.max(width, height);
    const elevationNoise = fractalNoise(
        rng,
        config.elevationScale,
        config.octaves,
        size,
    );
    const moistureNoise = fractalNoise(
        rng,
        config.moistureScale,
        config.octaves,
        size,
    );
    const temperatureNoise = fractalNoise(
        rng,
        config.temperatureScale,
        2,
        size,
    );
    const cx = width / 2;
    const cy = height / 2;

    const elevation = new Float32Array(width * height);
    const moisture = new Float32Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            const edge =
                Math.min(x, y, width - 1 - x, height - 1 - y) / (size * 0.12);

            elevation[i] =
                elevationNoise(x, y) * 0.75 +
                0.25 -
                config.edgeFalloff * Math.max(0, 1 - edge) * 0.6;
            moisture[i] = moistureNoise(x, y);
        }
    }

    const carve = (x: number, y: number, value: number) => {
        if (
            x >= 0 &&
            y >= 0 &&
            x < width &&
            y < height &&
            Math.hypot(x - cx, y - cy) > config.clearRadius + 3
        ) {
            const i = y * width + x;

            elevation[i] = Math.min(elevation[i], value);
            moisture[i] = Math.max(moisture[i], 0.7);
        }
    };

    // Lakes, away from the centre.
    for (let lake = 0; lake < config.lake.count; lake++) {
        const angle = rng() * Math.PI * 2;
        const distance = size * (0.22 + rng() * 0.15);
        const lx = cx + Math.cos(angle) * distance;
        const ly = cy + Math.sin(angle) * distance;
        const radius = between(rng, config.lake.radius);

        for (let y = Math.floor(ly - radius - 2); y <= ly + radius + 2; y++) {
            for (
                let x = Math.floor(lx - radius - 2);
                x <= lx + radius + 2;
                x++
            ) {
                const d =
                    Math.hypot(x - lx, y - ly) / radius +
                    (moistureNoise(x * 3, y * 3) - 0.5) * 0.5;

                if (d < 0.7) {
                    carve(x, y, 0.18);
                } else if (d < 1) {
                    carve(x, y, 0.28);
                }
            }
        }
    }

    // Rivers: a wandering line from one edge to the opposite one.
    for (let river = 0; river < config.river.count; river++) {
        const vertical = rng() > 0.5;
        let along = 0;
        let across =
            (vertical ? width : height) *
            (rng() > 0.5 ? 0.22 + rng() * 0.12 : 0.66 + rng() * 0.12);

        while (along < (vertical ? height : width)) {
            for (let w = -config.river.width; w <= config.river.width; w++) {
                const x = Math.round(vertical ? across + w : along);
                const y = Math.round(vertical ? along : across + w);

                carve(x, y, w === 0 ? 0.26 : 0.3);
            }

            along += 1;
            across += (rng() - 0.5) * 1.6;
        }
    }

    const map = new WorldMap(content, width, height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            const fromCenter = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
            let e = elevation[i];
            let m = moisture[i];

            if (fromCenter < config.clearRadius) {
                e = Math.max(0.42, Math.min(0.62, e));
                m = Math.min(0.5, m);
            }

            const values = {
                elevation: Math.max(0, Math.min(1, e)),
                moisture: m,
                temperature: temperatureNoise(x, y),
            };
            const biomeIndex = Math.max(
                0,
                content.biomes.findIndex((biome) => matches(biome, values)),
            );
            const biome = content.biomes[biomeIndex];

            map.biome[i] = biomeIndex;
            map.elevation[i] = Math.round(values.elevation * 255);

            if (fromCenter >= config.clearRadius) {
                for (const [feature, chance] of Object.entries(
                    biome.features,
                )) {
                    if (rng() < (chance ?? 0)) {
                        map.feature[i] = featureCode(feature as never);
                        break;
                    }
                }
            }
        }
    }

    ensureStartingResources(map, rng, cx, cy, config.clearRadius);

    return map;
}

/** The first era needs wood and stone within reach of the centre. */
function ensureStartingResources(
    map: WorldMap,
    rng: () => number,
    cx: number,
    cy: number,
    clear: number,
): void {
    const near = (feature: number) => {
        let count = 0;

        for (let y = Math.floor(cy - 9); y < cy + 9; y++) {
            for (let x = Math.floor(cx - 9); x < cx + 9; x++) {
                count +=
                    map.inBounds(x, y) &&
                    map.feature[map.index(x, y)] === feature
                        ? 1
                        : 0;
            }
        }

        return count;
    };

    const patch = (feature: number, radius: number) => {
        const angle = rng() * Math.PI * 2;
        const px = cx + Math.cos(angle) * (clear + 3);
        const py = cy + Math.sin(angle) * (clear + 3);

        for (let y = Math.floor(py - radius); y <= py + radius; y++) {
            for (let x = Math.floor(px - radius); x <= px + radius; x++) {
                if (
                    map.inBounds(x, y) &&
                    Math.hypot(x - px, y - py) <= radius &&
                    map.biomeAt(x, y).buildable &&
                    !map.biomeAt(x, y).water
                ) {
                    map.feature[map.index(x, y)] = feature;
                }
            }
        }
    };

    if (near(featureCode('tree')) < 10) {
        patch(featureCode('tree'), 2.4);
    }

    if (near(featureCode('rock')) < 4) {
        patch(featureCode('rock'), 1.5);
    }
}
