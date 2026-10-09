/** The solid parts of a location's content, as colliders. */

import * as THREE from 'three';
import type { BlockDefinition } from '../content/types';
import type { Ground } from '../world/ground';
import type { BoxCollider } from './colliders';

/** A block's box: from below the ground (no gap under it) to its top. */
export function blockCollider(
    block: BlockDefinition,
    ground: Ground,
): BoxCollider {
    const base = ground.heightAt(block.x, block.z);

    return {
        kind: 'box',
        min: new THREE.Vector3(
            block.x - block.width / 2,
            base - 1,
            block.z - block.depth / 2,
        ),
        max: new THREE.Vector3(
            block.x + block.width / 2,
            base + block.height,
            block.z + block.depth / 2,
        ),
    };
}
