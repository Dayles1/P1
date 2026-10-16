/**
 * The mountain range north of the map: scenery outside the playable land,
 * much wider than the map and several ridges deep (wooded foothills, a
 * rocky range, far snowy peaks). Its foot meets the ground along the map's
 * north edge (row 0) and rises right away, so buildings on that row stand
 * against the slope. Built once from fixed hashes — the same mountains for
 * everyone. It casts and receives no shadows and is never picked; the fog
 * pales the far ridges into the sky.
 *
 * Coordinates: x as on the map, d = tiles north of row 0 (world Z = −d).
 */

import * as THREE from 'three';
import { color, hash3, smoothstep } from './colors';

/** How far the range reaches east and west past the map, and north. */
const REACH = 1200;
const DEPTH = 520;

const GRASS = '#5f8a3c';
const WOOD = '#3c5a2c';
const ROCK = '#6f675f';
const ROCK_DARK = '#4c4743';
const SNOW = '#f2f6fa';
/** Below this height the slopes are wooded; above the snow line, white. */
const TREE_LINE = 5;
const SNOW_LINE = 15;

/** Smooth 1D value noise, 0..1. */
function noise1(t: number, salt: number): number {
    const t0 = Math.floor(t);
    const f = t - t0;
    const s = f * f * (3 - 2 * f);
    const a = hash3(t0, salt, 17);
    const b = hash3(t0 + 1, salt, 17);

    return a + (b - a) * s;
}

/** Fractal 1D noise with sharp crests, 0..1. */
function crest(t: number, salt: number): number {
    let sum = 0;
    let weight = 0;
    let amplitude = 1;
    let frequency = 1;

    for (let octave = 0; octave < 4; octave++) {
        const n = noise1(t * frequency, salt + octave * 31);

        sum += (1 - Math.abs(n * 2 - 1)) * amplitude;
        weight += amplitude;
        amplitude *= 0.5;
        frequency *= 2.1;
    }

    return sum / weight;
}

/** Smooth 2D value noise, −0.5..0.5 — rocky detail. */
function noise2(x: number, y: number): number {
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

/** A ridge line `centre` tiles north, `width` wide: 1 on its crest. */
function ridge(d: number, centre: number, width: number): number {
    const t = (d - centre) / width;

    return Math.exp(-t * t * 2.2);
}

/** Height of the range at x, d tiles north of row 0 (0 at the foot). */
export function mountainHeight(x: number, d: number): number {
    if (d <= 0) {
        return 0;
    }

    // A slope that starts right at row 0, then the ridges behind it.
    const slope = Math.min(0.5 * d, 4) * (0.8 + 0.4 * noise1(x / 9, 4));
    const foothills = (2.5 + 7 * crest(x / 20, 1) ** 1.5) * ridge(d, 11, 8);
    const range = (6 + 17 * crest(x / 44, 2) ** 1.5) * ridge(d, 36, 15);
    const peaks = (15 + 24 * crest(x / 95, 3) ** 1.5) * ridge(d, 110, 40);
    const massif = 11 * smoothstep(60, 170, d);
    const h = Math.max(slope, foothills, range, peaks, massif);
    const rocky = 1 + noise2(x / 8, d / 8) * 0.24 + noise2(x / 3, d / 3) * 0.08;

    return h * rocky * (1 - Math.exp(-d / 0.9));
}

/** Positions from 0 outwards, the gaps growing from `step` up to `max`. */
function steps(to: number, step: number, grow: number, max: number): number[] {
    const values = [0];
    let at = 0;
    let gap = step;

    while (at < to) {
        at = Math.min(to, at + gap);
        values.push(at);
        gap = Math.min(max, gap * grow);
    }

    return values;
}

export class Backdrop {
    readonly group = new THREE.Group();

    private geometry: THREE.BufferGeometry;
    private material: THREE.MeshStandardMaterial;
    /** Per face: mean height, how upright its normal is, a stable jitter. */
    private faces: Float32Array;
    private snowKey = -1;

    constructor(width: number) {
        // Columns: even near the map, wider and wider out to the sides.
        const outward = steps(REACH, 2, 1.08, 40).slice(1);
        const xs = [
            ...outward.map((v) => -60 - v).reverse(),
            ...steps(width + 120, 2, 1, 2).map((v) => v - 60),
            ...outward.map((v) => width + 60 + v),
        ];
        const ds = steps(DEPTH, 0.5, 1.07, 14);
        const heights = new Float32Array(xs.length * ds.length);

        ds.forEach((d, j) => {
            xs.forEach((x, i) => {
                heights[j * xs.length + i] = mountainHeight(x, d);
            });
        });

        // Faceted: every triangle has its own vertices, so its own colour.
        const count = (xs.length - 1) * (ds.length - 1) * 2;
        const positions = new Float32Array(count * 9);
        const a = new THREE.Vector3();
        const b = new THREE.Vector3();
        const c = new THREE.Vector3();
        const normal = new THREE.Vector3();
        const at = (v: THREE.Vector3, i: number, j: number) =>
            v.set(xs[i], heights[j * xs.length + i], -ds[j]);
        let face = 0;

        this.faces = new Float32Array(count * 3);

        const add = (salt: number) => {
            positions.set(
                [a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z],
                face * 9,
            );
            normal.subVectors(b, a).cross(c.clone().sub(a)).normalize();
            this.faces[face * 3] = (a.y + b.y + c.y) / 3;
            this.faces[face * 3 + 1] = normal.y;
            this.faces[face * 3 + 2] = hash3(
                Math.round(a.x),
                Math.round(a.z),
                salt,
            );
            face++;
        };

        for (let j = 0; j < ds.length - 1; j++) {
            for (let i = 0; i < xs.length - 1; i++) {
                // Rows run north (−Z): counter-clockwise from above.
                at(a, i, j);
                at(b, i + 1, j);
                at(c, i, j + 1);
                add(3);
                at(a, i + 1, j);
                at(b, i + 1, j + 1);
                at(c, i, j + 1);
                add(5);
            }
        }

        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(positions, 3),
        );
        this.geometry.setAttribute(
            'color',
            new THREE.BufferAttribute(new Float32Array(positions.length), 3),
        );
        this.geometry.computeVertexNormals();
        this.geometry.computeBoundingSphere();

        this.material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 1,
            metalness: 0,
        });

        const mesh = new THREE.Mesh(this.geometry, this.material);

        mesh.name = 'mountains';
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        this.group.add(mesh);
        this.recolor(0);
    }

    /** Season snow brings the snow line down the slopes. */
    update(snow: number): void {
        if (Math.round(snow * 20) !== this.snowKey) {
            this.recolor(snow);
        }
    }

    private recolor(snow: number): void {
        this.snowKey = Math.round(snow * 20);

        const colors = this.geometry.getAttribute(
            'color',
        ) as THREE.BufferAttribute;
        const array = colors.array as Float32Array;
        const out = new THREE.Color();
        const snowLine = SNOW_LINE - snow * 10;

        for (let face = 0; face < this.faces.length / 3; face++) {
            const h = this.faces[face * 3];
            const up = this.faces[face * 3 + 1];
            const jitter = this.faces[face * 3 + 2];
            const steep = 1 - smoothstep(0.5, 0.85, up);

            out.copy(color(ROCK)).lerp(
                color(ROCK_DARK),
                jitter * 0.55 + steep * 0.3,
            );
            // Wooded lower slopes (bare rock where steep), grass at the foot.
            out.lerp(
                color(WOOD),
                (1 - smoothstep(TREE_LINE - 2, TREE_LINE + 2, h + jitter * 3)) *
                    (1 - steep * 0.6),
            );
            out.lerp(color(GRASS), 1 - smoothstep(0.4, 1.4, h + jitter * 0.6));
            // Snow where it is high and not too steep; in winter lower down.
            out.lerp(
                color(SNOW),
                smoothstep(snowLine - 2, snowLine + 4, h + jitter * 6) *
                    smoothstep(0.25, 0.6, up),
            );
            out.lerp(color(SNOW), snow * 0.5 * smoothstep(1, 4, h));

            for (let k = 0; k < 3; k++) {
                array[face * 9 + k * 3] = out.r;
                array[face * 9 + k * 3 + 1] = out.g;
                array[face * 9 + k * 3 + 2] = out.b;
            }
        }

        colors.needsUpdate = true;
    }

    dispose(): void {
        this.geometry.dispose();
        this.material.dispose();
    }
}
