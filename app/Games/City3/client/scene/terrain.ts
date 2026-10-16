/**
 * The ground: one height-field mesh for the whole map (two vertices per
 * tile edge), coloured per vertex by blending the biome colours of nearby
 * tiles, with the season's tint and snow and darker land outside the
 * territory. Water tiles sink below an animated water surface; the map
 * edge gets earthen sides like a diorama. Under buildings the ground is
 * flattened to the building's base height. Also draws the territory
 * borders and the placement grid.
 */

import * as THREE from 'three';
import type { BiomeDef } from '../engine/content/types';
import type { Game } from '../engine/sim/game';
import { isWaterBiome } from '../engine/world/world-map';
import { color, hash3 } from './colors';

export const WATER_Y = -0.1;
/** Top of a bridge over water, level with the low shore. */
export const DECK_Y = 0;
const SUB = 2;
const SKIRT_BOTTOM = -1.4;

export interface Footprint {
    x: number;
    y: number;
    w: number;
    h: number;
    base: number;
}

type Rect = { minX: number; minY: number; maxX: number; maxY: number };

function isMountainBiome(biome: BiomeDef, elevation: number): boolean {
    return !biome.walkable && !isWaterBiome(biome, elevation);
}

/** Height of a tile's ground from its elevation and biome. */
function tileHeight(biome: BiomeDef, e: number): number {
    if (isWaterBiome(biome, e)) {
        return biome.water ? -0.32 : -0.55;
    }

    let h = Math.max(0, e - 0.34) * 0.8;

    if (e > 0.7) {
        h += (e - 0.7) * 2.2;
    }

    if (isMountainBiome(biome, e)) {
        h += 0.55 + Math.max(0, e - 0.84) * 9;
    } else if (!biome.buildable) {
        h += 0.08;
    }

    return h;
}

function valueNoise(x: number, y: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = hash3(x0, y0, 71);
    const b = hash3(x0 + 1, y0, 71);
    const c = hash3(x0, y0 + 1, 71);
    const d = hash3(x0 + 1, y0 + 1, 71);

    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy - 0.5;
}

function waterNormalMap(): THREE.DataTexture {
    const size = 128;
    const data = new Uint8Array(size * size * 4);
    const height = (x: number, y: number) => {
        const u = (x / size) * Math.PI * 2;
        const v = (y / size) * Math.PI * 2;

        return (
            Math.sin(u * 3 + Math.sin(v * 2) * 0.8) * 0.5 +
            Math.sin(v * 4 + u * 1) * 0.35 +
            Math.sin(u * 7 - v * 5) * 0.18 +
            Math.sin(u * 11 + v * 13) * 0.08
        );
    };

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = height(x + 1, y) - height(x - 1, y);
            const dy = height(x, y + 1) - height(x, y - 1);
            const n = new THREE.Vector3(-dx * 2.2, -dy * 2.2, 1).normalize();
            const i = (y * size + x) * 4;

            data[i] = Math.round((n.x * 0.5 + 0.5) * 255);
            data[i + 1] = Math.round((n.y * 0.5 + 0.5) * 255);
            data[i + 2] = Math.round((n.z * 0.5 + 0.5) * 255);
            data[i + 3] = 255;
        }
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);

    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;

    return texture;
}

/** The ground of one game. */
export class Terrain {
    readonly group = new THREE.Group();
    readonly width: number;
    readonly height: number;

    /** Corner heights before and after flattening, (W+1)·(H+1). */
    private natural: Float32Array;
    private heights: Float32Array;
    private roughNatural: Float32Array;
    private rough: Float32Array;
    private tileColors: Float32Array;
    private decks = new Set<number>();

    private geometry = new THREE.BufferGeometry();
    private mesh: THREE.Mesh;
    private material: THREE.MeshStandardMaterial;
    private water: THREE.Mesh;
    private waterMaterial: THREE.MeshStandardMaterial;
    private waterNormals: THREE.DataTexture;
    private skirt: THREE.Mesh;
    private skirtMaterial: THREE.MeshLambertMaterial;
    private borders: THREE.Mesh;
    private borderMaterial: THREE.MeshBasicMaterial;
    private grid: THREE.LineSegments;
    private gridMaterial: THREE.LineBasicMaterial;
    private colorKey = '';
    private borderKey = '';

    constructor(private game: Game) {
        const map = game.map;

        this.width = map.width;
        this.height = map.height;

        const corners = (map.width + 1) * (map.height + 1);

        this.natural = new Float32Array(corners);
        this.heights = new Float32Array(corners);
        this.roughNatural = new Float32Array(corners);
        this.rough = new Float32Array(corners);
        this.tileColors = new Float32Array(map.width * map.height * 3);
        this.computeNatural();

        const vw = map.width * SUB + 1;
        const vh = map.height * SUB + 1;
        const positions = new Float32Array(vw * vh * 3);
        const colors = new Float32Array(vw * vh * 3);
        const indices: number[] = [];

        for (let j = 0; j < vh - 1; j++) {
            for (let i = 0; i < vw - 1; i++) {
                const a = j * vw + i;
                const b = a + 1;
                const c = a + vw;
                const d = c + 1;

                // Counter-clockwise seen from above (+Y): a → c → b, b → c → d.
                if ((i + j) % 2 === 0) {
                    indices.push(a, c, b, b, c, d);
                } else {
                    indices.push(a, c, d, a, d, b);
                }
            }
        }

        this.geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(positions, 3),
        );
        this.geometry.setAttribute(
            'color',
            new THREE.BufferAttribute(colors, 3),
        );
        this.geometry.setIndex(indices);

        this.material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.95,
            metalness: 0,
        });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.receiveShadow = true;
        this.mesh.name = 'terrain';
        this.group.add(this.mesh);

        this.waterNormals = waterNormalMap();
        this.waterNormals.repeat.set(map.width / 5, map.height / 5);

        const waterBiome = game.content.biomes.find((b) => b.water);

        this.waterMaterial = new THREE.MeshStandardMaterial({
            color: color(waterBiome?.colors[0] ?? '#3f8fc4'),
            roughness: 0.14,
            metalness: 0.1,
            transparent: true,
            opacity: 0.84,
            normalMap: this.waterNormals,
            normalScale: new THREE.Vector2(0.35, 0.35),
            depthWrite: false,
        });

        const waterGeometry = new THREE.PlaneGeometry(map.width, map.height);

        waterGeometry.rotateX(-Math.PI / 2);
        waterGeometry.translate(map.width / 2, WATER_Y, map.height / 2);
        this.water = new THREE.Mesh(waterGeometry, this.waterMaterial);
        this.water.receiveShadow = true;
        this.water.renderOrder = 1;
        this.group.add(this.water);

        this.skirtMaterial = new THREE.MeshLambertMaterial({
            vertexColors: true,
        });
        this.skirt = new THREE.Mesh(
            new THREE.BufferGeometry(),
            this.skirtMaterial,
        );
        this.group.add(this.skirt);

        this.borderMaterial = new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            toneMapped: false,
        });
        this.borders = new THREE.Mesh(
            new THREE.BufferGeometry(),
            this.borderMaterial,
        );
        this.borders.renderOrder = 2;
        this.group.add(this.borders);

        this.gridMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.2,
            depthWrite: false,
        });
        this.grid = new THREE.LineSegments(
            new THREE.BufferGeometry(),
            this.gridMaterial,
        );
        this.grid.visible = false;
        this.group.add(this.grid);

        this.flatten([]);
        this.update(0, 0, true);
    }

    get object(): THREE.Mesh {
        return this.mesh;
    }

    private computeNatural(): void {
        const map = this.game.map;
        const W = map.width;
        const H = map.height;
        const tile = new Float32Array(W * H);
        const roughTile = new Float32Array(W * H);

        for (let i = 0; i < W * H; i++) {
            const biome = map.biomeOfIndex(i);
            const e = map.elevation[i] / 255;

            tile[i] = tileHeight(biome, e);
            roughTile[i] = isMountainBiome(biome, e)
                ? 1
                : !biome.buildable && !isWaterBiome(biome, e)
                  ? 0.4
                  : e > 0.7
                    ? 0.25
                    : 0;
        }

        for (let cy = 0; cy <= H; cy++) {
            for (let cx = 0; cx <= W; cx++) {
                let sum = 0;
                let count = 0;
                let rough = 0;

                for (let dy = -1; dy <= 0; dy++) {
                    for (let dx = -1; dx <= 0; dx++) {
                        const tx = cx + dx;
                        const ty = cy + dy;

                        if (tx >= 0 && ty >= 0 && tx < W && ty < H) {
                            sum += tile[ty * W + tx];
                            rough = Math.max(rough, roughTile[ty * W + tx]);
                            count++;
                        }
                    }
                }

                const index = cy * (W + 1) + cx;

                this.natural[index] = count ? sum / count : 0;
                this.roughNatural[index] = rough;
            }
        }
    }

    private corner(array: Float32Array, cx: number, cy: number): number {
        const W = this.width;
        const x = cx < 0 ? 0 : cx > W ? W : cx;
        const y = cy < 0 ? 0 : cy > this.height ? this.height : cy;

        return array[y * (W + 1) + x];
    }

    private sample(array: Float32Array, x: number, y: number): number {
        const fx = Math.max(0, Math.min(this.width, x));
        const fy = Math.max(0, Math.min(this.height, y));
        const x0 = Math.min(this.width - 1, Math.floor(fx));
        const y0 = Math.min(this.height - 1, Math.floor(fy));
        const u = fx - x0;
        const v = fy - y0;
        const a = this.corner(array, x0, y0);
        const b = this.corner(array, x0 + 1, y0);
        const c = this.corner(array, x0, y0 + 1);
        const d = this.corner(array, x0 + 1, y0 + 1);

        return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    }

    /** Ground height (world Y) at float tile coordinates, flattening included. */
    heightAt(x: number, y: number): number {
        const rough = this.sample(this.rough, x, y);
        const base = this.sample(this.heights, x, y);

        return rough > 0
            ? base + rough * valueNoise(x * 2, y * 2) * 0.32
            : base;
    }

    /** Tiles raised onto a bridge deck: bridges and the roads leading onto them. */
    setDecks(decks: Set<number>): void {
        this.decks = decks;
    }

    /** What stands at float tile coordinates rests on: the ground or a bridge deck. */
    surfaceAt(x: number, y: number): number {
        const ground = this.heightAt(x, y);
        const tx = Math.floor(x);
        const ty = Math.floor(y);

        return this.decks.has(ty * this.width + tx)
            ? Math.max(ground, DECK_Y)
            : ground;
    }

    /** The height a building with this footprint stands at. */
    baseOf(x: number, y: number, w: number, h: number): number {
        let sum = 0;
        let count = 0;

        for (let cy = y; cy <= y + h; cy++) {
            for (let cx = x; cx <= x + w; cx++) {
                sum += this.corner(this.natural, cx, cy);
                count++;
            }
        }

        return Math.max(WATER_Y + 0.03, sum / Math.max(1, count));
    }

    /** Flattens the ground under these footprints (and un-flattens the rest). */
    flatten(footprints: Footprint[]): void {
        const W = this.width;
        const sums = new Float32Array(this.natural.length);
        const counts = new Uint16Array(this.natural.length);

        for (const f of footprints) {
            for (let cy = f.y; cy <= f.y + f.h; cy++) {
                for (let cx = f.x; cx <= f.x + f.w; cx++) {
                    if (cx >= 0 && cy >= 0 && cx <= W && cy <= this.height) {
                        const index = cy * (W + 1) + cx;

                        sums[index] += f.base;
                        counts[index]++;
                    }
                }
            }
        }

        for (let i = 0; i < this.natural.length; i++) {
            this.heights[i] = counts[i] ? sums[i] / counts[i] : this.natural[i];
            this.rough[i] = counts[i] ? 0 : this.roughNatural[i];
        }

        const positions = this.geometry.getAttribute(
            'position',
        ) as THREE.BufferAttribute;
        const array = positions.array as Float32Array;
        const vw = W * SUB + 1;
        const vh = this.height * SUB + 1;

        for (let j = 0; j < vh; j++) {
            for (let i = 0; i < vw; i++) {
                const k = (j * vw + i) * 3;
                const x = i / SUB;
                const y = j / SUB;

                array[k] = x;
                array[k + 1] = this.heightAt(x, y);
                array[k + 2] = y;
            }
        }

        positions.needsUpdate = true;
        this.geometry.computeVertexNormals();
        this.geometry.computeBoundingBox();
        this.geometry.computeBoundingSphere();
        this.buildSkirt();
        this.buildGrid();
        this.borderKey = '';
    }

    /** Per-frame: water waves; season / territory colours when they change. */
    update(dt: number, time: number, force = false): void {
        const game = this.game;
        const season = game.season;
        const key = `${season.id}:${game.state.epoch}`;

        if (force || key !== this.colorKey) {
            this.colorKey = key;
            this.recolor();
        }

        if (force || this.borderKey !== key) {
            this.borderKey = key;
            this.buildBorders();
        }

        this.waterNormals.offset.set(time * 0.012, time * 0.007);
        this.waterMaterial.opacity = 0.84;
        this.waterMaterial.color
            .copy(
                color(
                    game.content.biomes.find((b) => b.water)?.colors[0] ??
                        '#3f8fc4',
                ),
            )
            .lerp(color('#dfeef7'), season.snow * 0.45);
        this.waterMaterial.roughness = 0.14 + season.snow * 0.4;
        this.borderMaterial.opacity = 0.85 + Math.sin(time * 2.5) * 0.15;
        void dt;
    }

    showGrid(on: boolean): void {
        this.grid.visible = on;
    }

    private recolor(): void {
        const game = this.game;
        const map = game.map;
        const season = game.season;
        const territory = game.territory();
        const tint = season.groundTint ? color(season.groundTint) : null;
        const snow = color('#eef4f8');
        const scratch = new THREE.Color();
        const W = map.width;
        const H = map.height;

        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const i = y * W + x;
                const biome = map.biomeOfIndex(i);
                const e = map.elevation[i] / 255;
                const [a, b] = biome.colors;

                scratch.copy(color(a)).lerp(color(b), hash3(x, y, 5));
                scratch.multiplyScalar(0.93 + hash3(x, y, 9) * 0.14);

                if (isWaterBiome(biome, e)) {
                    scratch.multiplyScalar(0.7);
                } else if (isMountainBiome(biome, e)) {
                    const peak = Math.max(0, tileHeight(biome, e) - 1.2);

                    scratch.lerp(
                        snow,
                        Math.min(0.9, peak * 0.9 + season.snow * 0.6),
                    );
                } else {
                    if (tint) {
                        scratch.lerp(tint, season.snow > 0 ? 0.15 : 0.22);
                    }

                    if (season.snow > 0) {
                        scratch.lerp(
                            snow,
                            season.snow * (0.75 + hash3(x, y, 13) * 0.2),
                        );
                    }
                }

                if (
                    x < territory.minX ||
                    y < territory.minY ||
                    x > territory.maxX ||
                    y > territory.maxY
                ) {
                    const grey = (scratch.r + scratch.g + scratch.b) / 3;

                    scratch.lerp(new THREE.Color(grey, grey, grey), 0.25);
                    scratch.multiplyScalar(0.6);
                }

                this.tileColors[i * 3] = scratch.r;
                this.tileColors[i * 3 + 1] = scratch.g;
                this.tileColors[i * 3 + 2] = scratch.b;
            }
        }

        const colors = this.geometry.getAttribute(
            'color',
        ) as THREE.BufferAttribute;
        const array = colors.array as Float32Array;
        const vw = W * SUB + 1;
        const vh = H * SUB + 1;

        for (let j = 0; j < vh; j++) {
            for (let i = 0; i < vw; i++) {
                const u = Math.max(0, Math.min(W - 1, i / SUB - 0.5));
                const v = Math.max(0, Math.min(H - 1, j / SUB - 0.5));
                const x0 = Math.floor(u);
                const y0 = Math.floor(v);
                const x1 = Math.min(W - 1, x0 + 1);
                const y1 = Math.min(H - 1, y0 + 1);
                const fu = u - x0;
                const fv = v - y0;
                const k = (j * vw + i) * 3;

                for (let c = 0; c < 3; c++) {
                    const a = this.tileColors[(y0 * W + x0) * 3 + c];
                    const b = this.tileColors[(y0 * W + x1) * 3 + c];
                    const cc = this.tileColors[(y1 * W + x0) * 3 + c];
                    const d = this.tileColors[(y1 * W + x1) * 3 + c];

                    array[k + c] =
                        (a * (1 - fu) + b * fu) * (1 - fv) +
                        (cc * (1 - fu) + d * fu) * fv;
                }
            }
        }

        colors.needsUpdate = true;
        this.buildSkirt();
    }

    private buildSkirt(): void {
        const positions: number[] = [];
        const colors: number[] = [];
        const W = this.width;
        const H = this.height;
        const earth = color('#6b5136');
        const deep = color('#3d2c1c');
        const waterSide = color('#3b7fb0');
        const edge = (
            points: [number, number][],
            outward: [number, number],
        ) => {
            for (let i = 0; i < points.length - 1; i++) {
                const [ax, ay] = points[i];
                const [bx, by] = points[i + 1];
                const ha = this.heightAt(ax, ay);
                const hb = this.heightAt(bx, by);
                const ta = Math.max(ha, WATER_Y);
                const tb = Math.max(hb, WATER_Y);
                const quad: [number, number, number, THREE.Color][] = [
                    [ax, ta, ay, ha < WATER_Y ? waterSide : earth],
                    [bx, tb, by, hb < WATER_Y ? waterSide : earth],
                    [bx, SKIRT_BOTTOM, by, deep],
                    [ax, SKIRT_BOTTOM, ay, deep],
                ];
                // Facing outward: check winding with the outward direction.
                const e1 = [bx - ax, tb - ta, by - ay];
                const e2 = [0, SKIRT_BOTTOM - ta, 0];
                const nx = e1[1] * e2[2] - e1[2] * e2[1];
                const nz = e1[0] * e2[1] - e1[1] * e2[0];
                const order =
                    nx * outward[0] + nz * outward[1] >= 0
                        ? [0, 1, 3, 1, 2, 3]
                        : [0, 3, 1, 1, 3, 2];

                for (const k of order) {
                    const [x, y, z, c] = quad[k];

                    positions.push(x, y, z);
                    colors.push(c.r, c.g, c.b);
                }
            }
        };
        const line = (count: number, f: (t: number) => [number, number]) =>
            Array.from({ length: count * SUB + 1 }, (_, i) => f(i / SUB));

        edge(
            line(W, (t) => [t, 0]),
            [0, -1],
        );
        edge(
            line(W, (t) => [t, H]),
            [0, 1],
        );
        edge(
            line(H, (t) => [0, t]),
            [-1, 0],
        );
        edge(
            line(H, (t) => [W, t]),
            [1, 0],
        );

        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3),
        );
        geometry.setAttribute(
            'color',
            new THREE.Float32BufferAttribute(colors, 3),
        );
        geometry.computeVertexNormals();
        this.skirt.geometry.dispose();
        this.skirt.geometry = geometry;
    }

    private buildGrid(): void {
        const t = this.game.territory();
        const positions: number[] = [];
        const lift = 0.03;

        for (let y = t.minY; y <= t.maxY + 1; y++) {
            for (let x = t.minX; x <= t.maxX; x++) {
                positions.push(
                    x,
                    this.heightAt(x, y) + lift,
                    y,
                    x + 1,
                    this.heightAt(x + 1, y) + lift,
                    y,
                );
            }
        }

        for (let x = t.minX; x <= t.maxX + 1; x++) {
            for (let y = t.minY; y <= t.maxY; y++) {
                positions.push(
                    x,
                    this.heightAt(x, y) + lift,
                    y,
                    x,
                    this.heightAt(x, y + 1) + lift,
                    y + 1,
                );
            }
        }

        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3),
        );
        this.grid.geometry.dispose();
        this.grid.geometry = geometry;
    }

    private buildBorders(): void {
        const game = this.game;
        const positions: number[] = [];
        const colors: number[] = [];
        const current = game.territory();
        const next =
            game.state.epoch + 1 < game.content.epochs.length
                ? game.territory(game.state.epoch + 1)
                : null;

        this.buildGrid();
        this.addBorder(
            positions,
            colors,
            current,
            color('#ffe08a'),
            0.95,
            0.24,
        );

        if (
            next &&
            (next.minX !== current.minX ||
                next.minY !== current.minY ||
                next.maxX !== current.maxX ||
                next.maxY !== current.maxY)
        ) {
            this.addBorder(positions, colors, next, color('#ffffff'), 0.35, 0);
        }

        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3),
        );
        geometry.setAttribute(
            'color',
            new THREE.Float32BufferAttribute(colors, 4),
        );
        this.borders.geometry.dispose();
        this.borders.geometry = geometry;
    }

    /** A dashed glowing line along a rectangle of tiles, with a fading curtain above. */
    private addBorder(
        positions: number[],
        colors: number[],
        rect: Rect,
        c: THREE.Color,
        alpha: number,
        curtain: number,
    ): void {
        const x0 = rect.minX;
        const y0 = rect.minY;
        const x1 = rect.maxX + 1;
        const y1 = rect.maxY + 1;
        const segments: [number, number, number, number, number, number][] = [];

        for (let x = x0; x < x1; x++) {
            segments.push([x, y0, x + 1, y0, 0, 1], [x, y1, x + 1, y1, 0, -1]);
        }

        for (let y = y0; y < y1; y++) {
            segments.push([x0, y, x0, y + 1, 1, 0], [x1, y, x1, y + 1, -1, 0]);
        }

        const push = (x: number, y: number, z: number, a: number) => {
            positions.push(x, y, z);
            colors.push(c.r, c.g, c.b, a);
        };
        const width = 0.07;
        const lift = 0.035;

        for (const [ax, ay, bx, by, nx, ny] of segments) {
            for (const [from, to] of [
                [0.08, 0.42],
                [0.58, 0.92],
            ]) {
                const sx = ax + (bx - ax) * from;
                const sy = ay + (by - ay) * from;
                const ex = ax + (bx - ax) * to;
                const ey = ay + (by - ay) * to;
                const hs = this.heightAt(sx, sy) + lift;
                const he = this.heightAt(ex, ey) + lift;
                const ix = nx * width;
                const iy = ny * width;

                // The flat dash on the ground (inside the border).
                push(sx, hs, sy, alpha);
                push(ex, he, ey, alpha);
                push(ex + ix, he, ey + iy, alpha);
                push(sx, hs, sy, alpha);
                push(ex + ix, he, ey + iy, alpha);
                push(sx + ix, hs, sy + iy, alpha);

                if (curtain > 0) {
                    push(sx, hs, sy, alpha * 0.45);
                    push(ex, he, ey, alpha * 0.45);
                    push(ex, he + curtain, ey, 0);
                    push(sx, hs, sy, alpha * 0.45);
                    push(ex, he + curtain, ey, 0);
                    push(sx, hs + curtain, sy, 0);
                }
            }
        }
    }

    dispose(): void {
        this.geometry.dispose();
        this.material.dispose();
        this.water.geometry.dispose();
        this.waterMaterial.dispose();
        this.waterNormals.dispose();
        this.skirt.geometry.dispose();
        this.skirtMaterial.dispose();
        this.borders.geometry.dispose();
        this.borderMaterial.dispose();
        this.grid.geometry.dispose();
        this.gridMaterial.dispose();
    }
}
