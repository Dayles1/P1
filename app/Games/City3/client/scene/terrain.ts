/**
 * The ground: one height-field mesh for the map (two vertices per tile
 * edge), coloured per vertex by blending the biome colours of nearby
 * tiles, with the season's tint and snow and darker, greyer columns outside
 * the player's land. The map is flat land, a beach sloping into the water
 * at its far end, and a sea floor sinking under an animated water surface.
 *
 * The world does not end at the map's edge: an apron of the same ground
 * (always in the locked tint) goes on east, west and south far past the
 * fog, under a sea surface that reaches the horizon, so there is no edge
 * and no slab anywhere. North of row 0 stands the mountain range
 * (backdrop.ts). Under buildings the ground is flattened to the building's
 * base height. Also draws the border of the player's land and the
 * placement grid.
 */

import * as THREE from 'three';
import type { BiomeDef } from '../engine/content/types';
import type { Game } from '../engine/sim/game';
import { bandAt, groundHeight, SHORE_ROWS } from '../engine/world/layout';
import type { Band, MapLayout } from '../engine/world/layout';
import { clamp, color, hash3, smoothstep } from './colors';

export const WATER_Y = -0.1;
/** Top of a bridge over water, level with the low shore. */
export const DECK_Y = 0;
const SUB = 2;
/** How far the ground and the sea go on past the map east, west and south. */
const APRON = 1200;
/** Off the map, ground this close to it keeps one colour per tile. */
const APRON_DETAIL = 24;

export interface Footprint {
    x: number;
    y: number;
    w: number;
    h: number;
    base: number;
}

type Rect = { minX: number; minY: number; maxX: number; maxY: number };

/** What a recolour shades with: the season and the player's columns. */
interface Shade {
    tint: THREE.Color | null;
    snow: number;
    minX: number;
    maxX: number;
}

const SNOW = '#eef4f8';
const WET_SAND = '#b8a473';

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

/** Positions from `from` to `to` (inclusive) `step` apart. */
function evenly(from: number, to: number, step: number): number[] {
    const count = Math.round((to - from) / step);

    return Array.from({ length: count + 1 }, (_, i) => from + i * step);
}

/** Positions from `from` outwards to `to`, the gaps growing from `step`. */
function widening(from: number, to: number, step: number): number[] {
    const direction = Math.sign(to - from);
    const values = [from];
    let at = from;
    let gap = step;

    while ((to - at) * direction > gap * 0.5) {
        at += gap * direction;
        values.push((to - at) * direction < 0 ? to : at);
        gap = Math.min(80, gap * 1.25);
    }

    if (values.at(-1) !== to) {
        values.push(to);
    }

    return values;
}

/** The ground of one game. */
export class Terrain {
    readonly group = new THREE.Group();
    readonly width: number;
    readonly height: number;

    private layout: MapLayout;
    private bandBiomes: Record<Band, BiomeDef>;
    /** Corner heights before and after flattening, (W+1)·(H+1). */
    private natural: Float32Array;
    private heights: Float32Array;
    /** Tile colours on and near the map: x −PAD..W+PAD−1, y 0..H+PAD−1. */
    private tileColors: Float32Array;
    private decks = new Set<number>();

    private geometry = new THREE.BufferGeometry();
    private mesh: THREE.Mesh;
    private material: THREE.MeshStandardMaterial;
    private apron: THREE.Mesh;
    private water: THREE.Mesh;
    private waterMaterial: THREE.MeshStandardMaterial;
    private waterNormals: THREE.DataTexture;
    private borders: THREE.Mesh;
    private borderMaterial: THREE.MeshBasicMaterial;
    private grid: THREE.LineSegments;
    private gridMaterial: THREE.LineBasicMaterial;
    private colorKey = '';
    private borderKey = '';
    private scratch = new THREE.Color();
    private corners = [
        new THREE.Color(),
        new THREE.Color(),
        new THREE.Color(),
        new THREE.Color(),
    ];

    constructor(private game: Game) {
        const map = game.map;
        const biomes = game.content.world.map.biomes;

        this.width = map.width;
        this.height = map.height;
        this.layout = game.layout;
        this.bandBiomes = {
            land: game.content.biomes[game.content.biomeIndexOf(biomes.land)],
            beach: game.content.biomes[
                game.content.biomeIndexOf(biomes.beach)
            ],
            sea: game.content.biomes[game.content.biomeIndexOf(biomes.sea)],
        };

        const corners = (map.width + 1) * (map.height + 1);

        this.natural = new Float32Array(corners);
        this.heights = new Float32Array(corners);
        this.tileColors = new Float32Array(
            (map.width + APRON_DETAIL * 2) * (map.height + APRON_DETAIL) * 3,
        );

        for (let cy = 0; cy <= map.height; cy++) {
            const h = groundHeight(this.layout, cy);

            for (let cx = 0; cx <= map.width; cx++) {
                this.natural[cy * (map.width + 1) + cx] = h;
            }
        }

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

        this.apron = new THREE.Mesh(this.buildApron(), this.material);
        this.apron.receiveShadow = true;
        this.apron.name = 'apron';
        this.group.add(this.apron);

        // The sea: from just before the shore to far past the fog.
        const seaFrom = this.layout.seaY - SHORE_ROWS;
        const seaWidth = map.width + APRON * 2;
        const seaDepth = map.height - seaFrom + APRON;

        this.waterNormals = waterNormalMap();
        this.waterNormals.repeat.set(seaWidth / 5, seaDepth / 5);

        this.waterMaterial = new THREE.MeshStandardMaterial({
            color: color(this.bandBiomes.sea.colors[0]),
            roughness: 0.24,
            metalness: 0.1,
            transparent: true,
            opacity: 0.84,
            normalMap: this.waterNormals,
            normalScale: new THREE.Vector2(0.22, 0.22),
            depthWrite: false,
        });

        const waterGeometry = new THREE.PlaneGeometry(seaWidth, seaDepth);

        waterGeometry.rotateX(-Math.PI / 2);
        waterGeometry.translate(
            map.width / 2,
            WATER_Y,
            seaFrom + seaDepth / 2,
        );
        this.water = new THREE.Mesh(waterGeometry, this.waterMaterial);
        this.water.receiveShadow = true;
        this.water.renderOrder = 1;
        this.group.add(this.water);

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

    /**
     * Natural ground height at a distance y from the north edge: the
     * profile between whole rows, exactly as the map's mesh has it.
     */
    private profile(y: number): number {
        if (y <= 0) {
            return 0;
        }

        if (y >= this.height) {
            return groundHeight(this.layout, y);
        }

        const y0 = Math.floor(y);
        const a = groundHeight(this.layout, y0);

        return a + (groundHeight(this.layout, y0 + 1) - a) * (y - y0);
    }

    /** The ground past the map: west, east and south of it, out to the fog. */
    private buildApron(): THREE.BufferGeometry {
        const W = this.width;
        const H = this.height;
        // Rows: one per half tile alongside the map (matching its mesh at the seam), then wider.
        const south = widening(H, H + APRON, 0.5);
        const rows = [...evenly(0, H, 1 / SUB).slice(0, -1), ...south];
        const west = [
            ...widening(-APRON_DETAIL, -APRON, 1).reverse(),
            ...evenly(-APRON_DETAIL, 0, 1).slice(1),
        ];
        const east = [
            ...evenly(W, W + APRON_DETAIL, 1),
            ...widening(W + APRON_DETAIL, W + APRON, 1).slice(1),
        ];
        const below = evenly(0, W, 1 / SUB);
        const positions: number[] = [];
        const indices: number[] = [];
        const patch = (xs: number[], zs: number[]) => {
            const first = positions.length / 3;

            for (const z of zs) {
                const y = this.profile(z);

                for (const x of xs) {
                    positions.push(x, y, z);
                }
            }

            for (let j = 0; j < zs.length - 1; j++) {
                for (let i = 0; i < xs.length - 1; i++) {
                    const a = first + j * xs.length + i;
                    const b = a + 1;
                    const c = a + xs.length;
                    const d = c + 1;

                    indices.push(a, c, b, b, c, d);
                }
            }
        };

        patch(west, rows);
        patch(east, rows);
        patch(below, south);

        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3),
        );
        geometry.setAttribute(
            'color',
            new THREE.Float32BufferAttribute(
                new Float32Array(positions.length),
                3,
            ),
        );
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();

        return geometry;
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

    /**
     * Ground height (world Y) at float tile coordinates, flattening
     * included; off the map, the same natural profile goes on.
     */
    heightAt(x: number, y: number): number {
        if (x < 0 || y < 0 || x > this.width || y > this.height) {
            return this.profile(y);
        }

        return this.sample(this.heights, x, y);
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
        this.buildGrid();
        this.borderKey = '';
    }

    /** Per-frame: water waves; season / land colours when they change. */
    update(dt: number, time: number, force = false): void {
        const game = this.game;
        const season = game.season;
        const land = game.state.land;
        const key = `${season.id}:${land.minX}:${land.maxX}`;

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
            .copy(color(this.bandBiomes.sea.colors[0]))
            .lerp(color('#dfeef7'), season.snow * 0.45);
        this.waterMaterial.roughness = 0.24 + season.snow * 0.35;
        this.borderMaterial.opacity = 0.85 + Math.sin(time * 2.5) * 0.15;
        void dt;
    }

    showGrid(on: boolean): void {
        this.grid.visible = on;
    }

    /** The colour of any tile, on the map or off it. */
    private tileColor(
        x: number,
        y: number,
        shade: Shade,
        out: THREE.Color,
    ): THREE.Color {
        const layout = this.layout;
        const map = this.game.map;
        const band = bandAt(layout, y);
        const biome = map.inBounds(x, y)
            ? map.biomeAt(x, y)
            : this.bandBiomes[band];
        const [a, b] = biome.colors;
        // How far past the shore line the tile's middle is (negative = on the beach).
        const fromShore = y + 0.5 - layout.seaY;

        out.copy(color(a)).lerp(color(b), hash3(x, y, 5));
        out.multiplyScalar(0.93 + hash3(x, y, 9) * 0.14);

        if (biome.water) {
            // The sea floor through the water: sandy by the shore, darker further out.
            out.lerp(color(WET_SAND), 1 - smoothstep(0, 2.5, fromShore));
            out.multiplyScalar(0.72 - 0.3 * smoothstep(1, 14, fromShore));
        } else {
            if (band === 'beach') {
                out.lerp(color(WET_SAND), smoothstep(-2.2, 0, fromShore) * 0.7);
            }

            if (shade.tint) {
                out.lerp(shade.tint, shade.snow > 0 ? 0.15 : 0.22);
            }

            if (shade.snow > 0) {
                out.lerp(
                    color(SNOW),
                    shade.snow * (0.75 + hash3(x, y, 13) * 0.2),
                );
            }
        }

        if (x < shade.minX || x > shade.maxX) {
            const grey = (out.r + out.g + out.b) / 3;

            out.lerp(this.scratch.setRGB(grey, grey, grey), 0.3);
            out.multiplyScalar(0.58);
        }

        return out;
    }

    /** A tile's colour from the cache near the map, else worked out. */
    private cachedColor(
        x: number,
        y: number,
        shade: Shade,
        out: THREE.Color,
    ): THREE.Color {
        const columns = this.width + APRON_DETAIL * 2;
        const cx = x + APRON_DETAIL;

        if (cx >= 0 && cx < columns && y >= 0 && y < this.height + APRON_DETAIL) {
            const k = (y * columns + cx) * 3;

            return out.setRGB(
                this.tileColors[k],
                this.tileColors[k + 1],
                this.tileColors[k + 2],
            );
        }

        return this.tileColor(x, y, shade, out);
    }

    /** A vertex colour: the four nearest tiles' colours blended (bilinear). */
    private vertexColor(
        x: number,
        z: number,
        shade: Shade,
        array: Float32Array,
        k: number,
    ): void {
        const u = x - 0.5;
        const v = Math.max(0, z - 0.5);
        const x0 = Math.floor(u);
        const y0 = Math.floor(v);
        const fu = u - x0;
        const fv = v - y0;
        const [a, b, c, d] = this.corners;

        this.cachedColor(x0, y0, shade, a);
        this.cachedColor(x0 + 1, y0, shade, b);
        this.cachedColor(x0, y0 + 1, shade, c);
        this.cachedColor(x0 + 1, y0 + 1, shade, d);
        array[k] =
            (a.r * (1 - fu) + b.r * fu) * (1 - fv) +
            (c.r * (1 - fu) + d.r * fu) * fv;
        array[k + 1] =
            (a.g * (1 - fu) + b.g * fu) * (1 - fv) +
            (c.g * (1 - fu) + d.g * fu) * fv;
        array[k + 2] =
            (a.b * (1 - fu) + b.b * fu) * (1 - fv) +
            (c.b * (1 - fu) + d.b * fu) * fv;
    }

    private recolor(): void {
        const game = this.game;
        const season = game.season;
        const shade: Shade = {
            tint: season.groundTint ? color(season.groundTint) : null,
            snow: season.snow,
            minX: game.state.land.minX,
            maxX: game.state.land.maxX,
        };
        const W = this.width;
        const H = this.height;
        const columns = W + APRON_DETAIL * 2;
        const tile = new THREE.Color();

        for (let y = 0; y < H + APRON_DETAIL; y++) {
            for (let cx = 0; cx < columns; cx++) {
                const k = (y * columns + cx) * 3;

                this.tileColor(cx - APRON_DETAIL, y, shade, tile);
                this.tileColors[k] = tile.r;
                this.tileColors[k + 1] = tile.g;
                this.tileColors[k + 2] = tile.b;
            }
        }

        for (const geometry of [this.geometry, this.apron.geometry]) {
            const colors = geometry.getAttribute(
                'color',
            ) as THREE.BufferAttribute;
            const positions = geometry.getAttribute(
                'position',
            ) as THREE.BufferAttribute;
            const array = colors.array as Float32Array;

            for (let i = 0; i < positions.count; i++) {
                this.vertexColor(
                    positions.getX(i),
                    clamp(positions.getZ(i), 0, H + APRON),
                    shade,
                    array,
                    i * 3,
                );
            }

            colors.needsUpdate = true;
        }
    }

    /** Lines and borders lie on the ground or, where it is under water, on the water. */
    private surfaceY(x: number, y: number): number {
        return Math.max(this.heightAt(x, y), WATER_Y);
    }

    private buildGrid(): void {
        const t = this.game.territory();
        const positions: number[] = [];
        const lift = 0.03;

        for (let y = t.minY; y <= t.maxY + 1; y++) {
            for (let x = t.minX; x <= t.maxX; x++) {
                positions.push(
                    x,
                    this.surfaceY(x, y) + lift,
                    y,
                    x + 1,
                    this.surfaceY(x + 1, y) + lift,
                    y,
                );
            }
        }

        for (let x = t.minX; x <= t.maxX + 1; x++) {
            for (let y = t.minY; y <= t.maxY; y++) {
                positions.push(
                    x,
                    this.surfaceY(x, y) + lift,
                    y,
                    x,
                    this.surfaceY(x, y + 1) + lift,
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
        const positions: number[] = [];
        const colors: number[] = [];

        this.buildGrid();
        this.addBorder(
            positions,
            colors,
            this.game.territory(),
            color('#ffe08a'),
            0.95,
            0.24,
        );

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
                const hs = this.surfaceY(sx, sy) + lift;
                const he = this.surfaceY(ex, ey) + lift;
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
        this.apron.geometry.dispose();
        this.material.dispose();
        this.water.geometry.dispose();
        this.waterMaterial.dispose();
        this.waterNormals.dispose();
        this.borders.geometry.dispose();
        this.borderMaterial.dispose();
        this.grid.geometry.dispose();
        this.gridMaterial.dispose();
    }
}
