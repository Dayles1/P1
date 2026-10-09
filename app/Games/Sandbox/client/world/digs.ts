/**
 * Excavations: low mounds of earth with a few old stones and a little
 * flag, scattered over the world — more of them in the desert and the
 * mountains. A shovel digs one out in a few strokes (a pickaxe does it
 * slowly; bare hands cannot). What turns up is mostly old notes and relic
 * shards — the stuff knowledge is made of — sometimes flint or iron, and
 * now and then an old, worn-out tool or weapon whose recipe can be learnt
 * by taking it apart.
 *
 * Like trees and rocks they come from a seeded list (their own stream,
 * so the rest of the world stays where it was), are remembered by id
 * ("dig:4") when dug out and fill up again after half an hour.
 */

import * as THREE from 'three';
import { ITEMS } from '../items';
import type { ItemId } from '../items';
import type { ColliderGrid } from '../physics/colliders';
import { biomeWeights, dominantBiome } from './biomes';
import type { Biome } from './biomes';
import type { Chips } from './effects';
import { createRandom } from './noise';
import { keptClear } from './qingmao';
import type { Harvested, Tool, Yield } from './resources';
import { heightAt, normalAt, WATER_LEVEL, WORLD_HALF } from './terrain';

const MAX_DIGS = 70;
const REGROW_MS = 30 * 60_000;
const HP = 4;

/** How likely each biome is to keep one, out of every try. */
const ODDS: Record<Biome, number> = {
    meadow: 0.25,
    forest: 0.2,
    desert: 0.9,
    snow: 0.45,
    mountains: 0.7,
};

/** [item, least, most, chance] when a dig is finished. */
const LOOT: [ItemId, number, number, number][] = [
    ['old_notes', 1, 2, 0.75],
    ['relic_shard', 1, 1, 0.45],
    ['flint', 1, 2, 0.35],
    ['iron', 1, 1, 0.2],
];

/** Old things that turn up now and then, worn nearly through. */
const RELICS: ItemId[] = [
    'iron_pickaxe',
    'iron_sword',
    'iron_helmet',
    'dagger',
    'war_hammer',
    'staff',
];
const RELIC_CHANCE = 0.12;

const EARTH = new THREE.MeshStandardMaterial({
    color: 0x8a6e52,
    roughness: 1,
    flatShading: true,
});
const OLD_STONE = new THREE.MeshStandardMaterial({
    color: 0xa39d90,
    roughness: 0.95,
    flatShading: true,
});
const POLE = new THREE.MeshStandardMaterial({
    color: 0x8c6a48,
    roughness: 0.9,
});
const FLAG = new THREE.MeshStandardMaterial({
    color: 0xc9534a,
    roughness: 0.9,
    side: THREE.DoubleSide,
});

export interface Dig {
    kind: 'dig';
    id: string;
    index: number;
    x: number;
    z: number;
    ground: number;
    hp: number;
    maxHp: number;
    dug: boolean;
    shake: number;
}

export interface DigResult {
    yields: Yield[];
    /** The blow did nothing: a shovel (or a pickaxe) is needed. */
    needs?: 'shovel';
    /** This blow finished it. */
    done: boolean;
}

export class Digs {
    readonly group = new THREE.Group();
    readonly list: Dig[] = [];
    private harvested = new Map<string, number>();
    private mounds: THREE.InstancedMesh;
    private stones: THREE.InstancedMesh;
    private poles: THREE.InstancedMesh;
    private flags: THREE.InstancedMesh;
    private looks: { yaw: number; size: number }[] = [];
    private matrix = new THREE.Matrix4();
    private quaternion = new THREE.Quaternion();
    private position = new THREE.Vector3();
    private scale = new THREE.Vector3();
    private up = new THREE.Vector3(0, 1, 0);
    private time = 0;

    constructor(
        colliders: ColliderGrid,
        private chips: Chips,
    ) {
        this.mounds = this.instanced(
            new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
            EARTH,
            MAX_DIGS,
        );
        this.stones = this.instanced(
            new THREE.DodecahedronGeometry(1, 0),
            OLD_STONE,
            MAX_DIGS * 3,
        );
        this.poles = this.instanced(
            new THREE.CylinderGeometry(0.025, 0.03, 1.3, 5).translate(
                0,
                0.65,
                0,
            ),
            POLE,
            MAX_DIGS,
        );
        this.flags = this.instanced(
            new THREE.PlaneGeometry(0.34, 0.22).translate(0.17, 1.15, 0),
            FLAG,
            MAX_DIGS,
        );
        this.scatter(createRandom(313), colliders);
    }

    /** Restores which were dug out (and not yet filled up again). */
    load(harvested: unknown, now: number): void {
        if (!Array.isArray(harvested)) {
            return;
        }

        for (const entry of harvested) {
            if (
                typeof entry?.id !== 'string' ||
                typeof entry?.at !== 'number' ||
                !entry.id.startsWith('dig:') ||
                now - entry.at >= REGROW_MS
            ) {
                continue;
            }

            const dig = this.list[Number(entry.id.slice(4))];

            if (dig) {
                dig.dug = true;
                this.harvested.set(dig.id, entry.at);
                this.draw(dig);
            }
        }
    }

    harvestedList(): Harvested[] {
        return [...this.harvested].map(([id, at]) => ({ id, at }));
    }

    /** Fills up whatever has waited long enough; answers whether any did. */
    regrow(now: number): boolean {
        let changed = false;

        for (const [id, at] of this.harvested) {
            if (now - at < REGROW_MS) {
                continue;
            }

            const dig = this.list[Number(id.slice(4))];
            this.harvested.delete(id);
            dig.dug = false;
            dig.hp = dig.maxHp;
            this.draw(dig);
            changed = true;
        }

        return changed;
    }

    /** The dig right in front, within reach of a shovel. */
    target(position: THREE.Vector3, facing: number, reach = 1.5): Dig | null {
        const forwardX = Math.sin(facing);
        const forwardZ = Math.cos(facing);
        let best: Dig | null = null;
        let bestDistance = reach;

        for (const dig of this.list) {
            if (dig.dug || Math.abs(dig.ground - position.y) > 1.5) {
                continue;
            }

            const dx = dig.x - position.x;
            const dz = dig.z - position.z;
            const centre = Math.hypot(dx, dz);
            const distance = centre - 0.7;

            if (
                distance < bestDistance &&
                (centre < 0.6 || (dx * forwardX + dz * forwardZ) / centre > 0.2)
            ) {
                best = dig;
                bestDistance = distance;
            }
        }

        return best;
    }

    /** How far a point is from the edge of the mound. */
    distance(dig: Dig, position: THREE.Vector3): number {
        return Math.max(
            0,
            Math.hypot(dig.x - position.x, dig.z - position.z) - 0.7,
        );
    }

    /** One stroke of the shovel (or pickaxe); the last one gives the finds. */
    hit(dig: Dig, tool: Tool | null, now: number): DigResult {
        const power =
            tool?.kind === 'shovel'
                ? tool.power
                : tool?.kind === 'pickaxe'
                  ? 1
                  : 0;

        dig.shake = 1;

        if (power === 0) {
            return { yields: [], needs: 'shovel', done: false };
        }

        dig.hp = Math.max(0, dig.hp - power);
        this.position.set(dig.x, dig.ground + 0.3, dig.z);
        this.chips.burst(this.position, 0x8a6e52, 10, 0.08);

        const yields: Yield[] =
            Math.random() < 0.3 ? [{ item: 'pebble', count: 1 }] : [];

        if (dig.hp > 0) {
            return { yields, done: false };
        }

        dig.dug = true;
        this.harvested.set(dig.id, now);
        this.chips.burst(this.position, 0xa39d90, 14, 0.1);
        this.draw(dig);

        for (const [item, least, most, chance] of LOOT) {
            if (Math.random() < chance) {
                yields.push({
                    item,
                    count:
                        least + Math.floor(Math.random() * (most - least + 1)),
                });
            }
        }

        return { yields, done: true };
    }

    /**
     * Now and then a dig gives up an old thing as well, worn nearly
     * through: answers it (with its wear), or null.
     */
    relic(): { item: ItemId; count: number; wear: number } | null {
        if (Math.random() >= RELIC_CHANCE) {
            return null;
        }

        const item = RELICS[Math.floor(Math.random() * RELICS.length)];
        const durability = ITEMS[item].durability ?? 1;

        return {
            item,
            count: 1,
            wear: Math.floor(durability * (0.7 + Math.random() * 0.2)),
        };
    }

    update(dt: number): void {
        this.time += dt;
        let flagsMoved = false;

        for (const dig of this.list) {
            if (dig.shake > 0) {
                dig.shake = Math.max(0, dig.shake - dt * 4);
                this.draw(dig);
            } else if (!dig.dug) {
                flagsMoved = true;
                this.drawFlag(dig);
            }
        }

        if (flagsMoved) {
            this.flags.instanceMatrix.needsUpdate = true;
        }
    }

    private scatter(random: () => number, colliders: ColliderGrid): void {
        const normal = new THREE.Vector3();
        const probe = new THREE.Vector3();
        const range = WORLD_HALF - 40;

        for (
            let attempt = 0;
            attempt < MAX_DIGS * 40 && this.list.length < MAX_DIGS;
            attempt++
        ) {
            const x = (random() * 2 - 1) * range;
            const z = (random() * 2 - 1) * range;
            const keep = random();
            const yaw = random() * Math.PI * 2;
            const size = 0.85 + random() * 0.35;

            if (keptClear(x, z, 4)) {
                continue;
            }

            const ground = heightAt(x, z);
            const biome = dominantBiome(biomeWeights(x, z));

            if (
                keep > ODDS[biome] ||
                ground < WATER_LEVEL + 0.4 ||
                normalAt(x, z, normal).y < 0.85 ||
                colliders.blocked(probe.set(x, ground + 0.1, z), 1.1, 1) ||
                this.list.some(
                    (other) => Math.hypot(other.x - x, other.z - z) < 25,
                )
            ) {
                continue;
            }

            const index = this.list.length;
            const dig: Dig = {
                kind: 'dig',
                id: `dig:${index}`,
                index,
                x,
                z,
                ground,
                hp: HP,
                maxHp: HP,
                dug: false,
                shake: 0,
            };

            this.list.push(dig);
            this.looks.push({ yaw, size });
            this.draw(dig);
        }

        for (const mesh of [this.mounds, this.poles, this.flags]) {
            mesh.count = this.list.length;
        }

        this.stones.count = this.list.length * 3;
    }

    /** The mound shrinks as it is dug; a dug-out one is a flat patch with its stones. */
    private draw(dig: Dig): void {
        const { yaw, size } = this.looks[dig.index];
        const left = dig.dug ? 0.15 : 0.45 + 0.55 * (dig.hp / dig.maxHp);
        const jitter = dig.shake * 0.04;
        this.quaternion.setFromAxisAngle(this.up, yaw);

        this.matrix.compose(
            this.position.set(
                dig.x + (Math.random() - 0.5) * jitter,
                dig.ground - 0.05,
                dig.z,
            ),
            this.quaternion,
            this.scale.set(1.1 * size, 0.55 * size * left, 0.9 * size),
        );
        this.mounds.setMatrixAt(dig.index, this.matrix);

        for (let stone = 0; stone < 3; stone++) {
            const angle = yaw + stone * 2.1;
            const reach = 0.9 * size + 0.15 * stone;
            this.matrix.compose(
                this.position.set(
                    dig.x + Math.cos(angle) * reach,
                    dig.ground + 0.05,
                    dig.z + Math.sin(angle) * reach,
                ),
                this.quaternion,
                this.scale.setScalar(0.16 + stone * 0.05),
            );
            this.stones.setMatrixAt(dig.index * 3 + stone, this.matrix);
        }

        this.matrix.compose(
            this.position.set(
                dig.x + Math.cos(yaw + 1) * 0.8 * size,
                dig.ground,
                dig.z + Math.sin(yaw + 1) * 0.8 * size,
            ),
            this.quaternion,
            this.scale.setScalar(dig.dug ? 0 : 1),
        );
        this.poles.setMatrixAt(dig.index, this.matrix);
        this.drawFlag(dig);

        this.mounds.instanceMatrix.needsUpdate = true;
        this.stones.instanceMatrix.needsUpdate = true;
        this.poles.instanceMatrix.needsUpdate = true;
        this.flags.instanceMatrix.needsUpdate = true;
    }

    /** The little flag flutters in the wind. */
    private drawFlag(dig: Dig): void {
        const { yaw, size } = this.looks[dig.index];
        this.quaternion.setFromAxisAngle(
            this.up,
            yaw + Math.sin(this.time * 3 + dig.index) * 0.35,
        );
        this.matrix.compose(
            this.position.set(
                dig.x + Math.cos(yaw + 1) * 0.8 * size,
                dig.ground,
                dig.z + Math.sin(yaw + 1) * 0.8 * size,
            ),
            this.quaternion,
            this.scale.setScalar(dig.dug ? 0 : 1),
        );
        this.flags.setMatrixAt(dig.index, this.matrix);
    }

    private instanced(
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        count: number,
    ): THREE.InstancedMesh {
        const mesh = new THREE.InstancedMesh(geometry, material, count);
        // Spread over the whole world: never culled as one.
        mesh.frustumCulled = false;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.count = 0;
        this.group.add(mesh);

        return mesh;
    }
}
