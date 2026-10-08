/**
 * The ground: a smooth height field — Minecraft-like open land, but no
 * cubes. The height is a pure function of (x, z); physics reads it
 * directly and the chunks (Terrain, below) are only its picture. Its shape and colour follow
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

/** Side of a terrain chunk, metres. */
export const CHUNK = 32;
const CHUNKS = (WORLD_HALF * 2) / CHUNK;

/** How finely a chunk is cut at a distance: full detail near, half, a quarter. */
const DETAIL_RINGS = [56, 120];
/** A chunk keeps its finer detail this far past a ring, so it does not flicker. */
const HYSTERESIS = 12;

interface Chunk {
    key: number;
    segments: number;
    mesh: THREE.Mesh;
}

/**
 * Builds one chunk: a grid of `segments`² squares with normals from the
 * height samples around it (so neighbours light alike) and a skirt hanging
 * down along each edge, which hides the cracks where a finer chunk meets a
 * coarser one.
 */
function buildChunk(
    cx: number,
    cz: number,
    segments: number,
    material: THREE.Material,
): THREE.Mesh {
    const step = CHUNK / segments;
    const x0 = -WORLD_HALF + cx * CHUNK;
    const z0 = -WORLD_HALF + cz * CHUNK;
    const side = segments + 3;
    const heights = new Float32Array(side * side);

    for (let j = 0; j < side; j++) {
        for (let i = 0; i < side; i++) {
            heights[j * side + i] = heightAt(
                x0 + (i - 1) * step,
                z0 + (j - 1) * step,
            );
        }
    }

    const row = segments + 1;
    const inner = row * row;
    const total = inner + row * 4;
    const positions = new Float32Array(total * 3);
    const normals = new Float32Array(total * 3);
    const colors = new Float32Array(total * 3);
    const normal = new THREE.Vector3();
    const color = new THREE.Color();

    for (let j = 0; j <= segments; j++) {
        for (let i = 0; i <= segments; i++) {
            const at = (j + 1) * side + (i + 1);
            const vertex = j * row + i;
            const x = x0 + i * step;
            const z = z0 + j * step;
            const y = heights[at];
            normal
                .set(
                    heights[at - 1] - heights[at + 1],
                    2 * step,
                    heights[at - side] - heights[at + side],
                )
                .normalize();
            positions.set([x, y, z], vertex * 3);
            normals.set([normal.x, normal.y, normal.z], vertex * 3);
            groundColor(
                x,
                z,
                y,
                smoothstep(0.85, 0.65, normal.y),
                color,
            ).toArray(colors, vertex * 3);
        }
    }

    const indices: number[] = [];

    for (let j = 0; j < segments; j++) {
        for (let i = 0; i < segments; i++) {
            const a = j * row + i;
            const b = a + 1;
            const c = a + row;
            const d = c + 1;
            indices.push(a, c, b, b, c, d);
        }
    }

    // Skirts: each edge's vertices copied a little way down, joined both ways round.
    const depth = 1.5 + step * 1.5;
    const edges = [
        Array.from({ length: row }, (_, i) => i),
        Array.from({ length: row }, (_, i) => segments * row + i),
        Array.from({ length: row }, (_, j) => j * row),
        Array.from({ length: row }, (_, j) => j * row + segments),
    ];

    edges.forEach((edge, number) => {
        const start = inner + number * row;

        edge.forEach((vertex, k) => {
            const copy = start + k;
            positions[copy * 3] = positions[vertex * 3];
            positions[copy * 3 + 1] = positions[vertex * 3 + 1] - depth;
            positions[copy * 3 + 2] = positions[vertex * 3 + 2];
            normals.copyWithin(copy * 3, vertex * 3, vertex * 3 + 3);
            colors.copyWithin(copy * 3, vertex * 3, vertex * 3 + 3);

            if (k > 0) {
                const top = edge[k - 1];
                indices.push(top, copy - 1, vertex, vertex, copy - 1, copy);
                indices.push(top, vertex, copy - 1, vertex, copy, copy - 1);
            }
        });
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;

    return mesh;
}

/**
 * The ground's picture, cut into chunks that are made as the player comes
 * near and thrown away behind them. Only chunks within the view distance
 * exist; near ones are finely cut, far ones coarsely, and the camera skips
 * the ones it does not look at. Building is spread over frames — a few
 * milliseconds' worth each frame, nearest first.
 */
export class Terrain {
    readonly group = new THREE.Group();
    /** How far the land is drawn, metres. */
    viewDistance = 200;

    private material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.95,
    });
    private chunks = new Map<number, Chunk>();

    /** `detail`: squares along a near chunk's side. */
    constructor(public detail = 24) {}

    /**
     * Brings the chunks around `center` up to date: drops far ones and
     * builds missing or wrongly detailed ones for up to `budget` ms.
     */
    update(center: THREE.Vector3, budget = 3): void {
        const reach = this.viewDistance + CHUNK;

        for (const chunk of [...this.chunks.values()]) {
            if (this.distance(chunk.key, center) > reach) {
                this.drop(chunk);
            }
        }

        const range = (value: number) => [
            Math.max(0, Math.floor((value - reach + WORLD_HALF) / CHUNK)),
            Math.min(
                CHUNKS - 1,
                Math.floor((value + reach + WORLD_HALF) / CHUNK),
            ),
        ];
        const [firstX, lastX] = range(center.x);
        const [firstZ, lastZ] = range(center.z);
        const wanted: [number, number, number][] = [];

        for (let cx = firstX; cx <= lastX; cx++) {
            for (let cz = firstZ; cz <= lastZ; cz++) {
                const key = cx * CHUNKS + cz;
                const distance = this.distance(key, center);

                if (distance > this.viewDistance) {
                    continue;
                }

                const chunk = this.chunks.get(key);
                const segments = this.segmentsAt(distance, chunk?.segments);

                if (chunk?.segments !== segments) {
                    wanted.push([distance, key, segments]);
                }
            }
        }

        wanted.sort((a, b) => a[0] - b[0]);
        const started = performance.now();

        for (const [, key, segments] of wanted) {
            const mesh = buildChunk(
                Math.floor(key / CHUNKS),
                key % CHUNKS,
                segments,
                this.material,
            );
            const old = this.chunks.get(key);

            if (old) {
                this.drop(old);
            }

            this.group.add(mesh);
            this.chunks.set(key, { key, segments, mesh });

            if (performance.now() - started > budget) {
                break;
            }
        }
    }

    /** From a point to the nearest spot of a chunk, on the ground. */
    private distance(key: number, center: THREE.Vector3): number {
        const minX = -WORLD_HALF + Math.floor(key / CHUNKS) * CHUNK;
        const minZ = -WORLD_HALF + (key % CHUNKS) * CHUNK;
        const dx = Math.max(minX - center.x, 0, center.x - (minX + CHUNK));
        const dz = Math.max(minZ - center.z, 0, center.z - (minZ + CHUNK));

        return Math.hypot(dx, dz);
    }

    private segmentsAt(distance: number, current?: number): number {
        const ring = (edge: number) => {
            const index = DETAIL_RINGS.findIndex(
                (each) => distance < each + edge,
            );

            return index < 0 ? DETAIL_RINGS.length : index;
        };
        const segments = Math.max(4, this.detail >> ring(0));

        // Keep a finer cut a little longer, so walking along a ring does not rebuild.
        if (current && current > segments) {
            const kept = Math.max(4, this.detail >> ring(HYSTERESIS));

            if (kept === current) {
                return current;
            }
        }

        return segments;
    }

    private drop(chunk: Chunk): void {
        this.group.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        this.chunks.delete(chunk.key);
    }
}
