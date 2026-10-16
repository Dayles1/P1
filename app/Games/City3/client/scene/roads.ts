/**
 * Roads: every road tile becomes a few flat pieces lying on the ground —
 * curb (roadEdge) and surface (road) that join neighbouring tiles
 * seamlessly, lane markings, cobbles — in the style of the road level's
 * era. Roads not connected to the centre are darker with a red marker.
 * Street lamps stand along connected roads from the era of paved streets
 * on and glow at night. A road over water becomes a bridge: its deck
 * sits level with the shore on piles, with railings along the open sides
 * — timber, then stone, then concrete and steel. Rebuilt only when the
 * roads change.
 */

import * as THREE from 'three';
import type { Palette } from '../engine/content/types';
import type { Game } from '../engine/sim/game';
import { color, hash3 } from './colors';
import { DECK_Y } from './terrain';
import type { Terrain } from './terrain';

const DIRS: [number, number][] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
];

/** Bridge looks by road style; `solid` railings are stone parapets. */
const BRIDGE_LOOKS: Record<
    'dirt' | 'stone' | 'modern',
    {
        deck: string;
        pile: string;
        rail: string;
        pileWidth: number;
        solid: boolean;
    }
> = {
    dirt: {
        deck: '#7a5636',
        pile: '#5e4229',
        rail: '#6b4b2f',
        pileWidth: 0.05,
        solid: false,
    },
    stone: {
        deck: '#a39a8a',
        pile: '#8f8778',
        rail: '#9c9383',
        pileWidth: 0.12,
        solid: true,
    },
    modern: {
        deck: '#b4b1aa',
        pile: '#9d9a94',
        rail: '#5d636b',
        pileWidth: 0.09,
        solid: false,
    },
};

interface BridgeTile {
    x: number;
    y: number;
    near: boolean[];
    inset: number;
    style: string;
    /** Over water (on piles), or a raised approach on the shore. */
    water: boolean;
}

class Layer {
    readonly position: number[] = [];
    readonly color: number[] = [];
    /** Nothing in this layer lies lower than this (bridge decks). */
    floor = -Infinity;

    constructor(private terrain: Terrain) {}

    /** A rectangle in tile coordinates lying on the ground, `lift` above it. */
    rect(
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        c: THREE.Color,
        lift: number,
    ): void {
        const nx = x1 - x0 > 0.36 ? 2 : 1;
        const ny = y1 - y0 > 0.36 ? 2 : 1;

        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                const ax = x0 + ((x1 - x0) * i) / nx;
                const bx = x0 + ((x1 - x0) * (i + 1)) / nx;
                const ay = y0 + ((y1 - y0) * j) / ny;
                const by = y0 + ((y1 - y0) * (j + 1)) / ny;

                this.quad(ax, ay, bx, by, c, lift);
            }
        }
    }

    private quad(
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        c: THREE.Color,
        lift: number,
    ): void {
        const h = (x: number, y: number) =>
            Math.max(this.terrain.heightAt(x, y), this.floor) + lift;
        const a: [number, number, number] = [x0, h(x0, y0), y0];
        const b: [number, number, number] = [x1, h(x1, y0), y0];
        const cc: [number, number, number] = [x0, h(x0, y1), y1];
        const d: [number, number, number] = [x1, h(x1, y1), y1];

        // Counter-clockwise from above: a, c, b and b, c, d.
        for (const p of [a, cc, b, b, cc, d]) {
            this.position.push(p[0], p[1], p[2]);
            this.color.push(c.r, c.g, c.b);
        }
    }

    toGeometry(): THREE.BufferGeometry {
        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(this.position, 3),
        );
        geometry.setAttribute(
            'color',
            new THREE.Float32BufferAttribute(this.color, 3),
        );
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();

        return geometry;
    }
}

export interface LampSpot {
    position: THREE.Vector3;
    color: THREE.Color;
}

export class Roads {
    readonly group = new THREE.Group();
    /** Lamp heads (world), for the night glow. */
    lamps: LampSpot[] = [];
    /** Bumped on every rebuild. */
    revision = 0;

    private surface: THREE.Mesh;
    private marks: THREE.Mesh;
    private glowMarks: THREE.Mesh;
    private surfaceMaterial: THREE.MeshStandardMaterial;
    private glowMaterial: THREE.MeshBasicMaterial;
    private poles: THREE.InstancedMesh | null = null;
    private heads: THREE.InstancedMesh | null = null;
    private poleGeometry: THREE.BufferGeometry;
    private headGeometry: THREE.BufferGeometry;
    private poleMaterial: THREE.MeshStandardMaterial;
    private headMaterial: THREE.MeshBasicMaterial;
    private bridges: THREE.InstancedMesh | null = null;
    private bridgeGeometry = new THREE.BoxGeometry(1, 1, 1);
    private bridgeMaterial = new THREE.MeshStandardMaterial({
        roughness: 0.85,
        metalness: 0,
    });
    private signature = 0;
    private mask: Uint8Array;

    constructor(
        private game: Game,
        private terrain: Terrain,
    ) {
        this.mask = new Uint8Array(game.map.width * game.map.height);
        this.surfaceMaterial = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.9,
            metalness: 0,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2,
        });
        this.glowMaterial = new THREE.MeshBasicMaterial({
            vertexColors: true,
            toneMapped: false,
            polygonOffset: true,
            polygonOffsetFactor: -3,
            polygonOffsetUnits: -3,
        });
        this.surface = new THREE.Mesh(
            new THREE.BufferGeometry(),
            this.surfaceMaterial,
        );
        this.surface.receiveShadow = true;
        this.marks = new THREE.Mesh(
            new THREE.BufferGeometry(),
            this.surfaceMaterial,
        );
        this.marks.receiveShadow = true;
        this.glowMarks = new THREE.Mesh(
            new THREE.BufferGeometry(),
            this.glowMaterial,
        );
        this.group.add(this.surface, this.marks, this.glowMarks);

        this.poleGeometry = new THREE.CylinderGeometry(
            0.009,
            0.013,
            0.34,
            6,
        ).translate(0, 0.17, 0);
        this.headGeometry = new THREE.SphereGeometry(0.03, 10, 8).translate(
            0,
            0.35,
            0,
        );
        this.poleMaterial = new THREE.MeshStandardMaterial({
            color: 0x3c4046,
            roughness: 0.5,
            metalness: 0.6,
        });
        this.headMaterial = new THREE.MeshBasicMaterial({ color: 0xd8d8d0 });
    }

    /** Rebuilds when roads, their looks or connections changed. Returns true if it did. */
    sync(force = false): boolean {
        const game = this.game;
        const map = game.map;
        let signature = 17;
        const count = map.width * map.height;

        for (let i = 0; i < count; i++) {
            const uid = map.occupant[i];

            if (uid > 0 && game.isRoad(i)) {
                const building = game.buildings.get(uid)!;

                signature =
                    (Math.imul(signature, 31) +
                        i * 7 +
                        building.level * 131 +
                        (game.connectedRoads.has(i) ? 1 : 0) +
                        (building.style ? 977 : 0)) |
                    0;
            }
        }

        if (!force && signature === this.signature) {
            return false;
        }

        this.signature = signature;
        this.rebuild();

        return true;
    }

    private rebuild(): void {
        const game = this.game;
        const map = game.map;
        const W = map.width;
        const H = map.height;
        const surface = new Layer(this.terrain);
        const marks = new Layer(this.terrain);
        const glow = new Layer(this.terrain);
        const palettes = new Map<string, Palette>();
        const lamps: { x: number; y: number; palette: Palette }[] = [];
        const red = color('#e0402f');

        this.revision++;

        for (let i = 0; i < W * H; i++) {
            this.mask[i] = game.isRoad(i) ? 1 : 0;
        }

        const road = (x: number, y: number) =>
            x >= 0 && y >= 0 && x < W && y < H && this.mask[y * W + x] === 1;
        const decks = new Set<number>();
        const bridges: BridgeTile[] = [];

        for (let i = 0; i < W * H; i++) {
            const x = i % W;
            const y = Math.floor(i / W);

            if (!this.mask[i] || !map.isOpenWater(x, y)) {
                continue;
            }

            decks.add(i);

            for (const [dx, dy] of DIRS) {
                if (road(x + dx, y + dy)) {
                    decks.add((y + dy) * W + x + dx);
                }
            }
        }

        this.terrain.setDecks(decks);

        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const index = y * W + x;

                if (!this.mask[index]) {
                    continue;
                }

                const building = game.buildings.get(map.occupant[index])!;
                const key = game.lookKey(building);
                let palette = palettes.get(key);

                if (!palette) {
                    palette = game.paletteOf(building);
                    palettes.set(key, palette);
                }

                const style = palette.roadStyle ?? 'dirt';
                const connected = game.connectedRoads.has(index);
                const near = DIRS.map(([dx, dy]) => road(x + dx, y + dy));
                const dirt = style === 'dirt';
                const m0 = dirt ? 0.12 : 0.04;
                const m1 = dirt ? 0.2 : 0.13;
                let edgeColor = color(palette.roadEdge ?? '#8a7a5a').clone();
                let surfaceColor = color(palette.road ?? '#a89070').clone();

                surfaceColor.multiplyScalar(0.96 + hash3(x, y, 21) * 0.08);

                if (!connected) {
                    surfaceColor = surfaceColor.multiplyScalar(0.62);
                    edgeColor = edgeColor.lerp(red, 0.55);
                }

                const floor = decks.has(index) ? DECK_Y : -Infinity;

                surface.floor = floor;
                marks.floor = floor;
                glow.floor = floor;

                if (decks.has(index)) {
                    bridges.push({
                        x,
                        y,
                        near,
                        inset: m0,
                        style,
                        water: map.isOpenWater(x, y),
                    });
                }

                this.shape(surface, x, y, m0, near, road, edgeColor, 0.016);
                this.shape(surface, x, y, m1, near, road, surfaceColor, 0.024);

                if (style === 'cobble') {
                    const stone = surfaceColor.clone().multiplyScalar(0.82);

                    for (let k = 0; k < 6; k++) {
                        const sx =
                            x + m1 + hash3(x, y, 40 + k) * (1 - 2 * m1 - 0.07);
                        const sy =
                            y + m1 + hash3(x, y, 60 + k) * (1 - 2 * m1 - 0.07);

                        marks.rect(sx, sy, sx + 0.07, sy + 0.05, stone, 0.028);
                    }
                }

                const mark =
                    typeof palette.roadMark === 'string'
                        ? palette.roadMark
                        : null;
                const glowing = style === 'glow' || style === 'smart';
                const links = near.filter(Boolean).length;

                if (mark && !dirt && connected) {
                    const target = glowing ? glow : marks;
                    const markColor = color(mark);

                    if (links <= 2) {
                        DIRS.forEach(([dx, dy], k) => {
                            if (!near[k]) {
                                return;
                            }

                            const w = 0.016;
                            const cx = x + 0.5;
                            const cy = y + 0.5;
                            const a = 0.1;
                            const b = 0.38;

                            if (dx !== 0) {
                                const s = Math.min(cx + dx * a, cx + dx * b);
                                const e = Math.max(cx + dx * a, cx + dx * b);

                                target.rect(
                                    s,
                                    cy - w,
                                    e,
                                    cy + w,
                                    markColor,
                                    0.03,
                                );
                            } else {
                                const s = Math.min(cy + dy * a, cy + dy * b);
                                const e = Math.max(cy + dy * a, cy + dy * b);

                                target.rect(
                                    cx - w,
                                    s,
                                    cx + w,
                                    e,
                                    markColor,
                                    0.03,
                                );
                            }
                        });
                    }

                    if (glowing) {
                        this.edgeLines(glow, x, y, m1, near, markColor);
                    }
                }

                if (!connected) {
                    marks.rect(
                        x + 0.44,
                        y + 0.44,
                        x + 0.56,
                        y + 0.56,
                        red,
                        0.032,
                    );
                }

                if (connected && !dirt && hash3(x, y, 3) < 0.28) {
                    lamps.push({ x, y, palette });
                }
            }
        }

        this.replace(this.surface, surface.toGeometry());
        this.replace(this.marks, marks.toGeometry());
        this.replace(this.glowMarks, glow.toGeometry());
        this.buildLamps(lamps, road);
        this.buildBridges(bridges);
    }

    /** Decks, piles and railings under and along the roads over water. */
    private buildBridges(tiles: BridgeTile[]): void {
        if (this.bridges) {
            this.group.remove(this.bridges);
            this.bridges.dispose();
            this.bridges = null;
        }

        const boxes: {
            min: THREE.Vector3;
            max: THREE.Vector3;
            c: THREE.Color;
        }[] = [];
        const box = (
            x0: number,
            x1: number,
            y0: number,
            y1: number,
            z0: number,
            z1: number,
            c: THREE.Color,
        ) =>
            boxes.push({
                min: new THREE.Vector3(x0, y0, z0),
                max: new THREE.Vector3(x1, y1, z1),
                c,
            });
        const deckBottom = DECK_Y - 0.06;

        for (const { x, y, near, inset, style, water } of tiles) {
            const look =
                BRIDGE_LOOKS[
                    style === 'dirt'
                        ? 'dirt'
                        : style === 'cobble' || style === 'paved'
                          ? 'stone'
                          : 'modern'
                ];
            const shade = 0.92 + hash3(x, y, 77) * 0.12;
            const deck = color(look.deck).clone().multiplyScalar(shade);
            const pile = color(look.pile).clone().multiplyScalar(shade);
            const rail = color(look.rail).clone().multiplyScalar(shade);
            const [n, e, s, w] = near;
            const l = w ? x : x + inset;
            const r = e ? x + 1 : x + 1 - inset;
            const t = n ? y : y + inset;
            const b = s ? y + 1 : y + 1 - inset;

            box(l, r, deckBottom, DECK_Y + 0.012, t, b, deck);

            if (!water) {
                continue;
            }

            const p = look.pileWidth / 2;
            const piles: [number, number][] =
                (e || w) && !(n || s)
                    ? [
                          [x + 0.5, t + p],
                          [x + 0.5, b - p],
                      ]
                    : (n || s) && !(e || w)
                      ? [
                            [l + p, y + 0.5],
                            [r - p, y + 0.5],
                        ]
                      : [
                            [l + p, t + p],
                            [r - p, t + p],
                            [l + p, b - p],
                            [r - p, b - p],
                        ];

            for (const [px, pz] of piles) {
                box(
                    px - p,
                    px + p,
                    this.terrain.heightAt(px, pz) - 0.05,
                    deckBottom,
                    pz - p,
                    pz + p,
                    pile,
                );
            }

            const sides: [number, number, number, number][] = [];

            if (!n) {
                sides.push([l, r, t, t + 0.02]);
            }

            if (!s) {
                sides.push([l, r, b - 0.02, b]);
            }

            if (!w) {
                sides.push([l, l + 0.02, t, b]);
            }

            if (!e) {
                sides.push([r - 0.02, r, t, b]);
            }

            for (const [x0, x1, z0, z1] of sides) {
                if (look.solid) {
                    box(x0, x1, DECK_Y, DECK_Y + 0.06, z0, z1, rail);

                    continue;
                }

                box(x0, x1, DECK_Y + 0.055, DECK_Y + 0.07, z0, z1, rail);

                const alongX = x1 - x0 > z1 - z0;

                for (const k of [0.1, 0.5, 0.9]) {
                    const px = alongX ? x0 + (x1 - x0) * k : (x0 + x1) / 2;
                    const pz = alongX ? (z0 + z1) / 2 : z0 + (z1 - z0) * k;

                    box(
                        px - 0.008,
                        px + 0.008,
                        DECK_Y,
                        DECK_Y + 0.06,
                        pz - 0.008,
                        pz + 0.008,
                        rail,
                    );
                }
            }
        }

        if (!boxes.length) {
            return;
        }

        const mesh = new THREE.InstancedMesh(
            this.bridgeGeometry,
            this.bridgeMaterial,
            boxes.length,
        );
        const matrix = new THREE.Matrix4();
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        const rotation = new THREE.Quaternion();

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        boxes.forEach(({ min, max, c }, i) => {
            center.addVectors(min, max).multiplyScalar(0.5);
            size.subVectors(max, min);
            matrix.compose(center, rotation, size);
            mesh.setMatrixAt(i, matrix);
            mesh.setColorAt(i, c);
        });
        mesh.computeBoundingSphere();
        this.bridges = mesh;
        this.group.add(mesh);
    }

    private replace(mesh: THREE.Mesh, geometry: THREE.BufferGeometry): void {
        mesh.geometry.dispose();
        mesh.geometry = geometry;
    }

    /** A road shape inset by `m`, extended to the neighbours it joins. */
    private shape(
        layer: Layer,
        x: number,
        y: number,
        m: number,
        near: boolean[],
        road: (x: number, y: number) => boolean,
        c: THREE.Color,
        lift: number,
    ): void {
        const [n, e, s, w] = near;

        layer.rect(x + m, y + m, x + 1 - m, y + 1 - m, c, lift);

        if (n) {
            layer.rect(x + m, y, x + 1 - m, y + m, c, lift);
        }

        if (s) {
            layer.rect(x + m, y + 1 - m, x + 1 - m, y + 1, c, lift);
        }

        if (w) {
            layer.rect(x, y + m, x + m, y + 1 - m, c, lift);
        }

        if (e) {
            layer.rect(x + 1 - m, y + m, x + 1, y + 1 - m, c, lift);
        }

        if (n && e && road(x + 1, y - 1)) {
            layer.rect(x + 1 - m, y, x + 1, y + m, c, lift);
        }

        if (n && w && road(x - 1, y - 1)) {
            layer.rect(x, y, x + m, y + m, c, lift);
        }

        if (s && e && road(x + 1, y + 1)) {
            layer.rect(x + 1 - m, y + 1 - m, x + 1, y + 1, c, lift);
        }

        if (s && w && road(x - 1, y + 1)) {
            layer.rect(x, y + 1 - m, x + m, y + 1, c, lift);
        }
    }

    /** Glowing lines along the open sides of a tile. */
    private edgeLines(
        layer: Layer,
        x: number,
        y: number,
        m: number,
        near: boolean[],
        c: THREE.Color,
    ): void {
        const [n, e, s, w] = near;
        const t = 0.014;
        const a = n ? y : y + m;
        const b = s ? y + 1 : y + 1 - m;
        const l = w ? x : x + m;
        const r = e ? x + 1 : x + 1 - m;

        if (!n) {
            layer.rect(l, y + m, r, y + m + t, c, 0.03);
        }

        if (!s) {
            layer.rect(l, y + 1 - m - t, r, y + 1 - m, c, 0.03);
        }

        if (!w) {
            layer.rect(x + m, a, x + m + t, b, c, 0.03);
        }

        if (!e) {
            layer.rect(x + 1 - m - t, a, x + 1 - m, b, c, 0.03);
        }
    }

    private buildLamps(
        spots: { x: number; y: number; palette: Palette }[],
        road: (x: number, y: number) => boolean,
    ): void {
        if (this.poles) {
            this.group.remove(this.poles, this.heads!);
            this.poles.dispose();
            this.heads!.dispose();
            this.poles = null;
            this.heads = null;
        }

        this.lamps = [];

        const placed: { x: number; z: number; palette: Palette }[] = [];

        for (const { x, y, palette } of spots) {
            const free = DIRS.map(([dx, dy], k) => ({ dx, dy, k })).filter(
                ({ dx, dy }) => !road(x + dx, y + dy),
            );

            if (!free.length) {
                continue;
            }

            const side = free[Math.floor(hash3(x, y, 8) * free.length)];
            const along = (hash3(x, y, 9) - 0.5) * 0.5;
            const px = x + 0.5 + side.dx * 0.47 + (side.dy !== 0 ? along : 0);
            const pz = y + 0.5 + side.dy * 0.47 + (side.dx !== 0 ? along : 0);

            placed.push({ x: px, z: pz, palette });
        }

        if (!placed.length) {
            return;
        }

        this.poles = new THREE.InstancedMesh(
            this.poleGeometry,
            this.poleMaterial,
            placed.length,
        );
        this.heads = new THREE.InstancedMesh(
            this.headGeometry,
            this.headMaterial,
            placed.length,
        );
        this.poles.castShadow = true;

        const matrix = new THREE.Matrix4();

        placed.forEach((lamp, i) => {
            const h = this.terrain.surfaceAt(lamp.x, lamp.z);

            matrix.makeTranslation(lamp.x, h, lamp.z);
            this.poles!.setMatrixAt(i, matrix);
            this.heads!.setMatrixAt(i, matrix);
            this.lamps.push({
                position: new THREE.Vector3(lamp.x, h + 0.35, lamp.z),
                color: color(
                    typeof lamp.palette.lit === 'string'
                        ? lamp.palette.lit
                        : '#ffe39a',
                ),
            });
        });

        this.poles.computeBoundingSphere();
        this.heads.computeBoundingSphere();
        this.group.add(this.poles, this.heads);
    }

    /** Per frame: lamp heads and glowing marks by the night level (0..1). */
    update(night: number): void {
        this.headMaterial.color
            .setRGB(0.82, 0.82, 0.78)
            .lerp(new THREE.Color(1.6, 1.35, 0.8), night);
        this.glowMaterial.color.setScalar(0.75 + night * 0.9);
    }

    dispose(): void {
        this.surface.geometry.dispose();
        this.marks.geometry.dispose();
        this.glowMarks.geometry.dispose();
        this.surfaceMaterial.dispose();
        this.glowMaterial.dispose();
        this.poles?.dispose();
        this.heads?.dispose();
        this.bridges?.dispose();
        this.bridgeGeometry.dispose();
        this.bridgeMaterial.dispose();
        this.poleGeometry.dispose();
        this.headGeometry.dispose();
        this.poleMaterial.dispose();
        this.headMaterial.dispose();
    }
}
