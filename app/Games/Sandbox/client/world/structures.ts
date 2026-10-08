/**
 * Things the player builds: chests to keep things in, a workbench for the
 * better recipes, wooden and stone walls, doors, roofs, and a sleeping
 * bag to wake up at.
 *
 * Walls and doors snap to a 2 m grid — each one sits on the edge between
 * two cells, so they close into rooms — a roof covers one whole cell on
 * top of the walls, and everything else snaps to a quarter metre; all of
 * it turns in right angles, which keeps the colliders axis-aligned boxes.
 * Holding something buildable shows a see-through copy where it would
 * go: green where it fits, red where it does not.
 *
 * An axe takes a wooden building apart again, a pickaxe a stone one (a
 * chest spills what it held). Everything is saved with the player,
 * chests with their contents.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { readStack } from '../inventory';
import type { Stack } from '../inventory';
import type { ItemId, ToolKind } from '../items';
import { RADIUS } from '../physics/character';
import type { BoxCollider, ColliderGrid } from '../physics/colliders';
import { heightAt, WATER_LEVEL } from './terrain';

export type StructureType =
    | 'chest'
    | 'workbench'
    | 'wood_wall'
    | 'wood_door'
    | 'wood_roof'
    | 'stone_wall'
    | 'sleeping_bag';

export const STRUCTURE_TYPES: StructureType[] = [
    'chest',
    'workbench',
    'wood_wall',
    'wood_door',
    'wood_roof',
    'stone_wall',
    'sleeping_bag',
];

/** What a see-through preview can show: any building, or a campfire. */
export type GhostType = StructureType | 'campfire';

export const CHEST_SLOTS = 12;
const MAX_STRUCTURES = 160;
const GRID = 2;
const DOOR_OPEN = 1.65;
/** Where a roof sits: on top of the walls. */
const ROOF_HEIGHT = 2.4;

type Role =
    | 'wood'
    | 'dark'
    | 'brass'
    | 'iron'
    | 'cloth'
    | 'pillow'
    | 'stone'
    | 'mortar';

/** [centre x, centre z, half width, half depth, bottom, top] above the ground. */
type Box = [number, number, number, number, number, number];

interface Shape {
    /** Footprint, along its own X and Z. */
    width: number;
    depth: number;
    health: number;
    /** On the grid's cell edges (walls, doors) or anywhere. */
    edge: boolean;
    /** Covers a whole grid cell, up on top of the walls (a roof). */
    cell?: boolean;
    /** What takes it apart. */
    breaks: ToolKind;
    /** Ground under it may differ by at most this much. */
    slope: number;
    solid: Box[];
}

const SHAPES: Record<StructureType, Shape> = {
    chest: {
        width: 0.9,
        depth: 0.6,
        health: 4,
        edge: false,
        breaks: 'axe',
        slope: 0.45,
        solid: [[0, 0, 0.45, 0.3, -0.6, 0.6]],
    },
    workbench: {
        width: 1.4,
        depth: 0.7,
        health: 5,
        edge: false,
        breaks: 'axe',
        slope: 0.45,
        solid: [[0, 0, 0.7, 0.35, -0.6, 0.95]],
    },
    wood_wall: {
        width: 2,
        depth: 0.2,
        health: 6,
        edge: true,
        breaks: 'axe',
        slope: 1.2,
        solid: [[0, 0, 1, 0.1, -1, 2.4]],
    },
    stone_wall: {
        width: 2,
        depth: 0.24,
        health: 16,
        edge: true,
        breaks: 'pickaxe',
        slope: 1.2,
        solid: [[0, 0, 1, 0.12, -1, 2.4]],
    },
    wood_roof: {
        width: 2,
        depth: 2,
        health: 5,
        edge: false,
        cell: true,
        breaks: 'axe',
        slope: 2,
        solid: [[0, 0, 1, 1, ROOF_HEIGHT, ROOF_HEIGHT + 0.16]],
    },
    wood_door: {
        width: 2,
        depth: 0.2,
        health: 5,
        edge: true,
        breaks: 'axe',
        slope: 1.2,
        solid: [
            [-0.75, 0, 0.25, 0.1, -1, 2.4],
            [0.75, 0, 0.25, 0.1, -1, 2.4],
            [0, 0, 0.5, 0.1, 2.1, 2.4],
        ],
    },
    sleeping_bag: {
        width: 0.8,
        depth: 1.9,
        health: 2,
        edge: false,
        breaks: 'axe',
        slope: 0.35,
        solid: [],
    },
};

/** The door leaf, which only blocks the way while closed. */
const DOOR_LEAF: Box = [0, 0, 0.5, 0.06, -1, 2.1];

const PAINT: Record<Role, THREE.MeshStandardMaterial> = {
    wood: new THREE.MeshStandardMaterial({ color: 0xb48a60, roughness: 0.85 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x8c6a48, roughness: 0.9 }),
    brass: new THREE.MeshStandardMaterial({
        color: 0xd8c27a,
        roughness: 0.4,
        metalness: 0.5,
    }),
    iron: new THREE.MeshStandardMaterial({
        color: 0x9aa1a8,
        roughness: 0.45,
        metalness: 0.5,
    }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x7f9a72, roughness: 0.95 }),
    pillow: new THREE.MeshStandardMaterial({
        color: 0xefe6d8,
        roughness: 0.95,
    }),
    stone: new THREE.MeshStandardMaterial({
        color: 0xb0aea8,
        roughness: 0.95,
        flatShading: true,
    }),
    mortar: new THREE.MeshStandardMaterial({
        color: 0x86837d,
        roughness: 1,
    }),
};

const GHOST = {
    ok: new THREE.MeshBasicMaterial({
        color: 0x7ed38a,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
    }),
    no: new THREE.MeshBasicMaterial({
        color: 0xe0705f,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
    }),
};

interface Blueprint {
    fixed: [Role, THREE.BufferGeometry][];
    /** A door leaf or a chest lid, drawn around `hinge`. */
    moving: [Role, THREE.BufferGeometry][];
    hinge: THREE.Vector3 | null;
}

function block(
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
): THREE.BufferGeometry {
    return new THREE.BoxGeometry(width, height, depth).translate(x, y, z);
}

function merge(parts: [Role, THREE.BufferGeometry][]) {
    const byRole = new Map<Role, THREE.BufferGeometry[]>();

    for (const [role, geometry] of parts) {
        byRole.set(role, [...(byRole.get(role) ?? []), geometry]);
    }

    return [...byRole].map(
        ([role, geometries]) =>
            [role, mergeGeometries(geometries)] as [Role, THREE.BufferGeometry],
    );
}

function design(type: GhostType): Blueprint {
    const fixed: [Role, THREE.BufferGeometry][] = [];
    const moving: [Role, THREE.BufferGeometry][] = [];
    let hinge: THREE.Vector3 | null = null;

    switch (type) {
        case 'chest':
            fixed.push(
                ['wood', block(0.9, 0.42, 0.58, 0, 0.21, 0)],
                ['dark', block(0.06, 0.43, 0.6, 0.3, 0.215, 0)],
                ['dark', block(0.06, 0.43, 0.6, -0.3, 0.215, 0)],
                ['brass', block(0.1, 0.12, 0.03, 0, 0.36, 0.3)],
            );
            hinge = new THREE.Vector3(0, 0.42, -0.29);
            moving.push(
                ['wood', block(0.92, 0.16, 0.6, 0, 0.08, 0.3)],
                ['dark', block(0.07, 0.17, 0.62, 0.3, 0.08, 0.3)],
                ['dark', block(0.07, 0.17, 0.62, -0.3, 0.08, 0.3)],
            );
            break;
        case 'workbench':
            fixed.push(
                ['wood', block(1.4, 0.1, 0.7, 0, 0.9, 0)],
                ['dark', block(1.3, 0.05, 0.6, 0, 0.3, 0)],
                ['iron', block(0.18, 0.12, 0.14, 0.52, 1.01, 0.2)],
                ['iron', block(0.45, 0.02, 0.12, -0.3, 0.96, 0.08)],
                ['dark', block(0.3, 0.04, 0.04, 0.02, 0.97, -0.15)],
                ['iron', block(0.06, 0.08, 0.12, 0.18, 0.99, -0.15)],
            );

            for (const [x, z] of [
                [0.6, 0.27],
                [-0.6, 0.27],
                [0.6, -0.27],
                [-0.6, -0.27],
            ]) {
                fixed.push(['dark', block(0.1, 0.9, 0.1, x, 0.42, z)]);
            }

            break;
        case 'wood_wall':
            for (let plank = 0; plank < 5; plank++) {
                fixed.push([
                    'wood',
                    block(0.38, 3.1, 0.12, -0.8 + plank * 0.4, 0.85, 0),
                ]);
            }

            fixed.push(
                ['dark', block(2, 0.16, 0.2, 0, 0.35, 0)],
                ['dark', block(2, 0.16, 0.2, 0, 1.95, 0)],
                ['dark', block(0.14, 3.1, 0.22, 0.95, 0.85, 0)],
                ['dark', block(0.14, 3.1, 0.22, -0.95, 0.85, 0)],
            );
            break;
        case 'stone_wall':
            fixed.push(['mortar', block(1.96, 2.5, 0.16, 0, 1.15, 0)]);

            for (let row = 0; row < 6; row++) {
                const offset = row % 2 ? 0.25 : 0;
                const y = 0.15 + row * 0.42;

                for (let stone = -2; stone <= 2; stone++) {
                    const x = stone * 0.5 + offset;
                    const left = Math.max(-0.98, x - 0.23);
                    const right = Math.min(0.98, x + 0.23);

                    if (right - left > 0.1) {
                        fixed.push([
                            'stone',
                            block(
                                right - left,
                                0.36,
                                0.24,
                                (left + right) / 2,
                                y,
                                0,
                            ),
                        ]);
                    }
                }
            }

            break;
        case 'wood_roof':
            for (let plank = 0; plank < 5; plank++) {
                fixed.push([
                    'wood',
                    block(
                        0.38,
                        0.08,
                        2,
                        -0.8 + plank * 0.4,
                        ROOF_HEIGHT + 0.12,
                        0,
                    ),
                ]);
            }

            fixed.push(
                ['dark', block(2, 0.08, 0.16, 0, ROOF_HEIGHT + 0.04, 0.92)],
                ['dark', block(2, 0.08, 0.16, 0, ROOF_HEIGHT + 0.04, -0.92)],
                ['dark', block(0.16, 0.08, 2, 0, ROOF_HEIGHT + 0.04, 0)],
            );
            break;
        case 'wood_door':
            for (const side of [1, -1]) {
                fixed.push(
                    ['wood', block(0.44, 3.1, 0.12, side * 0.74, 0.85, 0)],
                    ['dark', block(0.14, 3.1, 0.22, side * 0.95, 0.85, 0)],
                    ['dark', block(0.08, 3.1, 0.2, side * 0.53, 0.85, 0)],
                    ['dark', block(0.5, 0.16, 0.2, side * 0.75, 0.35, 0)],
                    ['dark', block(0.5, 0.16, 0.2, side * 0.75, 1.95, 0)],
                );
            }

            fixed.push(['wood', block(1.0, 0.3, 0.14, 0, 2.25, 0)]);
            hinge = new THREE.Vector3(-0.5, 0, 0);
            moving.push(
                ['wood', block(0.47, 2.08, 0.08, 0.255, 1.04, 0)],
                ['wood', block(0.47, 2.08, 0.08, 0.745, 1.04, 0)],
                ['dark', block(0.92, 0.12, 0.1, 0.5, 0.5, 0)],
                ['dark', block(0.92, 0.12, 0.1, 0.5, 1.6, 0)],
                ['brass', block(0.05, 0.15, 0.06, 0.88, 1.0, 0.07)],
                ['brass', block(0.05, 0.15, 0.06, 0.88, 1.0, -0.07)],
            );
            break;
        case 'campfire':
            for (let stone = 0; stone < 8; stone++) {
                const angle = (stone / 8) * Math.PI * 2;
                fixed.push([
                    'dark',
                    block(
                        0.2,
                        0.14,
                        0.2,
                        Math.cos(angle) * 0.55,
                        0.07,
                        Math.sin(angle) * 0.55,
                    ),
                ]);
            }

            fixed.push(['wood', block(0.7, 0.12, 0.12, 0, 0.12, 0)]);
            break;
        case 'sleeping_bag':
            fixed.push(
                ['cloth', block(0.8, 0.13, 1.5, 0, 0.065, 0.2)],
                ['pillow', block(0.7, 0.15, 0.4, 0, 0.075, -0.75)],
                ['dark', block(0.82, 0.02, 0.06, 0, 0.13, -0.4)],
            );
            break;
    }

    return { fixed: merge(fixed), moving: merge(moving), hinge };
}

const BLUEPRINTS = new Map<GhostType, Blueprint>();

function blueprint(type: GhostType): Blueprint {
    let found = BLUEPRINTS.get(type);

    if (!found) {
        found = design(type);
        BLUEPRINTS.set(type, found);
    }

    return found;
}

interface Built {
    group: THREE.Group;
    pivot: THREE.Group | null;
}

function build(
    type: GhostType,
    paint: (role: Role) => THREE.Material,
    shadows: boolean,
): Built {
    const plan = blueprint(type);
    const group = new THREE.Group();
    const mesh = (role: Role, geometry: THREE.BufferGeometry) => {
        const made = new THREE.Mesh(geometry, paint(role));
        made.castShadow = shadows;
        made.receiveShadow = shadows;

        return made;
    };

    for (const [role, geometry] of plan.fixed) {
        group.add(mesh(role, geometry));
    }

    let pivot: THREE.Group | null = null;

    if (plan.hinge) {
        pivot = new THREE.Group();
        pivot.position.copy(plan.hinge);

        for (const [role, geometry] of plan.moving) {
            pivot.add(mesh(role, geometry));
        }

        group.add(pivot);
    }

    return { group, pivot };
}

export interface Structure {
    kind: 'structure';
    type: StructureType;
    x: number;
    z: number;
    /** A multiple of a right angle. */
    yaw: number;
    ground: number;
    health: number;
    maxHealth: number;
    group: THREE.Group;
    pivot: THREE.Group | null;
    colliders: BoxCollider[];
    /** The door leaf's collider. */
    leaf: BoxCollider | null;
    open: boolean;
    /** How far the door or lid has swung, 0…1. */
    swing: number;
    /** A chest's slots. */
    items: (Stack | null)[] | null;
    /** The sleeping bag the player wakes up at. */
    spawn: boolean;
    shake: number;
}

export interface PlacedStructure {
    type: StructureType;
    x: number;
    z: number;
    yaw: number;
    items?: (Stack | null)[];
    open?: boolean;
    spawn?: boolean;
}

export interface Spot {
    x: number;
    z: number;
    yaw: number;
}

export function isStructureType(value: unknown): value is StructureType {
    return STRUCTURE_TYPES.includes(value as StructureType);
}

/** Right angles only: 0…3 quarter turns. */
function quarters(yaw: number): number {
    return ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;
}

/** A box of the shape, turned with the building and placed in the world. */
function worldBox(
    box: Box,
    x: number,
    z: number,
    yaw: number,
    ground: number,
): BoxCollider {
    const [cx, cz, hx, hz, bottom, top] = box;
    const turns = quarters(yaw);
    const cos = Math.round(Math.cos(turns * (Math.PI / 2)));
    const sin = Math.round(Math.sin(turns * (Math.PI / 2)));
    const centreX = x + cx * cos + cz * sin;
    const centreZ = z - cx * sin + cz * cos;
    const halfX = turns % 2 ? hz : hx;
    const halfZ = turns % 2 ? hx : hz;

    return {
        kind: 'box',
        min: new THREE.Vector3(
            centreX - halfX,
            ground + bottom,
            centreZ - halfZ,
        ),
        max: new THREE.Vector3(centreX + halfX, ground + top, centreZ + halfZ),
    };
}

export class Structures {
    readonly group = new THREE.Group();
    readonly list: Structure[] = [];

    private ghost: {
        type: GhostType;
        built: Built;
        ok: boolean;
    } | null = null;
    private probe = new THREE.Vector3();

    constructor(private colliders: ColliderGrid) {}

    /** Rebuilds what a saved game had put up. */
    load(placed: unknown): void {
        if (!Array.isArray(placed)) {
            return;
        }

        for (const entry of placed) {
            if (
                !isStructureType(entry?.type) ||
                !Number.isFinite(entry.x) ||
                !Number.isFinite(entry.z) ||
                this.list.length >= MAX_STRUCTURES
            ) {
                continue;
            }

            const structure = this.place(
                entry.type,
                entry.x,
                entry.z,
                Number.isFinite(entry.yaw) ? entry.yaw : 0,
            );

            if (structure.items && Array.isArray(entry.items)) {
                entry.items
                    .slice(0, CHEST_SLOTS)
                    .forEach((slot: unknown, index: number) => {
                        structure.items![index] = readStack(slot);
                    });
            }

            if (entry.type === 'wood_door' && entry.open === true) {
                this.toggleDoor(structure);
            }

            structure.spawn =
                entry.type === 'sleeping_bag' && entry.spawn === true;
        }
    }

    placedList(): PlacedStructure[] {
        return this.list.map((structure) => {
            const placed: PlacedStructure = {
                type: structure.type,
                x: structure.x,
                z: structure.z,
                yaw: structure.yaw,
            };

            if (structure.items) {
                placed.items = structure.items.map((slot) =>
                    slot ? { ...slot } : null,
                );
            }

            if (structure.type === 'wood_door') {
                placed.open = structure.open;
            }

            if (structure.type === 'sleeping_bag') {
                placed.spawn = structure.spawn;
            }

            return placed;
        });
    }

    get full(): boolean {
        return this.list.length >= MAX_STRUCTURES;
    }

    /**
     * Where a building would go for someone standing at `position`, facing
     * `facing`: walls and doors on the nearest grid edge across the way,
     * everything else a little ahead, turned to face them.
     */
    spot(type: StructureType, position: THREE.Vector3, facing: number): Spot {
        const forwardX = Math.sin(facing);
        const forwardZ = Math.cos(facing);

        if (SHAPES[type].edge) {
            const aheadX = position.x + forwardX * 1.6;
            const aheadZ = position.z + forwardZ * 1.6;

            // Across the way the player looks: a wall along X when looking along Z.
            if (Math.abs(forwardZ) >= Math.abs(forwardX)) {
                return {
                    x: Math.floor(aheadX / GRID) * GRID + GRID / 2,
                    z: Math.round(aheadZ / GRID) * GRID,
                    yaw: forwardZ > 0 ? Math.PI : 0,
                };
            }

            return {
                x: Math.round(aheadX / GRID) * GRID,
                z: Math.floor(aheadZ / GRID) * GRID + GRID / 2,
                yaw: forwardX > 0 ? -Math.PI / 2 : Math.PI / 2,
            };
        }

        if (SHAPES[type].cell) {
            return {
                x: Math.floor((position.x + forwardX * 0.9) / GRID) * GRID + 1,
                z: Math.floor((position.z + forwardZ * 0.9) / GRID) * GRID + 1,
                yaw: 0,
            };
        }

        const reach = RADIUS + 0.35 + SHAPES[type].depth / 2;

        return {
            x: Math.round((position.x + forwardX * reach) * 4) / 4,
            z: Math.round((position.z + forwardZ * reach) * 4) / 4,
            yaw: quarters(facing + Math.PI) * (Math.PI / 2),
        };
    }

    /**
     * Whether it fits there: dry, flat enough, clear of everything solid
     * and of the player.
     */
    fits(type: StructureType, spot: Spot, player: THREE.Vector3): boolean {
        const shape = SHAPES[type];

        if (this.full) {
            return false;
        }

        if (shape.cell) {
            // Up on the walls: anywhere dry that has no roof yet.
            return (
                this.base(type, spot.x, spot.z) > WATER_LEVEL + 0.1 &&
                !this.list.some(
                    (structure) =>
                        structure.type === type &&
                        structure.x === spot.x &&
                        structure.z === spot.z,
                )
            );
        }

        const turns = quarters(spot.yaw);
        const halfX = (turns % 2 ? shape.depth : shape.width) / 2;
        const halfZ = (turns % 2 ? shape.width : shape.depth) / 2;
        let low = Infinity;
        let high = -Infinity;

        for (const [dx, dz] of [
            [0, 0],
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
        ]) {
            const ground = heightAt(spot.x + dx * halfX, spot.z + dz * halfZ);
            low = Math.min(low, ground);
            high = Math.max(high, ground);
        }

        if (low < WATER_LEVEL + 0.1 || high - low > shape.slope) {
            return false;
        }

        const ground = heightAt(spot.x, spot.z);

        // Not on top of anything solid: a few points along its length.
        const along = Math.max(halfX, halfZ) - 0.3;
        const samples = along > 0.4 ? 5 : 1;

        for (let index = 0; index < samples; index++) {
            const offset =
                samples === 1
                    ? 0
                    : -along + (2 * along * index) / (samples - 1);
            this.probe.set(
                spot.x + (halfX >= halfZ ? offset : 0),
                ground + 0.15,
                spot.z + (halfX >= halfZ ? 0 : offset),
            );

            if (
                this.colliders.blocked(
                    this.probe,
                    Math.min(halfX, halfZ, 0.35),
                    1.2,
                )
            ) {
                return false;
            }
        }

        // Not on the player.
        const nearestX = Math.max(
            spot.x - halfX,
            Math.min(spot.x + halfX, player.x),
        );
        const nearestZ = Math.max(
            spot.z - halfZ,
            Math.min(spot.z + halfZ, player.z),
        );

        return (
            shape.solid.length === 0 ||
            Math.hypot(player.x - nearestX, player.z - nearestZ) >
                RADIUS + 0.05 ||
            player.y > ground + 2.5
        );
    }

    /** Puts a building up (no checks — see fits()). */
    place(type: StructureType, x: number, z: number, yaw: number): Structure {
        const shape = SHAPES[type];
        const ground = this.base(type, x, z);
        const turned = quarters(yaw) * (Math.PI / 2);
        const built = build(type, (role) => PAINT[role], true);
        built.group.position.set(x, ground, z);
        built.group.rotation.y = turned;
        this.group.add(built.group);

        const colliders = shape.solid.map((box) =>
            worldBox(box, x, z, turned, ground),
        );
        let leaf: BoxCollider | null = null;

        if (type === 'wood_door') {
            leaf = worldBox(DOOR_LEAF, x, z, turned, ground);
            colliders.push(leaf);
        }

        for (const collider of colliders) {
            this.colliders.add(collider);
        }

        const structure: Structure = {
            kind: 'structure',
            type,
            x,
            z,
            yaw: turned,
            ground,
            health: shape.health,
            maxHealth: shape.health,
            group: built.group,
            pivot: built.pivot,
            colliders,
            leaf,
            open: false,
            swing: 0,
            items:
                type === 'chest'
                    ? Array.from({ length: CHEST_SLOTS }, () => null)
                    : null,
            spawn: false,
            shake: 0,
        };

        this.list.push(structure);

        return structure;
    }

    /**
     * Shows where the held building would go (null hides it): green when
     * it fits, red when not.
     */
    showGhost(type: GhostType | null, spot: Spot | null, ok: boolean): void {
        if (!type || !spot) {
            if (this.ghost) {
                this.ghost.built.group.visible = false;
            }

            return;
        }

        if (!this.ghost || this.ghost.type !== type) {
            if (this.ghost) {
                this.group.remove(this.ghost.built.group);
            }

            const built = build(type, () => GHOST.ok, false);
            built.group.renderOrder = 2;
            this.group.add(built.group);
            this.ghost = { type, built, ok: true };
        }

        const group = this.ghost.built.group;
        group.visible = true;
        group.position.set(spot.x, this.base(type, spot.x, spot.z), spot.z);
        group.rotation.y = quarters(spot.yaw) * (Math.PI / 2);

        if (this.ghost.ok !== ok) {
            this.ghost.ok = ok;
            group.traverse((node) => {
                if (node instanceof THREE.Mesh) {
                    node.material = ok ? GHOST.ok : GHOST.no;
                }
            });
        }
    }

    /** How far a point is from the building's footprint, on the ground. */
    distance(structure: Structure, position: THREE.Vector3): number {
        return Math.hypot(...this.offset(structure, position));
    }

    /** The building right in front, within reach. */
    target(
        position: THREE.Vector3,
        facing: number,
        reach = 1.4,
    ): Structure | null {
        const forwardX = Math.sin(facing);
        const forwardZ = Math.cos(facing);
        let best: Structure | null = null;
        let bestDistance = reach;

        for (const structure of this.list) {
            if (Math.abs(structure.ground - position.y) > 2.2) {
                continue;
            }

            const [dx, dz] = this.offset(structure, position);
            const flat = Math.hypot(dx, dz);
            // A roof is up above the head: that far away even right under it.
            const above = SHAPES[structure.type].cell
                ? Math.max(
                      0,
                      structure.ground + ROOF_HEIGHT - (position.y + 1.7),
                  )
                : 0;
            const distance = Math.hypot(flat, above);

            if (
                distance < bestDistance &&
                (distance < 0.35 ||
                    (flat > 0.05 &&
                        (dx * forwardX + dz * forwardZ) / flat > 0.2))
            ) {
                best = structure;
                bestDistance = distance;
            }
        }

        return best;
    }

    /**
     * An axe blow. Answers what comes back when it falls apart: the
     * building itself and whatever a chest held; null while it stands.
     */
    hit(structure: Structure, power: number): Stack[] | null {
        structure.health -= power;
        structure.shake = 1;

        if (structure.health > 0) {
            return null;
        }

        this.remove(structure);

        return [
            { item: structure.type as ItemId, count: 1 },
            ...(structure.items ?? []).filter((slot) => slot !== null),
        ];
    }

    /** What takes the building apart: an axe, or a pickaxe for stone. */
    breaksWith(type: StructureType): ToolKind {
        return SHAPES[type].breaks;
    }

    /** Whether E does anything with it (walls and roofs just stand there). */
    usable(type: StructureType): boolean {
        return (
            type === 'chest' ||
            type === 'workbench' ||
            type === 'wood_door' ||
            type === 'sleeping_bag'
        );
    }

    toggleDoor(door: Structure): void {
        door.open = !door.open;

        if (door.leaf) {
            door.leaf.disabled = door.open;
        }
    }

    /** Whether a closed door can swing shut: nobody in the doorway. */
    canClose(door: Structure, player: THREE.Vector3): boolean {
        const leaf = door.leaf!;

        return !(
            player.x > leaf.min.x - RADIUS &&
            player.x < leaf.max.x + RADIUS &&
            player.z > leaf.min.z - RADIUS &&
            player.z < leaf.max.z + RADIUS
        );
    }

    /** Makes this sleeping bag the one to wake up at. */
    setSpawn(bag: Structure): void {
        for (const structure of this.list) {
            structure.spawn = structure === bag;
        }
    }

    /** Where to wake up: in front of the chosen sleeping bag. */
    spawnPoint(): THREE.Vector3 | null {
        const bag = this.list.find((structure) => structure.spawn);

        return bag ? new THREE.Vector3(bag.x, bag.ground, bag.z) : null;
    }

    /** Whether a building of the type is within reach (a workbench to work at). */
    near(position: THREE.Vector3, type: StructureType, reach = 3.5): boolean {
        return this.list.some(
            (structure) =>
                structure.type === type &&
                Math.hypot(structure.x - position.x, structure.z - position.z) <
                    reach,
        );
    }

    /** Buildings farther than `reach` are not drawn. */
    cull(center: THREE.Vector3, reach: number): void {
        const reach2 = reach * reach;

        for (const structure of this.list) {
            const dx = structure.x - center.x;
            const dz = structure.z - center.z;
            structure.group.visible = dx * dx + dz * dz < reach2;
        }
    }

    update(dt: number): void {
        for (const structure of this.list) {
            const wanted = structure.open ? 1 : 0;

            if (structure.swing !== wanted) {
                structure.swing +=
                    Math.sign(wanted - structure.swing) *
                    Math.min(Math.abs(wanted - structure.swing), dt * 3);

                if (structure.pivot) {
                    const ease =
                        structure.swing *
                        structure.swing *
                        (3 - 2 * structure.swing);

                    if (structure.type === 'wood_door') {
                        structure.pivot.rotation.y = ease * DOOR_OPEN;
                    } else {
                        structure.pivot.rotation.x = -ease * 1.2;
                    }
                }
            }

            if (structure.shake > 0) {
                structure.shake = Math.max(0, structure.shake - dt * 5);
                const jitter = structure.shake * 0.03;
                structure.group.position.set(
                    structure.x + (Math.random() - 0.5) * jitter,
                    structure.ground,
                    structure.z + (Math.random() - 0.5) * jitter,
                );
            }
        }
    }

    /**
     * The height a building stands on: the ground at its middle, or for a
     * roof the highest ground under its cell (so it clears every wall).
     */
    private base(type: GhostType, x: number, z: number): number {
        if (type === 'campfire' || !SHAPES[type].cell) {
            return heightAt(x, z);
        }

        let high = heightAt(x, z);

        for (const [dx, dz] of [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
        ]) {
            high = Math.max(high, heightAt(x + dx, z + dz));
        }

        return high;
    }

    /** From a point to the nearest spot of the building's footprint. */
    private offset(
        structure: Structure,
        position: THREE.Vector3,
    ): [number, number] {
        const shape = SHAPES[structure.type];
        const turns = quarters(structure.yaw);
        const halfX = (turns % 2 ? shape.depth : shape.width) / 2;
        const halfZ = (turns % 2 ? shape.width : shape.depth) / 2;
        const nearestX = Math.max(
            structure.x - halfX,
            Math.min(structure.x + halfX, position.x),
        );
        const nearestZ = Math.max(
            structure.z - halfZ,
            Math.min(structure.z + halfZ, position.z),
        );

        return [nearestX - position.x, nearestZ - position.z];
    }

    private remove(structure: Structure): void {
        this.group.remove(structure.group);
        this.list.splice(this.list.indexOf(structure), 1);

        for (const collider of structure.colliders) {
            collider.disabled = true;
        }
    }
}
