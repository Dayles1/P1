/**
 * The three clan villages of Qing Mao Mountain (qingmao.ts), built the
 * way the novel tells it: bamboo houses raised on stilts round a square,
 * their roofs curving up at the corners, the clan head's hall above the
 * square, all of it inside a palisade with a roofed gate and watchtowers,
 * bamboo groves outside.
 *
 * - Gu Yue (古月, "ancient moon"): bamboo walls, blue-grey tiles, banners
 *   with a pale crescent; the clan academy with its training yard, a
 *   tavern under a wine flag, a stone stele on the square;
 * - Bai (白, "white"): whitewashed walls in a dark timber frame, white
 *   lanterns, white banners;
 * - Xiong (熊, "bear"): heavy log walls, brown roofs, a bear totem.
 *
 * At night the paper windows and the lanterns glow. Everything is solid:
 * houses are boxes one cannot walk into, verandas and steps can be walked
 * on, the palisade's stakes keep everyone to the gates.
 *
 * A village is merged into one mesh per material, so it costs a handful
 * of draw calls; the stakes and the bamboo are instanced.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ColliderGrid } from '../physics/colliders';
import { createRandom } from './noise';
import { gateAt, HOME, pathDistance, PATH_HALF, VILLAGES } from './qingmao';
import type { Clan, Village } from './qingmao';
import { heightAt, SPAWN_RADIUS } from './terrain';

/** The materials a village is made of. */
type Kind = 'bamboo' | 'logs' | 'tile' | 'plain' | 'glow';

const KINDS: Kind[] = ['bamboo', 'logs', 'tile', 'plain', 'glow'];

interface Style {
    walls: 'bamboo' | 'plain' | 'logs';
    wall: number;
    /** Posts, beams, stilts, railings. */
    timber: number;
    roof: number;
    ridge: number;
    /** The great hall's pillars and doors. */
    lacquer: number;
    stone: number;
    /** Lit paper windows and lanterns. */
    paper: number;
    lantern: number;
    cloth: number;
    emblem: number;
    stake: number;
}

const STYLES: Record<Clan, Style> = {
    gu_yue: {
        walls: 'bamboo',
        wall: 0xa49c6c,
        timber: 0x4a3a2a,
        roof: 0x3b434c,
        ridge: 0x23282e,
        lacquer: 0x5c2722,
        stone: 0x7a776f,
        paper: 0xc9a462,
        lantern: 0xd2562e,
        cloth: 0x22304a,
        emblem: 0xc8d3df,
        stake: 0x7d7650,
    },
    bai: {
        walls: 'plain',
        wall: 0xcfcabd,
        timber: 0x3e3328,
        roof: 0x474a4f,
        ridge: 0x2a2c30,
        lacquer: 0x4a4440,
        stone: 0x8a877f,
        paper: 0xcdb070,
        lantern: 0xe6dcc0,
        cloth: 0xd9d5cc,
        emblem: 0x2c2c30,
        stake: 0x857f72,
    },
    xiong: {
        walls: 'logs',
        wall: 0x6a5038,
        timber: 0x3a2a1d,
        roof: 0x5b4a33,
        ridge: 0x3a2f22,
        lacquer: 0x4a2a1a,
        stone: 0x6f6a60,
        paper: 0xc0944f,
        lantern: 0xc9682a,
        cloth: 0x3b281c,
        emblem: 0xb9893e,
        stake: 0x5e4a36,
    },
};

/** How a roof's slope sags: steep at the ridge, flat at the eaves. */
const SAG = 1.6;
/** The stakes of the palisade: spacing, height (m), and the gap at a gate. */
const STAKE_STEP = 0.55;
const STAKE_HEIGHT = 3.4;
const GATE_HALF = 3.2;
const MAX_STAKES = 2000;
const MAX_CULMS = 2600;

/** A stilt house's floor height above the ground, its veranda's depth. */
const FLOOR = 1.2;
const VERANDA = 1.4;
const STEP_RISE = 0.3;
const STEP_RUN = 0.35;

/** A grey texture with lines, tinted by the parts' colours; UVs are metres. */
function stripes(
    draw: (context: CanvasRenderingContext2D, size: number) => void,
    repeatU: number,
    repeatV: number,
): THREE.CanvasTexture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d')!;

    context.fillStyle = '#f0f0f0';
    context.fillRect(0, 0, size, size);
    draw(context, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1 / repeatU, 1 / repeatV);
    texture.anisotropy = 8;

    return texture;
}

/** Upright culms, a node across each now and then. */
function bambooTexture(): THREE.CanvasTexture {
    return stripes(
        (context, size) => {
            for (let x = 0; x < size; x += 8) {
                context.fillStyle = '#9c9c9c';
                context.fillRect(x, 0, 1, size);
                context.fillStyle = '#dadada';
                context.fillRect(x + 3, 0, 2, size);
                context.fillStyle = '#8a8a8a';
                context.fillRect(x, (x * 7) % size, 8, 2);
            }
        },
        0.8,
        1.6,
    );
}

/** Logs lying one on another. */
function logTexture(): THREE.CanvasTexture {
    return stripes(
        (context, size) => {
            for (let y = 0; y < size; y += 16) {
                context.fillStyle = '#8c8c8c';
                context.fillRect(0, y, size, 2);
                context.fillStyle = '#c4c4c4';
                context.fillRect(0, y + 10, size, 3);
            }
        },
        1.6,
        1,
    );
}

/** Rows of curved tiles down a roof. */
function tileTexture(): THREE.CanvasTexture {
    return stripes(
        (context, size) => {
            for (let x = 0; x < size; x += 8) {
                context.fillStyle = '#a8a8a8';
                context.fillRect(x, 0, 2, size);
                context.fillStyle = '#ffffff';
                context.fillRect(x + 4, 0, 2, size);
            }

            for (let y = 0; y < size; y += 16) {
                context.fillStyle = '#7c7c7c';
                context.fillRect(0, y, size, 2);
            }
        },
        1.2,
        1.2,
    );
}

function materials(): Record<Kind, THREE.Material> {
    const textured = (map: THREE.Texture, extra = {}) =>
        new THREE.MeshStandardMaterial({
            vertexColors: true,
            map,
            roughness: 0.9,
            ...extra,
        });

    return {
        bamboo: textured(bambooTexture()),
        logs: textured(logTexture()),
        tile: textured(tileTexture(), {
            roughness: 0.75,
            side: THREE.DoubleSide,
        }),
        plain: new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.9,
        }),
        glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
    };
}

/** An axis-aligned box in a building's own space: [x0, y0, z0, x1, y1, z1]. */
type Bounds = [number, number, number, number, number, number];

/**
 * Collects a village's parts by material, each placed in the frame of the
 * building being made, and the boxes one bumps into.
 */
class Builder {
    readonly parts: Record<Kind, THREE.BufferGeometry[]> = {
        bamboo: [],
        logs: [],
        tile: [],
        plain: [],
        glow: [],
    };
    /** Where the building stands, turned; set by `at`. */
    private frame = new THREE.Matrix4();
    private quarter = 0;
    private local = new THREE.Matrix4();
    private euler = new THREE.Euler();
    private color = new THREE.Color();
    private corner = new THREE.Vector3();

    constructor(private colliders: ColliderGrid) {}

    /** Starts a building at (x, z) on the ground, turned by `quarters` × 90° (front to +z at 0). */
    at(x: number, z: number, quarters: number, ground = heightAt(x, z)): this {
        this.quarter = ((quarters % 4) + 4) % 4;
        this.frame.makeRotationY((this.quarter * Math.PI) / 2);
        this.frame.setPosition(x, ground, z);

        return this;
    }

    /** Like `at`, but turned freely (for gates on a round palisade): no box colliders. */
    turned(x: number, z: number, yaw: number, ground = heightAt(x, z)): this {
        this.quarter = -1;
        this.frame.makeRotationY(yaw);
        this.frame.setPosition(x, ground, z);

        return this;
    }

    box(
        kind: Kind,
        color: number,
        x: number,
        y: number,
        z: number,
        width: number,
        height: number,
        depth: number,
        tilt?: [number, number, number],
    ): void {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const uv = geometry.getAttribute('uv');

        // UVs in metres, so the textures keep their size on every face.
        for (let i = 0; i < uv.count; i++) {
            const face = Math.floor(i / 4);
            const [u, v] =
                face < 2
                    ? [depth, height]
                    : face < 4
                      ? [width, depth]
                      : [width, height];
            uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
        }

        this.add(kind, color, geometry, x, y, z, tilt);
    }

    cylinder(
        kind: Kind,
        color: number,
        x: number,
        y: number,
        z: number,
        radius: number,
        height: number,
        segments = 8,
        top = radius,
    ): void {
        const geometry = new THREE.CylinderGeometry(
            top,
            radius,
            height,
            segments,
        );
        const uv = geometry.getAttribute('uv');

        for (let i = 0; i < uv.count; i++) {
            uv.setXY(i, uv.getX(i) * Math.PI * 2 * radius, uv.getY(i) * height);
        }

        this.add(kind, color, geometry, x, y, z);
    }

    /** Any shape, already in metres. */
    add(
        kind: Kind,
        color: number,
        source: THREE.BufferGeometry,
        x: number,
        y: number,
        z: number,
        tilt?: [number, number, number],
    ): void {
        const geometry = source.index ? source.toNonIndexed() : source;

        if (geometry !== source) {
            source.dispose();
        }

        this.local.makeRotationFromEuler(
            this.euler.set(...(tilt ?? [0, 0, 0])),
        );
        this.local.setPosition(x, y, z);
        geometry.applyMatrix4(this.local.premultiply(this.frame));

        this.color.setHex(color);
        const colors = new Float32Array(
            geometry.getAttribute('position').count * 3,
        );

        for (let i = 0; i < colors.length; i += 3) {
            this.color.toArray(colors, i);
        }

        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        if (!geometry.getAttribute('uv')) {
            geometry.setAttribute(
                'uv',
                new THREE.BufferAttribute(
                    new Float32Array(
                        geometry.getAttribute('position').count * 2,
                    ),
                    2,
                ),
            );
        }

        geometry.deleteAttribute('normal');
        geometry.computeVertexNormals();
        this.parts[kind].push(geometry);
    }

    /** A solid box, in the building's own space. */
    solid(...bounds: Bounds): void {
        if (this.quarter < 0) {
            return;
        }

        const min = new THREE.Vector3(Infinity, Infinity, Infinity);
        const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

        for (const cx of [bounds[0], bounds[3]]) {
            for (const cz of [bounds[2], bounds[5]]) {
                for (const cy of [bounds[1], bounds[4]]) {
                    this.corner.set(cx, cy, cz).applyMatrix4(this.frame);
                    min.min(this.corner);
                    max.max(this.corner);
                }
            }
        }

        this.colliders.add({ kind: 'box', min, max });
    }

    /** An upright post one bumps into, in the building's own space. */
    post(x: number, z: number, radius: number, height: number): void {
        this.corner.set(x, 0, z).applyMatrix4(this.frame);
        this.colliders.add({
            kind: 'cylinder',
            x: this.corner.x,
            z: this.corner.z,
            radius,
            bottom: this.corner.y - 1,
            top: this.corner.y + height,
        });
    }

    /**
     * A roof with its ridge along X: two slopes that sag towards the eaves
     * and lift at the corners. `base` is the eaves' height at their lowest.
     */
    roof(
        color: number,
        z: number,
        base: number,
        length: number,
        depth: number,
        rise: number,
        overhang: number,
        lift: number,
    ): void {
        const along = 10;
        const down = 6;
        const half = length / 2 + overhang;
        const reach = depth / 2 + overhang;
        const positions: number[] = [];
        const uvs: number[] = [];
        const point = (side: number, u: number, v: number) => {
            const corner = Math.pow(Math.abs(u * 2 - 1), 4);
            // The ends flare out a little at the eaves.
            const x = (u * 2 - 1) * (half + corner * v * 0.3);
            const y =
                base + rise * Math.pow(1 - v, SAG) + lift * corner * v * v;

            return [x, y, z + side * v * reach, x, v * reach * 1.2];
        };

        for (const side of [1, -1]) {
            for (let i = 0; i < along; i++) {
                for (let j = 0; j < down; j++) {
                    const a = point(side, i / along, j / down);
                    const b = point(side, (i + 1) / along, j / down);
                    const c = point(side, i / along, (j + 1) / down);
                    const d = point(side, (i + 1) / along, (j + 1) / down);

                    for (const vertex of [a, c, b, b, c, d]) {
                        positions.push(vertex[0], vertex[1], vertex[2]);
                        uvs.push(vertex[3], vertex[4]);
                    }
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3),
        );
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        this.add('tile', color, geometry, 0, 0, 0);
    }

    /** The eaves' height at their lowest for a roof to sit on walls `top` high, `depth` deep. */
    static roofBase(
        top: number,
        depth: number,
        rise: number,
        overhang: number,
    ): number {
        const atWall = depth / 2 / (depth / 2 + overhang);

        return top - rise * Math.pow(1 - atWall, SAG);
    }

    /** A triangle of wall under a roof's end, from z0 to z1 at height y, up to `peak`. */
    gable(
        kind: Kind,
        color: number,
        x: number,
        y: number,
        z0: number,
        z1: number,
        peak: number,
    ): void {
        const geometry = new THREE.BufferGeometry();
        const middle = (z0 + z1) / 2;

        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(
                [
                    x,
                    y,
                    z0,
                    x,
                    y,
                    z1,
                    x,
                    y + peak,
                    middle,
                    x,
                    y,
                    z1,
                    x,
                    y,
                    z0,
                    x,
                    y + peak,
                    middle,
                ],
                3,
            ),
        );
        geometry.setAttribute(
            'uv',
            new THREE.Float32BufferAttribute(
                [
                    z0,
                    y,
                    z1,
                    y,
                    middle,
                    y + peak,
                    z1,
                    y,
                    z0,
                    y,
                    middle,
                    y + peak,
                ],
                2,
            ),
        );
        this.add(kind, color, geometry, 0, 0, 0);
    }

    /** Merges what was collected into one mesh per material. */
    build(group: THREE.Group, materials: Record<Kind, THREE.Material>): void {
        for (const kind of KINDS) {
            const parts = this.parts[kind];

            if (!parts.length) {
                continue;
            }

            const mesh = new THREE.Mesh(
                mergeGeometries(parts),
                materials[kind],
            );

            for (const part of parts) {
                part.dispose();
            }

            mesh.castShadow = kind !== 'glow';
            mesh.receiveShadow = true;
            mesh.matrixAutoUpdate = false;
            group.add(mesh);
            this.parts[kind] = [];
        }
    }
}

/** The quarter turn that faces a building at (x, z) towards (tx, tz). */
function facing(x: number, z: number, tx: number, tz: number): number {
    const dx = tx - x;
    const dz = tz - z;

    if (Math.abs(dx) > Math.abs(dz)) {
        return dx > 0 ? 1 : 3;
    }

    return dz > 0 ? 0 : 2;
}

/** A paper window, glowing, in a timber frame with a cross of laths: on a wall facing +z at `z`. */
function paperWindow(
    b: Builder,
    style: Style,
    x: number,
    y: number,
    z: number,
    width = 0.8,
    height = 0.7,
): void {
    b.box('plain', style.timber, x, y, z, width + 0.14, height + 0.14, 0.08);
    b.box('glow', style.paper, x, y, z + 0.045, width, height, 0.02);
    b.box('plain', style.timber, x, y, z + 0.065, 0.05, height, 0.03);
    b.box('plain', style.timber, x, y, z + 0.065, width, 0.05, 0.03);
}

/** A paper lantern hanging at (x, y, z). */
function lantern(
    b: Builder,
    style: Style,
    x: number,
    y: number,
    z: number,
): void {
    b.box('plain', style.timber, x, y + 0.42, z, 0.03, 0.3, 0.03);
    b.cylinder('plain', style.ridge, x, y + 0.24, z, 0.14, 0.06, 8);
    b.cylinder('glow', style.lantern, x, y, z, 0.2, 0.42, 10, 0.2);
    b.cylinder('plain', style.ridge, x, y - 0.24, z, 0.14, 0.06, 8);
}

/** A cloth banner hanging from a pole, the clan's sign on it. */
function banner(
    b: Builder,
    style: Style,
    clan: Clan,
    x: number,
    z: number,
    height = 6,
): void {
    b.cylinder('plain', style.timber, x, height / 2, z, 0.07, height, 6);
    b.box('plain', style.timber, x + 0.45, height - 0.2, z, 1.0, 0.06, 0.06);
    b.box('plain', style.cloth, x + 0.5, height - 1.4, z, 0.8, 2.3, 0.03);
    emblem(b, style, clan, x + 0.5, height - 1.2, z + 0.03);
    emblem(b, style, clan, x + 0.5, height - 1.2, z - 0.03, true);
}

/** The clan's sign, facing +z (or -z): a crescent, a white disc, three claws. */
function emblem(
    b: Builder,
    style: Style,
    clan: Clan,
    x: number,
    y: number,
    z: number,
    back = false,
): void {
    const turn: [number, number, number] = [0, back ? Math.PI : 0, 0];

    if (clan === 'gu_yue') {
        const shape = new THREE.Shape();
        shape.absarc(0, 0, 0.3, Math.PI * 0.35, Math.PI * 1.65, false);
        shape.absarc(0.14, 0, 0.24, Math.PI * 1.45, Math.PI * 0.55, true);
        b.add(
            'plain',
            style.emblem,
            new THREE.ExtrudeGeometry(shape, {
                depth: 0.01,
                bevelEnabled: false,
            }),
            x,
            y,
            z,
            turn,
        );
    } else if (clan === 'bai') {
        b.add(
            'plain',
            style.emblem,
            new THREE.RingGeometry(0.16, 0.28, 20),
            x,
            y,
            z,
            turn,
        );
    } else {
        for (const offset of [-0.16, 0, 0.16]) {
            b.box('plain', style.emblem, x + offset, y, z, 0.06, 0.55, 0.01, [
                0,
                turn[1],
                0.35,
            ]);
        }
    }
}

/**
 * A bamboo house on stilts: a raised floor with a veranda at the front,
 * stairs up to it, a door and paper windows, a railing, a curved roof.
 * `width` across the front, `depth` front to back (without the veranda);
 * two storeys for the tavern.
 */
function stiltHouse(
    b: Builder,
    style: Style,
    width: number,
    depth: number,
    storeys = 1,
): void {
    const wallHeight = 2.5 * storeys + (storeys - 1) * 0.2;
    const top = FLOOR + wallHeight;
    const front = depth / 2;
    const deck = front + VERANDA;
    const walls = style.walls;

    // Stilts under the house and the veranda.
    for (const x of [-width / 2 + 0.2, 0, width / 2 - 0.2]) {
        for (const z of [-front + 0.2, front - 0.2, deck - 0.2]) {
            b.cylinder(
                'plain',
                style.timber,
                x,
                FLOOR / 2,
                z,
                0.12,
                FLOOR + 0.1,
                6,
            );
        }
    }

    b.box(
        'plain',
        style.timber,
        0,
        FLOOR - 0.09,
        VERANDA / 2,
        width,
        0.18,
        depth + VERANDA,
    );
    b.box(
        walls,
        style.wall,
        0,
        FLOOR + wallHeight / 2,
        0,
        width - 0.3,
        wallHeight,
        depth - 0.3,
    );

    // Corner posts and beams.
    for (const x of [-width / 2 + 0.15, width / 2 - 0.15]) {
        for (const z of [-front + 0.15, front - 0.15]) {
            b.box(
                'plain',
                style.timber,
                x,
                FLOOR + wallHeight / 2,
                z,
                0.18,
                wallHeight,
                0.18,
            );
        }
    }

    // A beam along the front at the floor, between the storeys and at the top.
    for (let storey = 0; storey <= storeys; storey++) {
        const y = storey === storeys ? top - 0.08 : FLOOR + 0.08 + storey * 2.7;
        b.box(
            'plain',
            style.timber,
            0,
            y,
            front - 0.12,
            width - 0.2,
            0.12,
            0.08,
        );
    }

    // The door in the middle, a window either side, one on each end.
    b.box(
        'plain',
        style.lacquer,
        0,
        FLOOR + 0.95,
        front - 0.1,
        0.95,
        1.9,
        0.08,
    );

    for (let storey = 0; storey < storeys; storey++) {
        const y = FLOOR + 1.45 + storey * 2.7;

        for (const x of storey
            ? [-width / 4, 0, width / 4]
            : [-width / 4 - 0.2, width / 4 + 0.2]) {
            if (width > 5.5 || storey) {
                paperWindow(b, style, x, y, front - 0.12);
            }
        }
    }

    for (const side of [-1, 1]) {
        b.box(
            'plain',
            style.timber,
            side * (width / 2 - 0.12),
            FLOOR + 1.45,
            0,
            0.08,
            0.84,
            0.94,
        );
        b.box(
            'glow',
            style.paper,
            side * (width / 2 - 0.08),
            FLOOR + 1.45,
            0,
            0.02,
            0.7,
            0.8,
        );
    }

    // The railing round the veranda, open where the stairs come up.
    const railY = FLOOR + 0.85;
    const stairs = 1.3;

    for (let x = -width / 2 + 0.1; x <= width / 2 - 0.05; x += 0.9) {
        if (Math.abs(x) > stairs / 2 + 0.1) {
            b.box(
                'plain',
                style.timber,
                x,
                FLOOR + 0.42,
                deck - 0.08,
                0.07,
                0.85,
                0.07,
            );
        }
    }

    for (const side of [-1, 1]) {
        const from = side * (stairs / 2 + 0.1);
        const to = side * (width / 2 - 0.05);
        b.box(
            'plain',
            style.timber,
            (from + to) / 2,
            railY,
            deck - 0.08,
            Math.abs(to - from),
            0.07,
            0.09,
        );
        b.box(
            'plain',
            style.timber,
            side * (width / 2 - 0.08),
            railY,
            front + VERANDA / 2,
            0.09,
            0.07,
            VERANDA,
        );
        b.box(
            'plain',
            style.timber,
            side * (width / 2 - 0.08),
            FLOOR + 0.42,
            deck - 0.08,
            0.07,
            0.85,
            0.07,
        );
    }

    // Stairs from the ground up to the veranda.
    const steps = Math.round(FLOOR / STEP_RISE) - 1;

    for (let step = 0; step < steps; step++) {
        const height = (step + 1) * STEP_RISE;
        const z = deck + (steps - step - 0.5) * STEP_RUN;
        b.box(
            'plain',
            style.timber,
            0,
            height / 2,
            z,
            stairs,
            height,
            STEP_RUN,
        );
        b.solid(
            -stairs / 2,
            -1,
            z - STEP_RUN / 2,
            stairs / 2,
            height,
            z + STEP_RUN / 2,
        );
    }

    // The roof over the house and the veranda.
    const span = depth + VERANDA;
    const rise = 1.5 + span * 0.1;
    const overhang = 0.9;
    const base = Builder.roofBase(top, span, rise, overhang);
    const peak = rise * Math.pow(1 - 0, SAG) - (top - base);

    b.roof(style.roof, VERANDA / 2, base, width, span, rise, overhang, 0.5);
    b.box(
        'plain',
        style.ridge,
        0,
        base + rise + 0.08,
        VERANDA / 2,
        width + overhang * 2,
        0.22,
        0.28,
    );

    for (const side of [-1, 1]) {
        b.box(
            'plain',
            style.ridge,
            side * (width / 2 + overhang),
            base + rise + 0.3,
            VERANDA / 2,
            0.16,
            0.5,
            0.16,
            [0, 0, side * -0.5],
        );
        b.gable(
            walls,
            style.wall,
            side * (width / 2 - 0.15),
            top,
            -front + 0.15,
            deck - 0.1,
            peak,
        );
    }

    // Solid: the house itself, up to the roof; the veranda to walk on.
    b.solid(-width / 2, -1, -front, width / 2, top + rise, front);
    b.solid(-width / 2, -1, front, width / 2, FLOOR, deck);
    b.solid(-width / 2, FLOOR, deck - 0.15, -stairs / 2, FLOOR + 0.9, deck);
    b.solid(stairs / 2, FLOOR, deck - 0.15, width / 2, FLOOR + 0.9, deck);
}

/**
 * A great hall on a stone platform: the clan head's residence (with a
 * second roof over the first) or the academy. A porch of lacquered
 * pillars at the front, a big double door, lanterns either side.
 */
function hall(
    b: Builder,
    style: Style,
    clan: Clan,
    width: number,
    depth: number,
    twoRoofs: boolean,
): void {
    const plinth = 0.9;
    const porch = 1.6;
    const wallHeight = 3.4;
    const top = plinth + wallHeight;
    const front = depth / 2;

    // The platform and the stairs up it.
    b.box(
        'plain',
        style.stone,
        0,
        plinth / 2,
        porch / 2,
        width + 1.6,
        plinth,
        depth + porch + 1.6,
    );
    b.solid(
        -width / 2 - 0.8,
        -1,
        -front - 0.8,
        width / 2 + 0.8,
        plinth,
        front + porch + 0.8,
    );

    const steps = Math.round(plinth / STEP_RISE);
    const stairs = 3.2;

    for (let step = 0; step < steps; step++) {
        const height = (step + 1) * STEP_RISE - 0.001;
        const z = front + porch + 0.8 + (steps - step - 0.5) * STEP_RUN;
        b.box('plain', style.stone, 0, height / 2, z, stairs, height, STEP_RUN);
        b.solid(
            -stairs / 2,
            -1,
            z - STEP_RUN / 2,
            stairs / 2,
            height,
            z + STEP_RUN / 2,
        );
    }

    b.box(
        style.walls,
        style.wall,
        0,
        plinth + wallHeight / 2,
        0,
        width,
        wallHeight,
        depth,
    );

    // The porch: pillars along the front, a beam over them.
    const pillars = Math.max(4, Math.round(width / 2.6));

    for (let i = 0; i < pillars; i++) {
        const x = -width / 2 + 0.3 + (i * (width - 0.6)) / (pillars - 1);
        b.cylinder(
            'plain',
            style.lacquer,
            x,
            plinth + wallHeight / 2,
            front + porch - 0.3,
            0.18,
            wallHeight,
            10,
        );
        b.cylinder(
            'plain',
            style.stone,
            x,
            plinth + 0.08,
            front + porch - 0.3,
            0.28,
            0.16,
            10,
        );
        b.post(x, front + porch - 0.3, 0.2, top);
    }

    b.box(
        'plain',
        style.lacquer,
        0,
        top - 0.15,
        front + porch - 0.3,
        width,
        0.3,
        0.3,
    );

    // The double door, the clan's sign over it, windows, lanterns.
    b.box('plain', style.lacquer, 0, plinth + 1.3, front + 0.05, 2.2, 2.6, 0.1);
    b.box('plain', style.ridge, 0, plinth + 1.3, front + 0.11, 0.05, 2.6, 0.02);
    b.box('plain', style.ridge, 0, top - 0.55, front + 0.12, 1.6, 0.6, 0.06);
    emblem(b, style, clan, 0, top - 0.55, front + 0.16);

    for (const x of [
        -width / 2 + 1.6,
        -width / 4 - 0.6,
        width / 4 + 0.6,
        width / 2 - 1.6,
    ]) {
        if (Math.abs(x) > 1.8) {
            paperWindow(b, style, x, plinth + 1.9, front + 0.02, 1.1, 1.1);
        }
    }

    for (const x of [-1.9, 1.9]) {
        lantern(b, style, x, top - 0.9, front + porch - 0.3);
    }

    // The roofs.
    const span = depth + porch;
    let rise = 1.8 + span * 0.12;
    let overhang = 1.3;
    let base = Builder.roofBase(top, span, rise, overhang);

    if (twoRoofs) {
        // A short skirt of a roof, then the upper storey with the main roof.
        rise = 1.1;
        base = Builder.roofBase(top, span, rise, overhang);
        b.roof(style.roof, porch / 2, base, width, span, rise, overhang, 0.4);

        const upper = { width: width - 3, depth: depth - 2.4, height: 2.2 };
        const upperTop = top + upper.height + 0.4;
        b.box(
            style.walls,
            style.wall,
            0,
            top + 0.2 + upper.height / 2,
            0,
            upper.width,
            upper.height + 0.4,
            upper.depth,
        );

        for (const x of [-upper.width / 4, upper.width / 4]) {
            paperWindow(b, style, x, top + 1.3, upper.depth / 2 + 0.02);
        }

        rise = 1.8 + upper.depth * 0.12;
        overhang = 1.2;
        base = Builder.roofBase(upperTop, upper.depth, rise, overhang);
        b.roof(
            style.roof,
            0,
            base,
            upper.width,
            upper.depth,
            rise,
            overhang,
            0.6,
        );
        b.box(
            'plain',
            style.ridge,
            0,
            base + rise + 0.1,
            0,
            upper.width + overhang * 2,
            0.3,
            0.34,
        );
        ridgeEnds(b, style, upper.width / 2 + overhang, base + rise, 0);
        b.solid(-width / 2, -1, -front, width / 2, upperTop + rise, front);

        return;
    }

    b.roof(style.roof, porch / 2, base, width, span, rise, overhang, 0.6);
    b.box(
        'plain',
        style.ridge,
        0,
        base + rise + 0.1,
        porch / 2,
        width + overhang * 2,
        0.3,
        0.34,
    );
    ridgeEnds(b, style, width / 2 + overhang, base + rise, porch / 2);

    for (const side of [-1, 1]) {
        b.gable(
            style.walls,
            style.wall,
            (side * width) / 2,
            top,
            -front,
            front + porch - 0.3,
            rise - (top - base),
        );
    }

    b.solid(-width / 2, -1, -front, width / 2, top + rise, front);
}

/** The ridge's ends curling up like tails. */
function ridgeEnds(
    b: Builder,
    style: Style,
    x: number,
    y: number,
    z: number,
): void {
    for (const side of [-1, 1]) {
        b.box('plain', style.ridge, side * x, y + 0.45, z, 0.22, 0.8, 0.22, [
            0,
            0,
            side * -0.45,
        ]);
        b.box(
            'plain',
            style.ridge,
            side * (x + 0.25),
            y + 0.85,
            z,
            0.18,
            0.4,
            0.18,
            [0, 0, side * -1.1],
        );
    }
}

/** A watchtower: four posts, a lookout with a railing, a small roof. */
function tower(b: Builder, style: Style): void {
    const height = 5.2;

    for (const x of [-1, 1]) {
        for (const z of [-1, 1]) {
            b.box(
                'plain',
                style.timber,
                x,
                (height + 2.2) / 2,
                z,
                0.22,
                height + 2.2,
                0.22,
            );
        }
    }

    for (const y of [1.6, 3.4]) {
        b.box('plain', style.timber, 0, y, -1, 2.1, 0.1, 0.1, [0, 0, 0.6]);
        b.box('plain', style.timber, -1, y, 0, 0.1, 0.1, 2.1, [0.6, 0, 0]);
    }

    b.box('plain', style.timber, 0, height, 0, 2.6, 0.16, 2.6);

    for (const [x, z, w, d] of [
        [0, 1.25, 2.6, 0.08],
        [0, -1.25, 2.6, 0.08],
        [1.25, 0, 0.08, 2.6],
        [-1.25, 0, 0.08, 2.6],
    ]) {
        b.box('plain', style.timber, x, height + 0.5, z, w, 0.9, d);
    }

    // A ladder up the front.
    for (const x of [-0.25, 0.25]) {
        b.box('plain', style.timber, x, height / 2, 1.15, 0.06, height, 0.06);
    }

    for (let y = 0.4; y < height; y += 0.4) {
        b.box('plain', style.timber, 0, y, 1.15, 0.5, 0.04, 0.04);
    }

    const base = Builder.roofBase(height + 2.2, 2.6, 1, 0.5);
    b.roof(style.roof, 0, base, 2.6, 2.6, 1, 0.5, 0.25);
    lantern(b, style, 0.9, height + 1.5, 0.9);
    b.solid(-1.15, -1, -1.15, 1.15, height + 3.2, 1.15);
}

/** A roofed gate between two thick posts, the clan's sign over it. */
function gate(b: Builder, style: Style, clan: Clan): void {
    const height = 4.6;

    for (const x of [-GATE_HALF + 0.3, GATE_HALF - 0.3]) {
        b.box('plain', style.lacquer, x, height / 2, 0, 0.42, height, 0.42);
        b.box('plain', style.stone, x, 0.3, 0, 0.7, 0.6, 0.7);
        b.post(x, 0, 0.35, height);
        lantern(b, style, x, height - 1.1, 0.45);
    }

    b.box(
        'plain',
        style.timber,
        0,
        height - 0.3,
        0,
        GATE_HALF * 2 + 0.6,
        0.3,
        0.36,
    );
    b.box(
        'plain',
        style.timber,
        0,
        height - 1.0,
        0,
        GATE_HALF * 2 - 0.4,
        0.2,
        0.28,
    );
    b.box('plain', style.ridge, 0, height - 0.65, 0.2, 1.4, 0.5, 0.05);
    emblem(b, style, clan, 0, height - 0.65, 0.24);
    emblem(b, style, clan, 0, height - 0.65, -0.2, true);

    const base = Builder.roofBase(height + 0.4, 1.2, 0.8, 0.6);
    b.roof(style.roof, 0, base, GATE_HALF * 2 + 0.6, 1.2, 0.8, 0.6, 0.35);
    b.box(
        'plain',
        style.ridge,
        0,
        base + 0.88,
        0,
        GATE_HALF * 2 + 1.8,
        0.18,
        0.22,
    );
}

/** A stone stele on a base, for the Gu Yue square. */
function stele(b: Builder, style: Style): void {
    b.box('plain', style.stone, 0, 0.25, 0, 1.8, 0.5, 1.0);
    b.box('plain', style.stone, 0, 1.75, 0, 1.2, 2.6, 0.32);
    b.box('plain', style.ridge, 0, 3.15, 0, 1.45, 0.22, 0.5);
    b.solid(-0.9, -1, -0.5, 0.9, 3.3, 0.5);
}

/** A stone well with a little roof over the windlass. */
function well(b: Builder, style: Style): void {
    b.cylinder('plain', style.stone, 0, 0.45, 0, 0.9, 0.9, 12);
    b.cylinder('plain', 0x1c1f22, 0, 0.91, 0, 0.7, 0.02, 12);

    for (const x of [-0.8, 0.8]) {
        b.box('plain', style.timber, x, 1.3, 0, 0.12, 1.8, 0.12);
    }

    b.cylinder('plain', style.timber, 0, 1.6, 0, 0.08, 1.5, 6);
    b.box('plain', style.ridge, 0, 2.3, 0, 2.0, 0.08, 1.0, [0, 0, 0]);
    b.post(0, 0, 0.95, 1);
}

/** A bear totem: a thick post with a blocky bear head, claws out. */
function totem(b: Builder, style: Style): void {
    b.box('plain', style.stone, 0, 0.2, 0, 1.6, 0.4, 1.6);
    b.cylinder('plain', style.wall, 0, 2.6, 0, 0.42, 4.6, 8);

    for (const y of [1.6, 2.8]) {
        b.box('plain', style.timber, 0, y, 0, 1.0, 0.3, 1.0);
    }

    b.box('plain', style.wall, 0, 5.3, 0.1, 1.1, 0.9, 1.0);
    b.box('plain', style.wall, 0, 5.15, 0.68, 0.55, 0.42, 0.4);
    b.box('plain', 0x1a1410, 0, 5.12, 0.9, 0.18, 0.14, 0.04);

    for (const x of [-0.42, 0.42]) {
        b.box('plain', style.wall, x, 5.85, 0.05, 0.3, 0.3, 0.2);
        b.box('glow', style.lantern, x * 0.55, 5.45, 0.61, 0.1, 0.08, 0.02);
    }

    for (const offset of [-0.15, 0, 0.15]) {
        b.box(
            'plain',
            style.emblem,
            offset,
            3.6,
            0.43,
            0.05,
            0.5,
            0.02,
            [0, 0, 0.35],
        );
    }

    b.post(0, 0, 0.6, 6);
}

/** A training yard for the academy: stakes to strike, a low fence. */
function trainingYard(b: Builder, style: Style): void {
    for (const z of [-4, 0, 4]) {
        b.cylinder('plain', style.timber, 0, 0.9, z, 0.13, 1.8, 6);
        b.box('plain', style.timber, 0, 1.35, z, 0.9, 0.1, 0.1);
        b.box('plain', style.wall, 0, 1.55, z, 0.32, 0.32, 0.32);
        b.post(0, z, 0.2, 1.8);
    }

    for (const z of [-6.5, 6.5]) {
        b.box('plain', style.timber, -1, 0.5, z, 5, 0.08, 0.08);
    }
}

/** What a village is built of, and where: [kind, x, z, extra]. Offsets from the centre. */
type Plan = (
    | {
          kind: 'house';
          x: number;
          z: number;
          width: number;
          depth: number;
          storeys?: number;
      }
    | {
          kind: 'hall';
          x: number;
          z: number;
          width: number;
          depth: number;
          twoRoofs: boolean;
          faces?: number;
      }
    | {
          kind: 'yard' | 'stele' | 'well' | 'totem' | 'banner';
          x: number;
          z: number;
          faces?: number;
      }
)[];

/** The Gu Yue village, laid out by hand round its square (north is -z). */
const GU_YUE: Plan = [
    { kind: 'hall', x: 0, z: -34, width: 14, depth: 9, twoRoofs: true },
    { kind: 'hall', x: -36, z: 14, width: 16, depth: 8, twoRoofs: false },
    { kind: 'yard', x: -24, z: 14, faces: 0 },
    { kind: 'house', x: 34, z: 16, width: 10, depth: 7, storeys: 2 },
    { kind: 'stele', x: -10, z: -10, faces: 0 },
    { kind: 'well', x: 9, z: 6 },
    { kind: 'banner', x: -6, z: -15 },
    { kind: 'banner', x: 5, z: -15 },
    ...(
        [
            [-24, -30],
            [-38, -34],
            [24, -30],
            [38, -34],
            [-16, -46],
            [16, -46],
            [-28, 34],
            [-14, 44],
            [14, 44],
            [28, 34],
            [46, 0],
            [-46, -4],
            [-12, 28],
            [12, 28],
        ] as const
    ).map(([x, z], index) => ({
        kind: 'house' as const,
        x,
        z,
        width: 6.4 + (index % 3) * 0.8,
        depth: 5 + (index % 2) * 0.8,
    })),
];

/**
 * The Bai and Xiong villages: the clan head's hall to the north of the
 * square, houses round it, none in the way from the gate to the square.
 */
function ringPlan(village: Village, seed: number): Plan {
    const random = createRandom(seed);
    const plan: Plan = [
        {
            kind: 'hall',
            x: 0,
            z: -24,
            width: 12,
            depth: 8,
            twoRoofs: village.clan === 'bai',
        },
        { kind: village.clan === 'xiong' ? 'totem' : 'well', x: 0, z: 0 },
        { kind: 'banner', x: -5, z: -12 },
        { kind: 'banner', x: 4, z: -12 },
    ];
    const taken: [number, number, number][] = [[0, -22, 11]];
    const gate = village.gates[0];

    for (const radius of [22, 33]) {
        const count = Math.round((Math.PI * 2 * radius) / 13);

        for (let i = 0; i < count; i++) {
            const bearing = ((i + random() * 0.3) / count) * Math.PI * 2;
            const fromGate = Math.abs(
                Math.atan2(Math.sin(bearing - gate), Math.cos(bearing - gate)),
            );
            const fromHall = Math.abs(
                Math.atan2(Math.sin(bearing), Math.cos(bearing)),
            );
            const x = Math.sin(bearing) * radius;
            const z = -Math.cos(bearing) * radius;

            if (
                fromGate < 0.5 ||
                fromHall < 0.55 ||
                taken.some(
                    ([tx, tz, reach]) => Math.hypot(tx - x, tz - z) < reach + 5,
                )
            ) {
                continue;
            }

            taken.push([x, z, 5]);
            plan.push({
                kind: 'house',
                x,
                z,
                width: 6 + random() * 2.4,
                depth: 4.8 + random() * 1.2,
            });
        }
    }

    return plan;
}

export class Villages {
    readonly group = new THREE.Group();
    private materials = materials();

    constructor(private colliders: ColliderGrid) {
        const b = new Builder(colliders);
        const stakes: THREE.Matrix4[] = [];
        const stakeColors: THREE.Color[] = [];
        const culms: THREE.Matrix4[] = [];
        const culmColors: THREE.Color[] = [];

        VILLAGES.forEach((village, index) => {
            const style = STYLES[village.clan];
            const plan =
                village.clan === 'gu_yue'
                    ? GU_YUE
                    : ringPlan(village, 900 + index);

            for (const item of plan) {
                const x = village.x + item.x;
                const z = village.z + item.z;
                const faces =
                    'faces' in item && item.faces !== undefined
                        ? item.faces
                        : facing(x, z, village.x, village.z);

                b.at(x, z, faces);

                switch (item.kind) {
                    case 'house':
                        stiltHouse(
                            b,
                            style,
                            item.width,
                            item.depth,
                            item.storeys,
                        );

                        if (item.storeys) {
                            // The tavern's wine flag.
                            b.cylinder(
                                'plain',
                                style.timber,
                                item.width / 2 + 0.6,
                                3.2,
                                item.depth / 2 + VERANDA,
                                0.06,
                                6.4,
                                6,
                            );
                            b.box(
                                'plain',
                                0x7a2a22,
                                item.width / 2 + 0.6,
                                5.2,
                                item.depth / 2 + VERANDA + 0.55,
                                0.03,
                                1.8,
                                1.0,
                            );
                        }

                        break;
                    case 'hall':
                        hall(
                            b,
                            style,
                            village.clan,
                            item.width,
                            item.depth,
                            item.twoRoofs,
                        );
                        break;
                    case 'yard':
                        trainingYard(b, style);
                        break;
                    case 'stele':
                        stele(b, style);
                        break;
                    case 'well':
                        well(b, style);
                        break;
                    case 'totem':
                        totem(b, style);
                        break;
                    case 'banner':
                        banner(b, style, village.clan, 0, 0);
                        b.post(0, 0, 0.12, 6);
                        break;
                }
            }

            this.palisade(b, village, style, stakes, stakeColors);
            this.groves(village, createRandom(700 + index), culms, culmColors);
            b.build(this.group, this.materials);
        });

        this.instanced(
            this.stakeGeometry(),
            new THREE.MeshStandardMaterial({ roughness: 0.9 }),
            stakes,
            stakeColors,
        );
        this.instanced(
            new THREE.CylinderGeometry(0.05, 0.065, 1, 5).translate(0, 0.5, 0),
            new THREE.MeshStandardMaterial({ roughness: 0.7 }),
            culms.filter((_, i) => i % 2 === 0),
            culmColors.filter((_, i) => i % 2 === 0),
        );
        this.instanced(
            new THREE.IcosahedronGeometry(1, 0),
            new THREE.MeshStandardMaterial({
                roughness: 0.9,
                flatShading: true,
            }),
            culms.filter((_, i) => i % 2 === 1),
            culmColors.filter((_, i) => i % 2 === 1),
        );
    }

    /** A ring of sharpened stakes, open at the gates, a gate and a watchtower at each. */
    private palisade(
        b: Builder,
        village: Village,
        style: Style,
        stakes: THREE.Matrix4[],
        colors: THREE.Color[],
    ): void {
        const random = createRandom(Math.round(village.x * 7 + village.z));
        const radius = village.radius;
        const count = Math.round((Math.PI * 2 * radius) / STAKE_STEP);
        const gap = GATE_HALF / radius;
        const base = new THREE.Color(style.stake);

        for (let i = 0; i < count && stakes.length < MAX_STAKES; i++) {
            const bearing = (i / count) * Math.PI * 2;

            if (
                village.gates.some(
                    (gate) =>
                        Math.abs(
                            Math.atan2(
                                Math.sin(bearing - gate),
                                Math.cos(bearing - gate),
                            ),
                        ) < gap,
                )
            ) {
                continue;
            }

            const x = village.x + Math.sin(bearing) * radius;
            const z = village.z - Math.cos(bearing) * radius;
            const ground = heightAt(x, z);
            const height = STAKE_HEIGHT + random() * 0.5;

            stakes.push(
                new THREE.Matrix4().compose(
                    new THREE.Vector3(x, ground - 0.3, z),
                    new THREE.Quaternion().setFromEuler(
                        new THREE.Euler(
                            (random() - 0.5) * 0.06,
                            random() * 6,
                            (random() - 0.5) * 0.06,
                        ),
                    ),
                    new THREE.Vector3(1, height + 0.3, 1),
                ),
            );
            colors.push(base.clone().multiplyScalar(0.85 + random() * 0.3));
            this.colliders.add({
                kind: 'cylinder',
                x,
                z,
                radius: 0.24,
                bottom: ground - 1,
                top: ground + height,
            });
        }

        for (const bearing of village.gates) {
            const spot = gateAt(village, bearing);

            // Facing out of the village, along the way through.
            b.turned(spot.x, spot.z, Math.PI - bearing);
            gate(b, style, village.clan);

            const inward = 4.5;
            const aside = 6;
            const x =
                spot.x - Math.sin(bearing) * inward + Math.cos(bearing) * aside;
            const z =
                spot.z + Math.cos(bearing) * inward + Math.sin(bearing) * aside;
            b.at(x, z, facing(x, z, village.x, village.z));
            tower(b, style);
        }
    }

    /** Clumps of bamboo round the outside of the palisade, off the paths. */
    private groves(
        village: Village,
        random: () => number,
        culms: THREE.Matrix4[],
        colors: THREE.Color[],
    ): void {
        const stem = new THREE.Color(0x6f7a4a);
        const leaves = new THREE.Color(0x3d5034);
        const clumps = Math.round(village.radius * 1.4);

        for (
            let clump = 0;
            clump < clumps && culms.length < MAX_CULMS * 2;
            clump++
        ) {
            const bearing = random() * Math.PI * 2;
            const distance = village.radius + 4 + random() * 22;
            const cx = village.x + Math.sin(bearing) * distance;
            const cz = village.z - Math.cos(bearing) * distance;

            if (
                pathDistance(cx, cz) < PATH_HALF + 3 ||
                Math.hypot(cx - HOME.x, cz - HOME.z) < SPAWN_RADIUS
            ) {
                continue;
            }

            const ground = heightAt(cx, cz);
            const count = 4 + Math.floor(random() * 6);
            let tallest = 0;

            for (let i = 0; i < count; i++) {
                const x = cx + (random() - 0.5) * 1.6;
                const z = cz + (random() - 0.5) * 1.6;
                const height = 6 + random() * 5;
                const lean = new THREE.Quaternion().setFromEuler(
                    new THREE.Euler(
                        (random() - 0.5) * 0.2,
                        0,
                        (random() - 0.5) * 0.2,
                    ),
                );
                const foot = new THREE.Vector3(x, heightAt(x, z) - 0.2, z);
                const tip = new THREE.Vector3(0, height * 0.82, 0)
                    .applyQuaternion(lean)
                    .add(foot);

                tallest = Math.max(tallest, height);
                culms.push(
                    new THREE.Matrix4().compose(
                        foot,
                        lean,
                        new THREE.Vector3(1, height, 1),
                    ),
                );
                colors.push(stem.clone().multiplyScalar(0.8 + random() * 0.35));
                culms.push(
                    new THREE.Matrix4().compose(
                        tip,
                        lean,
                        new THREE.Vector3(
                            0.9 + random() * 0.5,
                            1.8 + random() * 1.2,
                            0.9 + random() * 0.5,
                        ),
                    ),
                );
                colors.push(
                    leaves.clone().multiplyScalar(0.8 + random() * 0.4),
                );
            }

            this.colliders.add({
                kind: 'cylinder',
                x: cx,
                z: cz,
                radius: 0.9,
                bottom: ground - 1,
                top: ground + tallest,
            });
        }
    }

    /** A stake: one metre tall with a sharpened top, to be stretched. */
    private stakeGeometry(): THREE.BufferGeometry {
        const shaft = new THREE.CylinderGeometry(0.17, 0.19, 0.9, 7).translate(
            0,
            0.45,
            0,
        );
        const tip = new THREE.ConeGeometry(0.17, 0.1, 7).translate(0, 0.95, 0);

        return mergeGeometries([shaft, tip]);
    }

    private instanced(
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        matrices: THREE.Matrix4[],
        colors: THREE.Color[],
    ): void {
        if (!matrices.length) {
            return;
        }

        const mesh = new THREE.InstancedMesh(
            geometry,
            material,
            matrices.length,
        );

        matrices.forEach((matrix, index) => {
            mesh.setMatrixAt(index, matrix);
            mesh.setColorAt(index, colors[index]);
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        this.group.add(mesh);
    }
}
