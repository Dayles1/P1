/**
 * Colour helpers shared by the 3D scene: palette lookups (palette keys,
 * "walls" variants, #hex), mixing and a small stable hash for looks.
 */

import * as THREE from 'three';
import type { Palette } from '../engine/content/types';

const cache = new Map<string, THREE.Color>();

/** A cached THREE.Color for a CSS colour string (do not mutate it). */
export function color(css: string): THREE.Color {
    let value = cache.get(css);

    if (!value) {
        value = new THREE.Color();

        try {
            value.setStyle(css, THREE.SRGBColorSpace);
        } catch {
            value.set(0xff00ff);
        }

        cache.set(css, value);
    }

    return value;
}

/** A new colour between two CSS colours. */
export function mixColor(a: string, b: string, t: number): THREE.Color {
    return color(a).clone().lerp(color(b), t);
}

/** Wall variants of a palette (never empty). */
export function wallsOf(palette: Palette): string[] {
    return Array.isArray(palette.walls) && palette.walls.length
        ? palette.walls
        : [palette.wall];
}

/**
 * Resolves a model colour: a "#hex" value, "walls" (the building's wall
 * variant) or a palette key. Unknown keys come out magenta so mistakes in
 * the content are easy to spot.
 */
export function resolveColor(
    value: string,
    palette: Palette,
    wallIndex: number,
): string {
    if (!value) {
        return '#ff00ff';
    }

    if (value.startsWith('#') || value.startsWith('rgb')) {
        return value;
    }

    if (value === 'walls') {
        const walls = wallsOf(palette);

        return walls[Math.abs(wallIndex) % walls.length];
    }

    const found = palette[value];

    return typeof found === 'string' ? found : '#ff00ff';
}

/** A stable 0..1 number for up to three integers. */
export function hash3(x: number, y: number, z = 0): number {
    let h =
        (Math.imul(x | 0, 374761393) +
            Math.imul(y | 0, 668265263) +
            Math.imul(z | 0, 1274126177)) |
        0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = Math.imul(h ^ (h >>> 16), 2246822519);

    return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** A stable small integer from a string (district colours etc.). */
export function hashString(text: string): number {
    let h = 2166136261;

    for (let i = 0; i < text.length; i++) {
        h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    }

    return h >>> 0;
}

export function clamp(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);

    return t * t * (3 - 2 * t);
}

/** Exponential damping factor for smoothing towards a goal. */
export function damp(rate: number, dt: number): number {
    return 1 - Math.exp(-rate * dt);
}
