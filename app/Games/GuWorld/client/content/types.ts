/** What a location is made of, beyond its world settings (world/config.ts). */

import type { Ground } from '../world/ground';

/** A solid box standing on the ground; `id` is its stable entity id. */
export interface BlockDefinition {
    id: string;
    /** Centre on the ground. */
    x: number;
    z: number;
    width: number;
    depth: number;
    height: number;
}

export interface LocationContent {
    ground: Ground;
    blocks: BlockDefinition[];
}
