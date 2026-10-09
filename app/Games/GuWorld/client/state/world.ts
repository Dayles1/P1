/**
 * The game world as data: the location, the clock, every entity in the
 * registry, the colliders and the hero's body. Built from a restored game
 * (a new one or a save) — the same save always builds the same world,
 * with the same entity ids, and building it twice into one registry
 * never doubles anything. Nothing here draws.
 */

import type { Look } from '../body/mannequin';
import type { WorldClock } from '../engine/clock';
import { EntityRegistry } from '../entities/registry';
import { PLAYER_ID, STANDING } from '../entities/types';
import type { BlockEntity, GameEntity, PlayerEntity } from '../entities/types';
import { Character } from '../physics/character';
import { ColliderGrid } from '../physics/colliders';
import { blockCollider } from '../physics/solids';
import type { WorldConfig } from '../world/config';
import { resolveLocation } from '../world/locations';
import type { Location } from '../world/locations';
import type { Pose } from '../world/space';
import { makeSave } from './save';
import type { RestoredGame, SaveV1 } from './save';

export interface World {
    config: WorldConfig;
    location: Location;
    clock: WorldClock;
    registry: EntityRegistry<GameEntity>;
    colliders: ColliderGrid;
    /** The hero's body (physics) and the hero as an entity. */
    body: Character;
    player: PlayerEntity;
}

export function buildWorld(
    config: WorldConfig,
    restored: RestoredGame,
    look: Look,
    registry = new EntityRegistry<GameEntity>(),
): World {
    const location = resolveLocation(config, restored.location);
    const colliders = new ColliderGrid(location.ground);

    for (const block of location.blocks) {
        const entity = registry.ensure(block.id, (): BlockEntity => ({
            id: block.id,
            kind: 'block',
            location: location.id,
            position: {
                x: block.x,
                y: location.ground.heightAt(block.x, block.z),
                z: block.z,
            },
            yaw: 0,
            width: block.width,
            depth: block.depth,
            height: block.height,
        }));

        if (entity.kind === 'block') {
            colliders.add(blockCollider(block, location.ground));
        }
    }

    const body = new Character(colliders, location.ground, location.bounds);
    const { x, y, z, yaw } = restored.player;

    body.placeAt(x, y, z);
    body.facing = yaw;

    const player = registry.ensure(PLAYER_ID, (): PlayerEntity => ({
        id: PLAYER_ID,
        kind: 'player',
        location: location.id,
        position: { ...body.position },
        yaw,
        previous: { ...body.position },
        previousYaw: yaw,
        motion: { ...STANDING },
        look,
    })) as PlayerEntity;

    return {
        config,
        location,
        clock: restored.clock,
        registry,
        colliders,
        body,
        player,
    };
}

/** Where the hero stands now. */
export function playerPose(world: World): Pose {
    return { ...world.player.position, yaw: world.player.yaw };
}

/** The world's save. */
export function saveWorld(world: World): SaveV1 {
    return makeSave(world.location.id, world.clock, playerPose(world));
}
