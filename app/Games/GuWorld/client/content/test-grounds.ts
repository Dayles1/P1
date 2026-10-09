/**
 * The proving ground: a small flat field to try the engine on, with what
 * the body's physics must cope with. It is a test location for the
 * engine (stage 2), not part of the world of Gu.
 *
 * - a gentle mound (~20° at its steepest) to walk up and down;
 * - a steep mound (~58°) to slide off — steeper than one can stand on;
 * - five steps up to a platform, a crate to climb onto, a wall too high
 *   to climb.
 *
 * Its size and where a hero appears are world settings
 * (config/gu_world.php), not here.
 */

import { heightField } from '../world/ground';
import type { LocationContent } from './types';

/** A smooth round hill: `height` tall, its slope set by `radius`. */
function mound(
    x: number,
    z: number,
    centreX: number,
    centreZ: number,
    height: number,
    radius: number,
): number {
    const distance = (x - centreX) ** 2 + (z - centreZ) ** 2;

    return height * Math.exp(-distance / (radius * radius));
}

export const GENTLE_MOUND = { x: 24, z: -24, height: 6, radius: 14 };
export const STEEP_MOUND = { x: -24, z: -24, height: 8, radius: 4.2 };

const STEP_RISE = 0.3;

export const testGrounds: LocationContent = {
    ground: heightField(
        (x, z) =>
            mound(
                x,
                z,
                GENTLE_MOUND.x,
                GENTLE_MOUND.z,
                GENTLE_MOUND.height,
                GENTLE_MOUND.radius,
            ) +
            mound(
                x,
                z,
                STEEP_MOUND.x,
                STEEP_MOUND.z,
                STEEP_MOUND.height,
                STEEP_MOUND.radius,
            ),
    ),
    blocks: [
        ...[1, 2, 3, 4, 5].map((n) => ({
            id: `block:test_grounds:step_${n}`,
            x: 6 + n * 0.6,
            z: -4,
            width: 0.6,
            depth: 2.4,
            height: n * STEP_RISE,
        })),
        {
            id: 'block:test_grounds:platform',
            x: 11.4,
            z: -4,
            width: 3,
            depth: 3,
            height: 5 * STEP_RISE,
        },
        {
            id: 'block:test_grounds:crate',
            x: -6,
            z: -6,
            width: 1.4,
            depth: 1.4,
            height: 1.2,
        },
        {
            id: 'block:test_grounds:wall',
            x: -12,
            z: 4,
            width: 0.6,
            depth: 8,
            height: 3.5,
        },
    ],
};
