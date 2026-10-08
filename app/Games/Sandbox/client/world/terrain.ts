/**
 * The ground: a smooth height field — Minecraft-like open land, but no
 * cubes. The height is a pure function of (x, z); physics reads it
 * directly and the mesh is only its picture. Its shape and colour follow
 * the biomes (biomes.ts): dunes in the desert, ponds and lakes where it
 * is wetter, rock and snow up high. Anything below WATER_LEVEL is under
 * water.
 *
 * World coordinates: 1 unit = 1 metre, Y is up, the world spans
 * [-WORLD_HALF, WORLD_HALF] on X and Z, the spawn is at the origin.
 */

import * as THREE from 'three';
import { biomeWeights, peaksAt } from './biomes';
import { fbm, smoothstep, valueNoise } from './noise';

export const WORLD_HALF = 256;

/** A flat clearing around the spawn point. */
export const SPAWN_RADIUS = 16;

export const WATER_LEVEL = -2.5;

const SEED = 1337;

export function heightAt(x: number, z: number): number {
    const biome = biomeWeights(x, z);
    const flatten = 1 - 0.7 * biome.desert;

    // Hills lean upward so the land is mostly dry; lakes cut into it.
    const hills = (fbm(x / 90, z / 90, SEED, 4) + 0.12) * 16;
    const detail = fbm(x / 17, z / 17, SEED + 7, 3) * 1.4;
    const peaks = peaksAt(x, z);
    const ridge = Math.max(
        0,
        1 - Math.abs(fbm(x / 70, z / 70, SEED + 51, 4)) * 2.4,
    );
    const mountains =
        peaks * peaks * 220 + biome.mountains * (5 + ridge * ridge * 40);

    // Dunes: long ridges, bent a little by noise.
    const bend = fbm(x / 60, z / 60, SEED + 29, 2) * 2;
    const dunes =
        (1 - Math.abs(valueNoise(x / 34 + bend, z / 14, SEED + 31))) * 3.2;

    // Lakes sink into the wetter, flatter land.
    const lakes =
        Math.max(0, fbm(x / 70, z / 70, SEED + 41, 3) - 0.16) *
        26 *
        (1 - biome.desert) *
        (1 - biome.mountains);

    const clearing = smoothstep(
        SPAWN_RADIUS,
        SPAWN_RADIUS * 3,
        Math.hypot(x, z),
    );
    const edge = Math.max(Math.abs(x), Math.abs(z));
    const rim = smoothstep(WORLD_HALF - 70, WORLD_HALF - 4, edge);
    const land =
        (hills + detail) * flatten + dunes * biome.desert + mountains - lakes;

    return land * clearing + rim * rim * 70;
}

/** The surface normal at (x, z), written into `out`. */
export function normalAt(
    x: number,
    z: number,
    out: THREE.Vector3,
): THREE.Vector3 {
    const e = 0.2;
    const dx = heightAt(x + e, z) - heightAt(x - e, z);
    const dz = heightAt(x, z + e) - heightAt(x, z - e);

    return out.set(-dx, 2 * e, -dz).normalize();
}

const GRASS = new THREE.Color(0xa9c08f);
const FOREST = new THREE.Color(0x8aa276);
const SAND = new THREE.Color(0xe0cc98);
const SNOW = new THREE.Color(0xeef1f3);
const STONE = new THREE.Color(0xa5a39e);
const SHORE = new THREE.Color(0xd8c9a0);
const LAKE_BED = new THREE.Color(0x8f9184);

/** The ground's colour at a point of the given height and steepness (0…1). */
function groundColor(
    x: number,
    z: number,
    y: number,
    steep: number,
    out: THREE.Color,
): THREE.Color {
    const biome = biomeWeights(x, z);
    const total = biome.meadow + biome.forest + biome.desert + biome.snow || 1;

    out.setRGB(0, 0, 0);
    out.r =
        (GRASS.r * biome.meadow +
            FOREST.r * biome.forest +
            SAND.r * biome.desert +
            SNOW.r * biome.snow) /
        total;
    out.g =
        (GRASS.g * biome.meadow +
            FOREST.g * biome.forest +
            SAND.g * biome.desert +
            SNOW.g * biome.snow) /
        total;
    out.b =
        (GRASS.b * biome.meadow +
            FOREST.b * biome.forest +
            SAND.b * biome.desert +
            SNOW.b * biome.snow) /
        total;

    out.lerp(
        STONE,
        Math.max(steep, smoothstep(18, 32, y), biome.mountains * 0.6),
    );
    out.lerp(SNOW, smoothstep(40, 55, y));
    out.lerp(
        SHORE,
        (1 - biome.snow) * smoothstep(WATER_LEVEL + 1.2, WATER_LEVEL + 0.2, y),
    );
    out.lerp(LAKE_BED, smoothstep(WATER_LEVEL - 0.2, WATER_LEVEL - 1.5, y));

    // Patches of lighter and darker ground, so it does not look painted.
    const patch =
        valueNoise(x / 9, z / 9, SEED + 71) * 0.06 +
        valueNoise(x / 2.5, z / 2.5, SEED + 73) * 0.025;

    return out.multiplyScalar(1 + patch);
}

export function createTerrainMesh(segments = 384): THREE.Mesh {
    const size = WORLD_HALF * 2;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position as THREE.BufferAttribute;
    const side = segments + 1;
    const step = size / segments;
    const heights = new Float32Array(positions.count);

    for (let i = 0; i < positions.count; i++) {
        heights[i] = heightAt(positions.getX(i), positions.getZ(i));
        positions.setY(i, heights[i]);
    }

    const colors = new Float32Array(positions.count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < positions.count; i++) {
        const column = i % side;
        const row = Math.floor(i / side);
        const left = heights[row * side + Math.max(0, column - 1)];
        const right = heights[row * side + Math.min(side - 1, column + 1)];
        const up = heights[Math.max(0, row - 1) * side + column];
        const down = heights[Math.min(side - 1, row + 1) * side + column];
        const normalY =
            1 /
            Math.hypot(
                (right - left) / (2 * step),
                (down - up) / (2 * step),
                1,
            );

        groundColor(
            positions.getX(i),
            positions.getZ(i),
            heights[i],
            smoothstep(0.85, 0.65, normalY),
            color,
        ).toArray(colors, i * 3);
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
    );
    mesh.receiveShadow = true;

    return mesh;
}
