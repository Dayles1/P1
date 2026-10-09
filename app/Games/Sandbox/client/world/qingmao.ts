/**
 * Qing Mao Mountain (青茅山), the first land of the world of Gu: one great
 * mountain north of the spawn, green with bamboo up its slopes, rocky at
 * the top, and three clan villages on terraces cut into it —
 *
 * - the Gu Yue clan (古月, "ancient moon") on the southern slope, where
 *   the hero was born: the spawn is its square;
 * - the Bai clan (白, "white") on the western slope;
 * - the Xiong clan (熊, "bear") on the eastern slope.
 *
 * Dirt paths run from each village's gate down to the Gu Yue gate. This
 * file is only the plan — where things are, as pure functions of (x, z);
 * the terrain (terrain.ts) raises the mountain and levels the terraces
 * from it, the villages (villages.ts) build the houses on them, and the
 * map draws it.
 */

import { fbm, smoothstep } from './noise';

export type Clan = 'gu_yue' | 'bai' | 'xiong';

export const CLANS: Clan[] = ['gu_yue', 'bai', 'xiong'];

export interface Village {
    clan: Clan;
    x: number;
    z: number;
    /** The level ground inside the palisade, metres from the centre. */
    radius: number;
    /** Which way (radians, clockwise from north) each gate opens. */
    gates: number[];
}

/** The summit, and how far out (m) the mountain's slopes reach. */
export const SUMMIT = { x: 0, z: -135, height: 118, reach: 205 };

/** The terraces level out over this much ground past the palisade, m. */
const TERRACE_FALL = 26;

/** South = π, east = π/2, west = -π/2 (clockwise from north). */
export const VILLAGES: Village[] = [
    { clan: 'gu_yue', x: 0, z: 0, radius: 58, gates: [Math.PI, -1.15, 1.1] },
    { clan: 'bai', x: -128, z: -92, radius: 46, gates: [2.0] },
    { clan: 'xiong', x: 124, z: -78, radius: 46, gates: [-2.05] },
];

/** The Gu Yue village: the hero's home and the spawn. */
export const HOME = VILLAGES[0];

/** A gate's spot on a village's palisade. */
export function gateAt(
    village: Village,
    bearing: number,
    out = { x: 0, z: 0 },
): { x: number; z: number } {
    out.x = village.x + Math.sin(bearing) * village.radius;
    out.z = village.z - Math.cos(bearing) * village.radius;

    return out;
}

/** The paths: from each other village's gate to a Gu Yue gate. [x, z] points. */
export const PATHS: [number, number][][] = [
    [
        [gateAt(VILLAGES[1], 2.0).x, gateAt(VILLAGES[1], 2.0).z],
        [-84, -38],
        [-62, -24],
        [gateAt(HOME, -1.15).x, gateAt(HOME, -1.15).z],
    ],
    [
        [gateAt(VILLAGES[2], -2.05).x, gateAt(VILLAGES[2], -2.05).z],
        [86, -28],
        [62, -16],
        [gateAt(HOME, 1.1).x, gateAt(HOME, 1.1).z],
    ],
    [
        [gateAt(HOME, Math.PI).x, gateAt(HOME, Math.PI).z],
        [4, 84],
        [-6, 120],
    ],
];

/** Half the width of a path, m. */
export const PATH_HALF = 2.2;

/** How much of the mountain is here: 1 at the summit, 0 past its foot. */
export function mountainShare(x: number, z: number): number {
    const distance = Math.hypot(x - SUMMIT.x, z - SUMMIT.z);

    return Math.max(0, 1 - distance / SUMMIT.reach);
}

/** The mountain's own height at a point (before the terraces are cut). */
export function mountainHeight(x: number, z: number): number {
    const share = mountainShare(x, z);

    if (share <= 0) {
        return 0;
    }

    // Ridges running down from the top, and a rougher crown.
    const ridges = 1 - Math.abs(fbm(x / 55 + 3.1, z / 55 - 1.7, 4242, 3)) * 2.2;
    const rough = fbm(x / 24, z / 24, 4243, 3);

    return (
        SUMMIT.height * Math.pow(share, 1.25) +
        Math.max(0, ridges) * 16 * share +
        rough * 6 * share * share
    );
}

/** The village whose terrace a point is on (inside its palisade), or null. */
export function villageAt(x: number, z: number, margin = 0): Village | null {
    for (const village of VILLAGES) {
        if (
            Math.hypot(x - village.x, z - village.z) <
            village.radius + margin
        ) {
            return village;
        }
    }

    return null;
}

/**
 * How much a point is levelled to a village's terrace, 0…1, and which
 * village: 1 inside the palisade, fading to 0 over the slope below it.
 */
export function terraceAt(
    x: number,
    z: number,
): { village: Village; weight: number } | null {
    for (const village of VILLAGES) {
        const distance = Math.hypot(x - village.x, z - village.z);
        const weight = smoothstep(
            village.radius + TERRACE_FALL,
            village.radius + 2,
            distance,
        );

        if (weight > 0) {
            return { village, weight };
        }
    }

    return null;
}

/** How far a point is from the nearest path's middle line, m. */
export function pathDistance(x: number, z: number): number {
    let best = Infinity;

    for (const path of PATHS) {
        for (let i = 1; i < path.length; i++) {
            const [ax, az] = path[i - 1];
            const [bx, bz] = path[i];
            const dx = bx - ax;
            const dz = bz - az;
            const along = Math.max(
                0,
                Math.min(
                    1,
                    ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz),
                ),
            );

            best = Math.min(
                best,
                Math.hypot(x - (ax + dx * along), z - (az + dz * along)),
            );
        }
    }

    return best;
}

/** Whether nothing may grow or lie here: a terrace or a path. */
export function keptClear(x: number, z: number, margin = 0): boolean {
    return (
        villageAt(x, z, margin + 4) !== null ||
        pathDistance(x, z) < PATH_HALF + margin
    );
}
