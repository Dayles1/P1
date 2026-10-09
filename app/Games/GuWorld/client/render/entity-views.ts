/** The pictures of each kind of entity (see views.ts). */

import * as THREE from 'three';
import { Mannequin } from '../body/mannequin';
import type { BlockEntity, GameEntity, PlayerEntity } from '../entities/types';
import type { Ground } from '../world/ground';
import type { EntityView, ViewFactory } from './views';

const BLOCK = new THREE.MeshStandardMaterial({
    color: 0xb9b4aa,
    roughness: 0.85,
});

/** A block: a box standing on the ground where its entity is. */
function blockView(entity: BlockEntity): EntityView<GameEntity> {
    const geometry = new THREE.BoxGeometry(
        entity.width,
        entity.height,
        entity.depth,
    );
    const mesh = new THREE.Mesh(geometry, BLOCK);

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return {
        object: mesh,
        sync: (data) =>
            mesh.position.set(
                data.position.x,
                data.position.y + (data as BlockEntity).height / 2,
                data.position.z,
            ),
        dispose: () => geometry.dispose(),
    };
}

const lerpAngle = (from: number, to: number, t: number) =>
    from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * t;

/**
 * A person: the animated figure, drawn between the last two simulation
 * steps so it moves smoothly at any frame rate. Its feet are planted on
 * the location's ground.
 */
function personView(
    entity: PlayerEntity,
    ground: Ground,
    look: () => { yaw: number; pitch: number },
): EntityView<GameEntity> {
    const figure = new Mannequin();
    const heightAt = (x: number, z: number) => ground.heightAt(x, z);

    figure.setLook(entity.look);

    return {
        object: figure.root,
        sync(data, alpha, frame) {
            const person = data as PlayerEntity;
            const { previous, position, motion } = person;
            const facing = lerpAngle(person.previousYaw, person.yaw, alpha);

            figure.root.position.set(
                previous.x + (position.x - previous.x) * alpha,
                previous.y + (position.y - previous.y) * alpha,
                previous.z + (position.z - previous.z) * alpha,
            );
            figure.root.rotation.y = facing;

            const view = look();
            figure.update(
                frame,
                {
                    ...motion,
                    lookYaw: Math.atan2(
                        Math.sin(view.yaw - facing),
                        Math.cos(view.yaw - facing),
                    ),
                    lookPitch: view.pitch,
                    ground: motion.grounded ? heightAt : null,
                },
                motion.landingSpeed,
            );
        },
        dispose: () => figure.dispose(),
    };
}

export function viewFactories(
    ground: Ground,
    look: () => { yaw: number; pitch: number },
): Record<GameEntity['kind'], ViewFactory<GameEntity>> {
    return {
        block: (entity) => blockView(entity as BlockEntity),
        player: (entity) => personView(entity as PlayerEntity, ground, look),
    };
}
