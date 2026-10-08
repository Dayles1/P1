/**
 * Everything standing on the ground: trees, cacti and rocks to gather
 * from, finds to pick up, artifacts, campfires, places to sit and the
 * blocks next to the spawn. Each is a picture (instanced meshes) and,
 * when solid, a collider. What grows where follows the biome: broad trees
 * in meadows and woods, firs in the snow and on the mountains, cacti in
 * the desert, iron ore in mountain rock.
 *
 * Everything comes from one seeded list, so the world is the same every
 * time and an id ("tree:12") always means the same thing. What the player
 * used up is remembered by id and time and grows back after a while —
 * artifacts never do. Campfires the player put down are kept too.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HitMaterial } from '../audio';
import { ITEMS } from '../items';
import type { ArtifactId, ItemId, ToolKind } from '../items';
import { RADIUS } from '../physics/character';
import type { Seat } from '../physics/character';
import type {
    ColliderGrid,
    CylinderCollider,
    SphereCollider,
} from '../physics/colliders';
import { biomeWeights, dominantBiome } from './biomes';
import type { Biome } from './biomes';
import type { Chips } from './effects';
import { createRandom } from './noise';
import {
    heightAt,
    normalAt,
    SPAWN_RADIUS,
    WATER_LEVEL,
    WORLD_HALF,
} from './terrain';

const MAX_TREES = 1100;
const MAX_ROCKS = 420;
const MAX_FINDS = 900;
const STUMP_HEIGHT = 0.45;
const MAX_FIRES = 30;

/** How long until something used up grows back, ms. */
const REGROW: Record<string, number> = {
    tree: 15 * 60_000,
    rock: 20 * 60_000,
    pick: 6 * 60_000,
    art: Infinity,
};

const mat = (
    color: number,
    flat = false,
    extra: THREE.MeshStandardMaterialParameters = {},
) =>
    new THREE.MeshStandardMaterial({
        color,
        roughness: 0.9,
        flatShading: flat,
        ...extra,
    });

const TRUNK = mat(0x96806b);
const STUMP_TOP = mat(0xcdb99c);
const CROWN = mat(0x8fae78, true);
const PINE = mat(0x6e8f70, true);
const CACTUS = mat(0x86a472);
const ROCK = mat(0xffffff, true);
const BLOCK = mat(0xd8d4cc);
const STICK = mat(0x9c7e5f);
const PEBBLE = mat(0xbab6af, true);
const FLINT = mat(0x5f6266, true);
const GRASS = mat(0x9fb087, true);
const STEM = mat(0xe7e0d3);
const CAP = mat(0xb98a68);
const BUSH = mat(0x8fa27e, true);
const BERRY = mat(0xa8464d);
const ASH = mat(0x77736d);
const FLAME = new THREE.MeshBasicMaterial({
    color: 0xffb35c,
    transparent: true,
    opacity: 0.9,
});
const FLAME_CORE = new THREE.MeshBasicMaterial({ color: 0xffe2a0 });

const ROCK_COLORS = {
    plain: new THREE.Color(0xb2aea7),
    ore: new THREE.Color(0x9c8070),
    sand: new THREE.Color(0xcdb48e),
    snow: new THREE.Color(0xc9cdd2),
};

const ARTIFACTS: Record<Biome, ArtifactId> = {
    meadow: 'golden_clover',
    forest: 'forest_heart',
    desert: 'sun_stone',
    snow: 'frost_crystal',
    mountains: 'wind_feather',
};

const ARTIFACT_COLORS: Record<ArtifactId, number> = {
    golden_clover: 0xe3c25e,
    forest_heart: 0x8fd17a,
    sun_stone: 0xffc35a,
    frost_crystal: 0x9fdcf5,
    wind_feather: 0xe8f4f8,
};

/**
 * Blocks next to the spawn: a staircase up to a platform, a gap to jump
 * over, a wall, a box, and a low slab on two posts to crawl under.
 * [x, z, width, depth, height, raised by].
 */
const BLOCKS: [number, number, number, number, number, number][] = [
    [6, -2, 1.6, 1.6, 0.4, 0],
    [7.6, -2, 1.6, 1.6, 0.8, 0],
    [9.2, -2, 1.6, 1.6, 1.4, 0],
    [10.8, -2, 1.6, 1.6, 2.0, 0],
    [13.2, -2, 3, 3, 2.0, 0],
    [17, -2, 2, 2, 2.0, 0],
    [-8, 6, 0.6, 10, 2.4, 0],
    [-4, -9, 3, 3, 1.1, 0],
    [-13, 6, 3.2, 3, 0.3, 0.8],
    [-14.4, 6, 0.4, 3, 0.8, 0],
    [-11.6, 6, 0.4, 3, 0.8, 0],
];

/** Logs to sit on around the spawn's fireplace. [x, z, length, faces]. */
const CAMPFIRE = { x: -3, z: 12 };
const BENCHES: [number, number, number, number][] = [
    [-3, 9.8, 2.4, 0],
    [-3, 14.2, 2.4, Math.PI],
];
const LOG_RADIUS = 0.22;

export type Species = 'broad' | 'pine' | 'cactus';

export interface Tree {
    kind: 'tree';
    id: string;
    index: number;
    species: Species;
    /** Instance in its species' crown, fir or cactus mesh. */
    slot: number;
    /** Instance in the trunk and stump meshes; -1 for a cactus. */
    trunk: number;
    x: number;
    z: number;
    ground: number;
    height: number;
    radius: number;
    crown: number;
    stretch: number;
    yaw: number;
    hp: number;
    maxHp: number;
    collider: CylinderCollider;
    stump: CylinderCollider;
    felled: boolean;
    shake: number;
}

export interface Rock {
    kind: 'rock';
    id: string;
    index: number;
    ore: boolean;
    center: THREE.Vector3;
    ground: number;
    size: number;
    yaw: number;
    hp: number;
    maxHp: number;
    collider: SphereCollider;
    gone: boolean;
    shake: number;
}

type FindType = 'stick' | 'pebble' | 'mushroom' | 'berries' | 'grass' | 'flint';

export interface Find {
    kind: 'find';
    id: string;
    index: number;
    type: FindType;
    /** Instance in its type's meshes. */
    slot: number;
    item: ItemId;
    count: number;
    x: number;
    z: number;
    ground: number;
    taken: boolean;
}

export interface Artifact {
    kind: 'artifact';
    id: string;
    index: number;
    item: ArtifactId;
    x: number;
    z: number;
    ground: number;
    group: THREE.Group;
    taken: boolean;
}

export interface Drop {
    kind: 'drop';
    mesh: THREE.Mesh;
    item: ItemId;
    count: number;
}

export interface Fire {
    kind: 'fire';
    x: number;
    z: number;
    ground: number;
    /** Put down by the player (and so can be picked up again). */
    placed: boolean;
    group: THREE.Group;
    flames: THREE.Mesh[];
    collider: CylinderCollider | null;
}

export interface SeatTarget {
    kind: 'seat';
    seat: Seat;
    what: 'stump' | 'rock' | 'log';
}

export type HitTarget = Tree | Rock;
export type UseTarget = Find | Drop | Artifact | Fire | SeatTarget;

export interface Harvested {
    id: string;
    at: number;
}

export interface Placed {
    type: 'campfire';
    x: number;
    z: number;
}

export interface Yield {
    item: ItemId;
    count: number;
}

export interface HitResult {
    yields: Yield[];
    material: HitMaterial;
    /** The blow did nothing: this tool is needed. */
    needs?: ToolKind;
}

export interface Tool {
    kind: ToolKind;
    power: number;
}

interface Falling {
    group: THREE.Group;
    axis: THREE.Vector3;
    angle: number;
    speed: number;
    time: number;
    landed: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);

function hiddenMatrix(): THREE.Matrix4 {
    return new THREE.Matrix4().makeScale(0, 0, 0);
}

export class Resources {
    readonly group = new THREE.Group();
    readonly trees: Tree[] = [];
    readonly rocks: Rock[] = [];
    readonly finds: Find[] = [];
    readonly artifacts: Artifact[] = [];
    readonly fires: Fire[] = [];
    onTreeFalls: (tree: Tree) => void = () => {};
    onTreeLands: (at: THREE.Vector3) => void = () => {};

    private drops: Drop[] = [];
    private benchSeats: SeatTarget[] = [];
    private harvested = new Map<string, number>();
    private falling: Falling[] = [];
    /** Each find's turn and size, so redrawing it keeps its look. */
    private findLook = new Map<number, [number, number]>();
    private time = 0;

    private trunks: THREE.InstancedMesh;
    private crowns: THREE.InstancedMesh;
    private pines: THREE.InstancedMesh;
    private cacti: THREE.InstancedMesh;
    private stumps: THREE.InstancedMesh;
    private rockMesh: THREE.InstancedMesh;
    private findMeshes: Record<FindType, THREE.InstancedMesh[]>;
    private fireGeometry = this.createFireGeometry();

    private matrix = new THREE.Matrix4();
    private local = new THREE.Matrix4();
    private quaternion = new THREE.Quaternion();
    private tilt = new THREE.Quaternion();
    private position = new THREE.Vector3();
    private scale = new THREE.Vector3();

    constructor(
        private colliders: ColliderGrid,
        private chips: Chips,
    ) {
        const random = createRandom(42);

        this.trunks = this.instanced(
            new THREE.CylinderGeometry(0.75, 1, 1, 8),
            TRUNK,
            MAX_TREES,
        );
        this.crowns = this.instanced(
            new THREE.IcosahedronGeometry(1, 1),
            CROWN,
            MAX_TREES,
        );
        this.pines = this.instanced(this.pineGeometry(), PINE, MAX_TREES);
        this.cacti = this.instanced(this.cactusGeometry(), CACTUS, MAX_TREES);
        this.stumps = this.instanced(
            this.stumpGeometry(),
            [TRUNK, STUMP_TOP],
            MAX_TREES,
        );
        this.rockMesh = this.instanced(
            new THREE.IcosahedronGeometry(1, 1),
            ROCK,
            MAX_ROCKS,
        );
        this.findMeshes = this.createFindMeshes();

        this.plantTrees(random);
        this.placeRocks(random);
        this.scatterFinds(random);
        this.hideArtifacts(random);
        this.buildBlocks();
        this.buildCampfire();
    }

    /** Restores what was used up and put down in a saved game. */
    load(harvested: unknown, placed: unknown, now: number): void {
        if (Array.isArray(harvested)) {
            for (const entry of harvested) {
                if (
                    typeof entry?.id !== 'string' ||
                    typeof entry?.at !== 'number'
                ) {
                    continue;
                }

                const [type, number] = entry.id.split(':');

                if (now - entry.at >= (REGROW[type] ?? 0)) {
                    continue;
                }

                if (this.useUp(type, Number(number))) {
                    this.harvested.set(entry.id, entry.at);
                }
            }
        }

        if (Array.isArray(placed)) {
            for (const entry of placed.slice(0, MAX_FIRES)) {
                if (
                    entry?.type === 'campfire' &&
                    Number.isFinite(entry.x) &&
                    Number.isFinite(entry.z)
                ) {
                    this.addFire(entry.x, entry.z, true);
                }
            }
        }
    }

    harvestedList(): Harvested[] {
        return [...this.harvested].map(([id, at]) => ({ id, at }));
    }

    placedList(): Placed[] {
        return this.fires
            .filter((fire) => fire.placed)
            .map((fire) => ({ type: 'campfire', x: fire.x, z: fire.z }));
    }

    /** Grows back whatever has waited long enough. */
    regrow(now: number): boolean {
        let changed = false;

        for (const [id, at] of this.harvested) {
            const [type, number] = id.split(':');

            if (now - at < (REGROW[type] ?? 0)) {
                continue;
            }

            const index = Number(number);
            this.harvested.delete(id);
            changed = true;

            if (type === 'tree') {
                const tree = this.trees[index];
                tree.felled = false;
                tree.hp = tree.maxHp;
                tree.collider.disabled = false;
                tree.stump.disabled = true;

                if (tree.trunk >= 0) {
                    this.stumps.setMatrixAt(tree.trunk, hiddenMatrix());
                }

                this.drawTree(tree);
                this.touch(
                    this.trunks,
                    this.crowns,
                    this.pines,
                    this.cacti,
                    this.stumps,
                );
            } else if (type === 'rock') {
                const rock = this.rocks[index];
                rock.gone = false;
                rock.hp = rock.maxHp;
                rock.collider.disabled = false;
                this.drawRock(rock);
            } else if (type === 'pick') {
                const find = this.finds[index];
                find.taken = false;
                this.drawFind(find);
            }
        }

        return changed;
    }

    /**
     * What the player could hit (a tree or rock in front, within reach)
     * and use (a find, artifact, bundle, fire or seat nearby).
     */
    targets(
        position: THREE.Vector3,
        facing: number,
    ): { hit: HitTarget | null; use: UseTarget | null } {
        const forwardX = Math.sin(facing);
        const forwardZ = Math.cos(facing);
        const inFront = (dx: number, dz: number, distance: number) =>
            distance < 0.5 || (dx * forwardX + dz * forwardZ) / distance > 0.25;

        let hit: HitTarget | null = null;
        let hitDistance = 1.2;

        for (const tree of this.near(this.trees, position, 4)) {
            if (tree.felled) {
                continue;
            }

            const dx = tree.x - position.x;
            const dz = tree.z - position.z;
            const centre = Math.hypot(dx, dz);
            const distance = centre - tree.radius;

            if (distance < hitDistance && inFront(dx, dz, centre)) {
                hit = tree;
                hitDistance = distance;
            }
        }

        for (const rock of this.near(this.rocks, position, 5)) {
            if (
                rock.gone ||
                rock.center.y + rock.collider.radius < position.y + 0.1
            ) {
                continue;
            }

            const dx = rock.center.x - position.x;
            const dz = rock.center.z - position.z;
            const centre = Math.hypot(dx, dz);
            const distance = centre - rock.collider.radius;

            if (distance < hitDistance && inFront(dx, dz, centre)) {
                hit = rock;
                hitDistance = distance;
            }
        }

        let use: UseTarget | null = null;
        let useDistance = 1.7;
        const consider = (
            target: UseTarget,
            x: number,
            z: number,
            ground: number,
        ) => {
            const dx = x - position.x;
            const dz = z - position.z;
            const distance = Math.hypot(dx, dz);

            if (
                distance < useDistance &&
                Math.abs(ground - position.y) < 1.4 &&
                inFront(dx, dz, distance)
            ) {
                use = target;
                useDistance = distance;
            }
        };

        for (const find of this.near(this.finds, position, 3)) {
            if (!find.taken) {
                consider(find, find.x, find.z, find.ground);
            }
        }

        for (const artifact of this.artifacts) {
            if (!artifact.taken) {
                consider(artifact, artifact.x, artifact.z, artifact.ground);
            }
        }

        for (const drop of this.drops) {
            consider(
                drop,
                drop.mesh.position.x,
                drop.mesh.position.z,
                drop.mesh.position.y,
            );
        }

        for (const fire of this.fires) {
            if (fire.placed) {
                consider(fire, fire.x, fire.z, fire.ground);
            }
        }

        if (use) {
            return { hit, use };
        }

        let seatDistance = 1.0;

        for (const seat of this.seats(position)) {
            const distance =
                Math.hypot(seat.seat.x - position.x, seat.seat.z - position.z) -
                seat.seat.clearance;

            if (distance < seatDistance) {
                use = seat;
                seatDistance = distance;
            }
        }

        return { hit, use };
    }

    /**
     * One blow at a tree, cactus or rock with the given tool (or bare
     * hands): shakes it, sends chips flying and gives resources; the last
     * blow fells or breaks it. Iron ore needs a pickaxe.
     */
    hit(
        target: HitTarget,
        from: THREE.Vector3,
        now: number,
        tool: Tool | null,
        bonus = 1,
    ): HitResult {
        const yieldOf = (item: ItemId, count: number): Yield => ({
            item,
            count: Math.max(1, Math.round(count * bonus)),
        });

        if (target.kind === 'tree') {
            const cactus = target.species === 'cactus';
            const power =
                tool &&
                (tool.kind === 'axe' || (cactus && tool.kind === 'sword'))
                    ? tool.power
                    : 1;
            const damage = Math.min(power, target.hp);
            target.hp -= damage;
            target.shake = 1;

            const toTree = Math.atan2(target.x - from.x, target.z - from.z);
            this.position.set(
                target.x - Math.sin(toTree) * target.radius,
                target.ground + 1.1,
                target.z - Math.cos(toTree) * target.radius,
            );
            this.chips.burst(this.position, cactus ? 0x9fb48c : 0xb59a7a, 7);

            const item: ItemId = cactus ? 'fiber' : 'wood';
            const yields = [yieldOf(item, (cactus ? 1 : 2) * damage)];

            if (target.hp <= 0) {
                this.fell(target, from);
                this.harvested.set(target.id, now);
                yields.push(yieldOf(item, cactus ? 2 : 3));
            }

            return { yields, material: cactus ? 'cactus' : 'wood' };
        }

        const pickaxe = tool?.kind === 'pickaxe' ? tool.power : 0;

        if (target.ore && pickaxe === 0) {
            target.shake = 0.6;

            return { yields: [], material: 'stone', needs: 'pickaxe' };
        }

        const damage = Math.min(Math.max(1, pickaxe), target.hp);
        target.hp -= damage;
        target.shake = 1;
        this.position
            .copy(target.center)
            .setY(target.center.y + target.collider.radius * 0.6);
        this.chips.burst(this.position, target.ore ? 0x9c8070 : 0xb2aea7, 9);

        const yields = target.ore
            ? [yieldOf('iron_ore', damage), yieldOf('stone', 1)]
            : [yieldOf('stone', 2 * damage)];

        if (target.hp <= 0) {
            this.breakRock(target);
            this.harvested.set(target.id, now);
            this.chips.burst(target.center, 0xb2aea7, 16, 0.12);
            yields.push(
                target.ore ? yieldOf('iron_ore', 2) : yieldOf('stone', 3),
            );
        } else {
            this.drawRock(target);
        }

        return { yields, material: target.ore ? 'ore' : 'stone' };
    }

    /** Picks up a find, an artifact, a dropped bundle or a placed fire. */
    take(target: Find | Drop | Artifact | Fire, now: number): Yield {
        switch (target.kind) {
            case 'drop':
                this.group.remove(target.mesh);
                this.drops = this.drops.filter((drop) => drop !== target);

                return { item: target.item, count: target.count };
            case 'fire':
                this.removeFire(target);

                return { item: 'campfire', count: 1 };
            case 'artifact':
                this.useUp('art', target.index);
                this.harvested.set(target.id, now);

                return { item: target.item, count: 1 };
            case 'find':
                this.useUp('pick', target.index);
                this.harvested.set(target.id, now);

                return { item: target.item, count: target.count };
        }
    }

    /** Puts a bundle of items on the ground (not kept between visits). */
    drop(item: ItemId, count: number, at: THREE.Vector3): void {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.32, 0.22, 0.26),
            mat(ITEMS[item].artifact ? 0xe8d9a8 : 0xcbbfa9),
        );
        mesh.castShadow = true;
        mesh.position.copy(at);
        mesh.position.y =
            Math.max(WATER_LEVEL, this.colliders.surfaceAt(at.x, at.z).top) +
            0.11;
        mesh.rotation.y = Math.random() * Math.PI;
        this.group.add(mesh);
        this.drops.push({ kind: 'drop', mesh, item, count });
    }

    /** Whether a campfire fits there: dry, flat, clear, not next to another. */
    fireFits(x: number, z: number): boolean {
        const ground = heightAt(x, z);
        const spot = new THREE.Vector3(x, ground, z);
        const tooClose = this.fires.some(
            (fire) => Math.hypot(fire.x - x, fire.z - z) < 1.5,
        );

        return !(
            ground < WATER_LEVEL + 0.2 ||
            tooClose ||
            this.fires.filter((fire) => fire.placed).length >= MAX_FIRES ||
            normalAt(x, z, this.position).y < 0.8 ||
            this.colliders.blocked(spot, 0.5, 0.6)
        );
    }

    /** Lights a campfire the player put down; false where there is no room. */
    placeFire(x: number, z: number): boolean {
        if (!this.fireFits(x, z)) {
            return false;
        }

        this.addFire(x, z, true);

        return true;
    }

    /** 0…1 how close the nearest fire is (1 right next to it). */
    fireNear(position: THREE.Vector3, reach = 8): number {
        let best = 0;

        for (const fire of this.fires) {
            const distance = Math.hypot(
                fire.x - position.x,
                fire.z - position.z,
            );
            best = Math.max(
                best,
                1 - Math.min(1, Math.max(0, distance - 1) / (reach - 1)),
            );
        }

        return best;
    }

    update(dt: number): void {
        this.time += dt;

        for (const tree of this.trees) {
            if (tree.shake > 0) {
                tree.shake = Math.max(0, tree.shake - dt * 2.5);
                this.drawTree(tree);
                this.touch(this.trunks, this.crowns, this.pines, this.cacti);
            }
        }

        for (const rock of this.rocks) {
            if (rock.shake > 0 && !rock.gone) {
                rock.shake = Math.max(0, rock.shake - dt * 4);
                this.drawRock(rock);
            }
        }

        this.falling = this.falling.filter((fall) => {
            fall.time += dt;

            if (fall.angle < Math.PI / 2 - 0.05) {
                fall.speed += (1.2 + 6 * Math.sin(fall.angle)) * dt;
                fall.angle = Math.min(
                    Math.PI / 2 - 0.05,
                    fall.angle + fall.speed * dt,
                );
            } else if (!fall.landed) {
                fall.landed = true;
                this.onTreeLands(fall.group.position);
            }

            fall.group.quaternion.setFromAxisAngle(fall.axis, fall.angle);

            if (fall.time > 2.2) {
                fall.group.scale.setScalar(
                    Math.max(0, 1 - (fall.time - 2.2) / 0.6),
                );
            }

            if (fall.time > 2.8) {
                this.group.remove(fall.group);

                return false;
            }

            return true;
        });

        for (const drop of this.drops) {
            drop.mesh.rotation.y += dt * 0.8;
        }

        for (const artifact of this.artifacts) {
            if (!artifact.taken) {
                const gem = artifact.group.children[0];
                gem.rotation.y += dt * 1.4;
                gem.position.y =
                    0.9 + Math.sin(this.time * 2 + artifact.index) * 0.12;
            }
        }

        for (const fire of this.fires) {
            fire.flames.forEach((flame, index) => {
                const flicker =
                    1 +
                    Math.sin(this.time * (11 + index * 3) + index) * 0.12 +
                    Math.sin(this.time * 23 + index) * 0.06;
                flame.scale.set(1, flicker, 1);
                flame.rotation.y += dt * (index ? -1.5 : 1);
            });
        }
    }

    private near<T extends { x?: number; z?: number; center?: THREE.Vector3 }>(
        list: T[],
        position: THREE.Vector3,
        reach: number,
    ): T[] {
        return list.filter((entry) => {
            const x = entry.center?.x ?? entry.x!;
            const z = entry.center?.z ?? entry.z!;

            return (
                Math.abs(x - position.x) < reach &&
                Math.abs(z - position.z) < reach
            );
        });
    }

    private seats(position: THREE.Vector3): SeatTarget[] {
        const seats = this.benchSeats.filter(
            (seat) =>
                Math.hypot(seat.seat.x - position.x, seat.seat.z - position.z) <
                3,
        );

        for (const tree of this.near(this.trees, position, 3)) {
            if (tree.felled && tree.species !== 'cactus') {
                seats.push({
                    kind: 'seat',
                    what: 'stump',
                    seat: {
                        x: tree.x,
                        z: tree.z,
                        ground: tree.ground,
                        top: tree.ground + STUMP_HEIGHT,
                        yaw: null,
                        clearance: tree.radius + 0.45,
                    },
                });
            }
        }

        for (const rock of this.near(this.rocks, position, 3)) {
            const top = rock.center.y + rock.collider.radius - rock.ground;

            if (!rock.gone && top > 0.35 && top < 0.8) {
                seats.push({
                    kind: 'seat',
                    what: 'rock',
                    seat: {
                        x: rock.center.x,
                        z: rock.center.z,
                        ground: rock.ground,
                        top: rock.ground + top,
                        yaw: null,
                        clearance: rock.collider.radius + 0.4,
                    },
                });
            }
        }

        return seats;
    }

    /** Marks something used up and hides it (no animation). */
    private useUp(type: string, index: number): boolean {
        if (type === 'tree' && this.trees[index]) {
            this.fell(this.trees[index], null);
        } else if (type === 'rock' && this.rocks[index]) {
            this.breakRock(this.rocks[index]);
        } else if (type === 'pick' && this.finds[index]) {
            this.finds[index].taken = true;
            this.drawFind(this.finds[index]);
        } else if (type === 'art' && this.artifacts[index]) {
            this.artifacts[index].taken = true;
            this.artifacts[index].group.visible = false;
        } else {
            return false;
        }

        return true;
    }

    private place(
        random: () => number,
        clearance: number,
    ): { x: number; z: number; ground: number; biome: Biome } | null {
        const normal = new THREE.Vector3();
        const range = WORLD_HALF - 40;
        const x = (random() * 2 - 1) * range;
        const z = (random() * 2 - 1) * range;

        if (Math.hypot(x, z) < SPAWN_RADIUS + clearance) {
            return null;
        }

        const ground = heightAt(x, z);

        if (ground < WATER_LEVEL + 0.4 || normalAt(x, z, normal).y < 0.8) {
            return null;
        }

        return { x, z, ground, biome: dominantBiome(biomeWeights(x, z)) };
    }

    private plantTrees(random: () => number): void {
        // Tints come from their own stream, so the seeded layout stays the same.
        const tints = createRandom(97);
        const tint = new THREE.Color();
        const counts = { trunk: 0, broad: 0, pine: 0, cactus: 0 };

        for (
            let attempt = 0;
            attempt < MAX_TREES * 6 && this.trees.length < MAX_TREES;
            attempt++
        ) {
            const spot = this.place(random, 4);

            if (!spot) {
                continue;
            }

            const roll = random();
            let species: Species | null = null;

            switch (spot.biome) {
                case 'desert':
                    species = roll < 0.18 ? 'cactus' : null;
                    break;
                case 'snow':
                    species = roll < 0.5 ? 'pine' : null;
                    break;
                case 'mountains':
                    species = roll < 0.15 && spot.ground < 30 ? 'pine' : null;
                    break;
                case 'forest':
                    species =
                        roll < 0.95 ? (roll < 0.2 ? 'pine' : 'broad') : null;
                    break;
                default:
                    species = roll < 0.18 ? 'broad' : null;
            }

            if (!species) {
                continue;
            }

            const index = this.trees.length;
            const cactus = species === 'cactus';
            const tall = spot.biome === 'forest' ? 1.25 : 1;
            const height = cactus
                ? 1.8 + random() * 1.2
                : (3 + random() * 2.5) * tall;
            const radius = cactus
                ? 0.24 + random() * 0.08
                : 0.22 + random() * 0.14;
            const maxHp = cactus ? 3 : species === 'pine' ? 6 : 5;
            const tree: Tree = {
                kind: 'tree',
                id: `tree:${index}`,
                index,
                species,
                slot: counts[species]++,
                trunk: cactus ? -1 : counts.trunk++,
                x: spot.x,
                z: spot.z,
                ground: spot.ground,
                height,
                radius,
                crown:
                    species === 'pine'
                        ? 1.3 + random() * 0.6
                        : 1.5 + random() * 1.1,
                stretch: 1.1 + random() * 0.4,
                yaw: random() * Math.PI * 2,
                hp: maxHp,
                maxHp,
                collider: {
                    kind: 'cylinder',
                    x: spot.x,
                    z: spot.z,
                    radius: cactus ? radius + 0.1 : radius,
                    bottom: spot.ground - 1,
                    top: spot.ground + height,
                },
                stump: {
                    kind: 'cylinder',
                    x: spot.x,
                    z: spot.z,
                    radius: radius + 0.04,
                    bottom: spot.ground - 1,
                    top: spot.ground + STUMP_HEIGHT,
                    disabled: true,
                },
                felled: false,
                shake: 0,
            };

            this.trees.push(tree);
            this.colliders.add(tree.collider);

            if (!cactus) {
                this.colliders.add(tree.stump);
                const shade = 0.85 + tints() * 0.25;
                this.trunks.setColorAt(
                    tree.trunk,
                    tint.setRGB(shade, shade * 0.97, shade * 0.94),
                );
            }

            // Every crown a slightly different green; now and then an autumn one.
            const shadeRoll = tints();
            const light = 0.84 + tints() * 0.3;

            if (species === 'broad' && shadeRoll < 0.06) {
                tint.setRGB(1.35 * light, 1.02 * light, 0.62 * light);
            } else {
                tint.setRGB(
                    light * (0.88 + shadeRoll * 0.2),
                    light,
                    light * (0.86 + tints() * 0.18),
                );
            }

            ({ broad: this.crowns, pine: this.pines, cactus: this.cacti })[
                species
            ].setColorAt(tree.slot, tint);
            this.drawTree(tree);
        }

        this.trunks.count = this.stumps.count = counts.trunk;
        this.crowns.count = counts.broad;
        this.pines.count = counts.pine;
        this.cacti.count = counts.cactus;
    }

    private placeRocks(random: () => number): void {
        for (
            let attempt = 0;
            attempt < MAX_ROCKS * 6 && this.rocks.length < MAX_ROCKS;
            attempt++
        ) {
            const spot = this.place(random, 2);

            if (!spot || (spot.biome !== 'mountains' && random() > 0.45)) {
                continue;
            }

            const index = this.rocks.length;
            const ore = spot.biome === 'mountains' && random() < 0.35;
            const size = (ore ? 0.7 : 0.4) + random() ** 2 * 2.2;
            const maxHp = Math.ceil(2 + size * 2.5);
            const center = new THREE.Vector3(
                spot.x,
                spot.ground + size * 0.25,
                spot.z,
            );
            const rock: Rock = {
                kind: 'rock',
                id: `rock:${index}`,
                index,
                ore,
                center,
                ground: spot.ground,
                size,
                yaw: random() * Math.PI * 2,
                hp: maxHp,
                maxHp,
                collider: { kind: 'sphere', center, radius: size },
                gone: false,
                shake: 0,
            };

            this.rocks.push(rock);
            this.colliders.add(rock.collider);
            this.rockMesh.setColorAt(
                index,
                ore
                    ? ROCK_COLORS.ore
                    : spot.biome === 'desert'
                      ? ROCK_COLORS.sand
                      : spot.biome === 'snow'
                        ? ROCK_COLORS.snow
                        : ROCK_COLORS.plain,
            );
            this.drawRock(rock);
        }

        this.rockMesh.count = this.rocks.length;
    }

    /**
     * Finds all over the world, the first few in a ring around the spawn
     * so there is something to pick up right away. What lies about depends
     * on the biome.
     */
    private scatterFinds(random: () => number): void {
        const kinds: Record<FindType, [ItemId, number, number]> = {
            stick: ['stick', 1, 2],
            pebble: ['pebble', 1, 3],
            mushroom: ['mushroom', 1, 1],
            berries: ['berries', 3, 5],
            grass: ['fiber', 2, 3],
            flint: ['flint', 1, 1],
        };
        const odds: Record<Biome, [FindType, number][]> = {
            meadow: [
                ['grass', 0.3],
                ['berries', 0.2],
                ['stick', 0.2],
                ['pebble', 0.2],
                ['mushroom', 0.1],
            ],
            forest: [
                ['stick', 0.35],
                ['mushroom', 0.25],
                ['berries', 0.2],
                ['grass', 0.2],
            ],
            desert: [
                ['flint', 0.45],
                ['pebble', 0.35],
                ['stick', 0.2],
            ],
            snow: [
                ['pebble', 0.4],
                ['stick', 0.35],
                ['flint', 0.25],
            ],
            mountains: [
                ['flint', 0.4],
                ['pebble', 0.5],
                ['stick', 0.1],
            ],
        };
        const normal = new THREE.Vector3();
        const counts: Record<FindType, number> = {
            stick: 0,
            pebble: 0,
            mushroom: 0,
            berries: 0,
            grass: 0,
            flint: 0,
        };

        for (
            let attempt = 0;
            attempt < MAX_FINDS * 3 && this.finds.length < MAX_FINDS;
            attempt++
        ) {
            let spot: {
                x: number;
                z: number;
                ground: number;
                biome: Biome;
            } | null;

            if (this.finds.length < 50) {
                const angle = random() * Math.PI * 2;
                const distance = 7 + random() * 30;
                const x = Math.cos(angle) * distance;
                const z = Math.sin(angle) * distance;
                const ground = heightAt(x, z);
                spot =
                    normalAt(x, z, normal).y > 0.85 &&
                    ground > WATER_LEVEL + 0.3 &&
                    this.clearOfBlocks(x, z)
                        ? { x, z, ground, biome: 'meadow' }
                        : null;
            } else {
                spot = this.place(random, 0);
            }

            if (!spot) {
                continue;
            }

            let roll = random();
            const type =
                odds[spot.biome].find(
                    ([, chance]) => (roll -= chance) < 0,
                )?.[0] ?? 'stick';
            const [item, min, max] = kinds[type];
            const index = this.finds.length;
            const find: Find = {
                kind: 'find',
                id: `pick:${index}`,
                index,
                type,
                slot: counts[type]++,
                item,
                count: min + Math.floor(random() * (max - min + 1)),
                x: spot.x,
                z: spot.z,
                ground: spot.ground,
                taken: false,
            };

            this.finds.push(find);
            this.drawFind(find, random() * Math.PI * 2, 0.8 + random() * 0.5);
        }

        for (const [type, meshes] of Object.entries(this.findMeshes)) {
            for (const mesh of meshes) {
                mesh.count = counts[type as FindType];
            }
        }
    }

    /**
     * One artifact deep in each biome, glowing, with a beam of light that
     * shows from far away.
     */
    private hideArtifacts(random: () => number): void {
        for (const biome of [
            'meadow',
            'forest',
            'desert',
            'snow',
            'mountains',
        ] as Biome[]) {
            for (let attempt = 0; attempt < 4000; attempt++) {
                const spot = this.place(random, 50);

                if (
                    !spot ||
                    spot.biome !== biome ||
                    biomeWeights(spot.x, spot.z)[biome] < 0.8
                ) {
                    continue;
                }

                const index = this.artifacts.length;
                const item = ARTIFACTS[biome];
                const color = ARTIFACT_COLORS[item];
                const group = new THREE.Group();
                group.position.set(spot.x, spot.ground, spot.z);

                const gem = new THREE.Mesh(
                    new THREE.OctahedronGeometry(0.28, 0),
                    new THREE.MeshStandardMaterial({
                        color,
                        emissive: color,
                        emissiveIntensity: 0.8,
                        roughness: 0.3,
                        flatShading: true,
                    }),
                );
                gem.castShadow = true;
                gem.position.y = 0.9;

                const beam = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.12, 0.35, 60, 8, 1, true),
                    new THREE.MeshBasicMaterial({
                        color,
                        transparent: true,
                        opacity: 0.22,
                        depthWrite: false,
                        blending: THREE.AdditiveBlending,
                        fog: false,
                        side: THREE.DoubleSide,
                    }),
                );
                beam.position.y = 30;

                group.add(gem, beam);
                this.group.add(group);
                this.artifacts.push({
                    kind: 'artifact',
                    id: `art:${index}`,
                    index,
                    item,
                    x: spot.x,
                    z: spot.z,
                    ground: spot.ground,
                    group,
                    taken: false,
                });

                break;
            }
        }
    }

    private clearOfBlocks(x: number, z: number): boolean {
        return (
            BLOCKS.every(
                ([bx, bz, width, depth]) =>
                    Math.abs(x - bx) > width / 2 + 0.6 ||
                    Math.abs(z - bz) > depth / 2 + 0.6,
            ) && Math.hypot(x - CAMPFIRE.x, z - CAMPFIRE.z) > 4
        );
    }

    private buildBlocks(): void {
        const blocks = this.instanced(
            new THREE.BoxGeometry(1, 1, 1),
            BLOCK,
            BLOCKS.length,
        );

        BLOCKS.forEach(([x, z, width, depth, height, raised], index) => {
            const ground = heightAt(x, z);
            const bottom = ground + raised;
            this.matrix.compose(
                this.position.set(x, bottom + height / 2, z),
                this.quaternion.identity(),
                this.scale.set(width, height, depth),
            );
            blocks.setMatrixAt(index, this.matrix);

            this.colliders.add({
                kind: 'box',
                min: new THREE.Vector3(
                    x - width / 2,
                    raised > 0 ? bottom : ground - 1,
                    z - depth / 2,
                ),
                max: new THREE.Vector3(
                    x + width / 2,
                    bottom + height,
                    z + depth / 2,
                ),
            });
        });
    }

    /** The spawn's fireplace — always burning — with two logs to sit on. */
    private buildCampfire(): void {
        this.addFire(CAMPFIRE.x, CAMPFIRE.z, false);

        for (const [x, z, length, yaw] of BENCHES) {
            const benchGround = heightAt(x, z);
            const log = new THREE.Mesh(
                new THREE.CylinderGeometry(LOG_RADIUS, LOG_RADIUS, length, 10),
                TRUNK,
            );
            log.rotation.z = Math.PI / 2;
            log.position.set(x, benchGround + LOG_RADIUS, z);
            log.castShadow = log.receiveShadow = true;
            this.group.add(log);

            const top = benchGround + LOG_RADIUS * 2;
            this.colliders.add({
                kind: 'box',
                min: new THREE.Vector3(
                    x - length / 2,
                    benchGround - 1,
                    z - LOG_RADIUS,
                ),
                max: new THREE.Vector3(x + length / 2, top, z + LOG_RADIUS),
            });

            for (const along of [-0.6, 0.6]) {
                this.benchSeats.push({
                    kind: 'seat',
                    what: 'log',
                    seat: {
                        x: x + along,
                        z,
                        ground: benchGround,
                        top,
                        yaw,
                        clearance: 0.65,
                    },
                });
            }
        }
    }

    private addFire(x: number, z: number, placed: boolean): void {
        const ground = heightAt(x, z);
        const group = new THREE.Group();
        group.position.set(x, ground, z);

        const stones = new THREE.Mesh(this.fireGeometry.stones, PEBBLE);
        const logs = new THREE.Mesh(this.fireGeometry.logs, TRUNK);
        const ash = new THREE.Mesh(this.fireGeometry.ash, ASH);
        const flame = new THREE.Mesh(this.fireGeometry.flame, FLAME);
        const core = new THREE.Mesh(this.fireGeometry.core, FLAME_CORE);

        for (const mesh of [stones, logs]) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
        }

        group.add(stones, logs, ash, flame, core);
        this.group.add(group);

        let collider: CylinderCollider | null = null;

        if (placed) {
            collider = {
                kind: 'cylinder',
                x,
                z,
                radius: 0.45,
                bottom: ground - 1,
                top: ground + 0.3,
            };
            this.colliders.add(collider);
        }

        this.fires.push({
            kind: 'fire',
            x,
            z,
            ground,
            placed,
            group,
            flames: [flame, core],
            collider,
        });
    }

    private removeFire(fire: Fire): void {
        this.group.remove(fire.group);

        if (fire.collider) {
            fire.collider.disabled = true;
        }

        this.fires.splice(this.fires.indexOf(fire), 1);
    }

    /** The crown, fir or cactus mesh the tree is drawn in. */
    private body(tree: Tree): THREE.InstancedMesh {
        return { broad: this.crowns, pine: this.pines, cactus: this.cacti }[
            tree.species
        ];
    }

    private drawTree(tree: Tree): void {
        if (tree.felled) {
            const hide = hiddenMatrix();
            this.body(tree).setMatrixAt(tree.slot, hide);

            if (tree.trunk >= 0) {
                this.trunks.setMatrixAt(tree.trunk, hide);
            }

            return;
        }

        const wobble = tree.shake * Math.sin(this.time * 38) * 0.05;
        this.tilt.setFromAxisAngle(
            this.position.set(Math.cos(tree.yaw), 0, Math.sin(tree.yaw)),
            wobble,
        );
        this.quaternion.setFromAxisAngle(UP, tree.yaw).premultiply(this.tilt);
        const pivot = new THREE.Matrix4().compose(
            new THREE.Vector3(tree.x, tree.ground, tree.z),
            this.quaternion,
            new THREE.Vector3(1, 1, 1),
        );

        if (tree.species === 'cactus') {
            this.local.compose(
                this.position.set(0, 0, 0),
                new THREE.Quaternion(),
                this.scale.set(
                    tree.radius / 0.25,
                    tree.height / 2.4,
                    tree.radius / 0.25,
                ),
            );
            this.cacti.setMatrixAt(
                tree.slot,
                this.matrix.multiplyMatrices(pivot, this.local),
            );

            return;
        }

        this.local.compose(
            this.position.set(0, tree.height / 2 - 0.2, 0),
            new THREE.Quaternion(),
            this.scale.set(tree.radius, tree.height, tree.radius),
        );
        this.trunks.setMatrixAt(
            tree.trunk,
            this.matrix.multiplyMatrices(pivot, this.local),
        );

        if (tree.species === 'pine') {
            this.local.compose(
                this.position.set(0, tree.height * 0.35, 0),
                new THREE.Quaternion(),
                this.scale.set(tree.crown, tree.height * 0.9, tree.crown),
            );
            this.pines.setMatrixAt(
                tree.slot,
                this.matrix.multiplyMatrices(pivot, this.local),
            );

            return;
        }

        this.local.compose(
            this.position.set(0, tree.height + tree.crown * 0.45, 0),
            new THREE.Quaternion(),
            this.scale.set(tree.crown, tree.crown * tree.stretch, tree.crown),
        );
        this.crowns.setMatrixAt(
            tree.slot,
            this.matrix.multiplyMatrices(pivot, this.local),
        );
    }

    /**
     * Fells a tree: the stump stays, the rest topples away from `from`
     * (or just vanishes when restoring a save). A cactus just crumbles.
     */
    private fell(tree: Tree, from: THREE.Vector3 | null): void {
        tree.felled = true;
        tree.hp = 0;
        tree.collider.disabled = true;
        this.drawTree(tree);

        if (tree.species !== 'cactus') {
            tree.stump.disabled = false;
            this.matrix.compose(
                this.position.set(tree.x, tree.ground, tree.z),
                this.quaternion.setFromAxisAngle(UP, tree.yaw),
                this.scale.set(tree.radius + 0.04, 1, tree.radius + 0.04),
            );
            this.stumps.setMatrixAt(tree.trunk, this.matrix);
        }

        this.touch(
            this.trunks,
            this.crowns,
            this.pines,
            this.cacti,
            this.stumps,
        );

        if (!from) {
            return;
        }

        if (tree.species === 'cactus') {
            this.chips.burst(
                this.position.set(tree.x, tree.ground + 1, tree.z),
                0x8ea47c,
                18,
                0.1,
            );

            return;
        }

        let dx = tree.x - from.x;
        let dz = tree.z - from.z;
        const length = Math.hypot(dx, dz) || 1;
        dx /= length;
        dz /= length;

        const group = new THREE.Group();
        group.position.set(tree.x, tree.ground + STUMP_HEIGHT, tree.z);

        const trunk = new THREE.Mesh(this.trunks.geometry, TRUNK);
        const trunkLength = tree.height - STUMP_HEIGHT;
        trunk.position.y = trunkLength / 2 - 0.1;
        trunk.scale.set(tree.radius, trunkLength, tree.radius);

        const pine = tree.species === 'pine';
        const crown = new THREE.Mesh(
            pine ? this.pines.geometry : this.crowns.geometry,
            pine ? PINE : CROWN,
        );

        if (pine) {
            crown.position.y = tree.height * 0.35 - STUMP_HEIGHT;
            crown.scale.set(tree.crown, tree.height * 0.9, tree.crown);
        } else {
            crown.position.y = tree.height - STUMP_HEIGHT + tree.crown * 0.45;
            crown.scale.set(tree.crown, tree.crown * tree.stretch, tree.crown);
        }

        crown.rotation.y = tree.yaw;

        for (const mesh of [trunk, crown]) {
            mesh.castShadow = true;
            group.add(mesh);
        }

        this.group.add(group);
        this.falling.push({
            group,
            axis: new THREE.Vector3(dz, 0, -dx).normalize(),
            angle: 0.02,
            speed: 0.2,
            time: 0,
            landed: false,
        });
        this.onTreeFalls(tree);
    }

    private drawRock(rock: Rock): void {
        if (rock.gone) {
            this.rockMesh.setMatrixAt(rock.index, hiddenMatrix());
            this.rockMesh.instanceMatrix.needsUpdate = true;

            return;
        }

        const radius = rock.size * (0.45 + 0.55 * (rock.hp / rock.maxHp));
        rock.collider.radius = radius;
        rock.center.y = rock.ground + radius * 0.25;

        const jitter = rock.shake * 0.04;
        this.matrix.compose(
            this.position.set(
                rock.center.x + (Math.random() - 0.5) * jitter,
                rock.center.y,
                rock.center.z + (Math.random() - 0.5) * jitter,
            ),
            this.quaternion.setFromAxisAngle(UP, rock.yaw),
            this.scale.setScalar(radius),
        );
        this.rockMesh.setMatrixAt(rock.index, this.matrix);
        this.rockMesh.instanceMatrix.needsUpdate = true;
    }

    private breakRock(rock: Rock): void {
        rock.gone = true;
        rock.hp = 0;
        rock.collider.disabled = true;
        this.drawRock(rock);
    }

    private drawFind(find: Find, yaw?: number, size?: number): void {
        if (yaw !== undefined && size !== undefined) {
            this.findLook.set(find.index, [yaw, size]);
        }

        const [spin, scale] = this.findLook.get(find.index) ?? [0, 1];
        this.matrix.compose(
            this.position.set(find.x, find.ground, find.z),
            this.quaternion.setFromAxisAngle(UP, spin),
            this.scale.setScalar(scale),
        );

        this.findMeshes[find.type].forEach((mesh, part) => {
            // A picked bush keeps its leaves; only the berries go.
            const shown =
                !find.taken || (find.type === 'berries' && part === 0);
            mesh.setMatrixAt(find.slot, shown ? this.matrix : hiddenMatrix());
            mesh.instanceMatrix.needsUpdate = true;
        });
    }

    private touch(...meshes: THREE.InstancedMesh[]): void {
        for (const mesh of meshes) {
            mesh.instanceMatrix.needsUpdate = true;
        }
    }

    private createFindMeshes(): Record<FindType, THREE.InstancedMesh[]> {
        const stick = new THREE.CylinderGeometry(0.022, 0.03, 0.75, 5);
        stick.rotateZ(Math.PI / 2);
        stick.translate(0, 0.03, 0);

        const pebble = new THREE.IcosahedronGeometry(0.11, 0);
        pebble.scale(1.2, 0.7, 1);
        pebble.translate(0, 0.05, 0);

        const flint = new THREE.IcosahedronGeometry(0.1, 0);
        flint.scale(1.4, 0.6, 0.9);
        flint.translate(0, 0.04, 0);

        const stem = new THREE.CylinderGeometry(0.035, 0.045, 0.15, 8);
        stem.translate(0, 0.075, 0);

        const cap = new THREE.SphereGeometry(
            0.11,
            12,
            6,
            0,
            Math.PI * 2,
            0,
            Math.PI / 2,
        );
        cap.scale(1, 0.65, 1);
        cap.translate(0, 0.14, 0);

        const bush = new THREE.IcosahedronGeometry(0.5, 1);
        bush.scale(1, 0.7, 1);
        bush.translate(0, 0.3, 0);

        const berries = mergeGeometries(
            [
                [0.38, 0.42, 0.12],
                [0.18, 0.55, -0.3],
                [-0.32, 0.45, 0.22],
                [-0.1, 0.62, 0.15],
                [0.05, 0.4, 0.45],
                [-0.25, 0.36, -0.32],
            ].map(([x, y, z]) =>
                new THREE.SphereGeometry(0.055, 8, 6).translate(x, y, z),
            ),
        );

        const grass = mergeGeometries(
            Array.from({ length: 7 }, (_, blade) => {
                const angle = (blade / 7) * Math.PI * 2;
                const geometry = new THREE.ConeGeometry(
                    0.03,
                    0.4 + (blade % 3) * 0.1,
                    3,
                );
                geometry.rotateZ(0.25);
                geometry.rotateY(angle);
                geometry.translate(
                    Math.cos(angle) * 0.07,
                    0.2,
                    Math.sin(angle) * 0.07,
                );

                return geometry.toNonIndexed();
            }),
        );

        const finds = {
            stick: [this.instanced(stick, STICK, MAX_FINDS)],
            pebble: [this.instanced(pebble, PEBBLE, MAX_FINDS)],
            flint: [this.instanced(flint, FLINT, MAX_FINDS)],
            mushroom: [
                this.instanced(stem, STEM, MAX_FINDS),
                this.instanced(cap, CAP, MAX_FINDS),
            ],
            berries: [
                this.instanced(bush, BUSH, MAX_FINDS),
                this.instanced(berries, BERRY, MAX_FINDS),
            ],
            grass: [this.instanced(grass, GRASS, MAX_FINDS)],
        };

        // Shadows of things this small are not worth drawing.
        for (const mesh of Object.values(finds).flat()) {
            mesh.castShadow = mesh.geometry === bush;
        }

        return finds;
    }

    /** A fir: three cones stacked, 1 unit wide and tall at scale 1. */
    private pineGeometry(): THREE.BufferGeometry {
        return mergeGeometries(
            [
                [1, 0.5, 0.25],
                [0.75, 0.42, 0.55],
                [0.48, 0.34, 0.82],
            ].map(([radius, height, y]) =>
                new THREE.ConeGeometry(radius, height, 8)
                    .translate(0, y, 0)
                    .toNonIndexed(),
            ),
        );
    }

    /** A cactus: a column with two arms, 2.4 tall at scale 1. */
    private cactusGeometry(): THREE.BufferGeometry {
        const body = new THREE.CapsuleGeometry(0.25, 1.9, 4, 10).translate(
            0,
            1.2,
            0,
        );
        const armLeft = new THREE.CapsuleGeometry(0.15, 0.5, 4, 8).translate(
            -0.45,
            1.45,
            0,
        );
        const elbowLeft = new THREE.CapsuleGeometry(0.15, 0.25, 4, 8)
            .rotateZ(Math.PI / 2)
            .translate(-0.3, 1.15, 0);
        const armRight = new THREE.CapsuleGeometry(0.13, 0.4, 4, 8).translate(
            0.42,
            1.0,
            0,
        );
        const elbowRight = new THREE.CapsuleGeometry(0.13, 0.2, 4, 8)
            .rotateZ(Math.PI / 2)
            .translate(0.28, 0.75, 0);

        return mergeGeometries([
            body,
            armLeft,
            elbowLeft,
            armRight,
            elbowRight,
        ]);
    }

    /** A stump: bark around, pale rings on top. */
    private stumpGeometry(): THREE.BufferGeometry {
        const side = new THREE.CylinderGeometry(
            1,
            1.15,
            STUMP_HEIGHT,
            10,
            1,
            true,
        );
        side.translate(0, STUMP_HEIGHT / 2, 0);
        const top = new THREE.CircleGeometry(1, 10);
        top.rotateX(-Math.PI / 2);
        top.translate(0, STUMP_HEIGHT, 0);

        return mergeGeometries([side.toNonIndexed(), top.toNonIndexed()], true);
    }

    private createFireGeometry() {
        const stones = mergeGeometries(
            Array.from({ length: 9 }, (_, index) => {
                const angle = (index / 9) * Math.PI * 2;

                return new THREE.IcosahedronGeometry(0.16, 0)
                    .scale(1.1, 0.8, 1)
                    .translate(
                        Math.cos(angle) * 0.55,
                        0.07,
                        Math.sin(angle) * 0.55,
                    );
            }),
        );
        const logs = mergeGeometries(
            [0, Math.PI / 3, (Math.PI * 2) / 3].map((angle) =>
                new THREE.CylinderGeometry(0.06, 0.07, 0.75, 6)
                    .rotateZ(Math.PI / 2 - 0.35)
                    .translate(0.12, 0.15, 0)
                    .rotateY(angle),
            ),
        );
        const ash = new THREE.CylinderGeometry(0.4, 0.45, 0.04, 14).translate(
            0,
            0.02,
            0,
        );
        const flame = new THREE.ConeGeometry(0.22, 0.75, 7).translate(
            0,
            0.45,
            0,
        );
        const core = new THREE.ConeGeometry(0.11, 0.42, 6).translate(0, 0.3, 0);

        return { stones, logs, ash, flame, core };
    }

    private instanced(
        geometry: THREE.BufferGeometry,
        material: THREE.Material | THREE.Material[],
        count: number,
    ): THREE.InstancedMesh {
        const mesh = new THREE.InstancedMesh(geometry, material, count);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;

        for (let index = 0; index < count; index++) {
            mesh.setMatrixAt(index, hiddenMatrix());
        }

        this.group.add(mesh);

        return mesh;
    }
}

/** Where a placed fire goes: a little ahead of the character. */
export function placementSpot(
    position: THREE.Vector3,
    facing: number,
): [number, number] {
    const reach = RADIUS + 1.1;

    return [
        position.x + Math.sin(facing) * reach,
        position.z + Math.cos(facing) * reach,
    ];
}
