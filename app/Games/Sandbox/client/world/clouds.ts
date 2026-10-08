/**
 * Puffy low-poly clouds drifting high over the world. They wrap around
 * the player, so the sky is never empty, take the light of the time of
 * day and darken at night. A handful of shapes, each drawn as one
 * instanced mesh.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRandom } from './noise';

const SHAPES = 4;
const PER_SHAPE = 8;
const SPREAD = 460;

interface Cloud {
    mesh: THREE.InstancedMesh;
    index: number;
    position: THREE.Vector3;
    scale: THREE.Vector3;
    speed: number;
}

export class Clouds {
    readonly group = new THREE.Group();
    private clouds: Cloud[] = [];
    private material = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        flatShading: true,
        fog: false,
        transparent: true,
        opacity: 0.92,
    });
    private matrix = new THREE.Matrix4();
    private quaternion = new THREE.Quaternion();

    constructor() {
        const random = createRandom(2024);

        for (let shape = 0; shape < SHAPES; shape++) {
            const puffs = Array.from({ length: 5 + shape }, (_, index) => {
                const size = 9 + random() * 9;

                return new THREE.IcosahedronGeometry(size, 1)
                    .scale(1.3, 0.55, 1)
                    .translate(
                        (index - (4 + shape) / 2) * 11 + random() * 6,
                        random() * 5,
                        (random() - 0.5) * 18,
                    );
            });
            const mesh = new THREE.InstancedMesh(
                mergeGeometries(puffs),
                this.material,
                PER_SHAPE,
            );
            mesh.frustumCulled = false;
            this.group.add(mesh);

            for (let index = 0; index < PER_SHAPE; index++) {
                const size = 0.7 + random() * 0.8;
                this.clouds.push({
                    mesh,
                    index,
                    position: new THREE.Vector3(
                        (random() * 2 - 1) * SPREAD,
                        95 + random() * 55,
                        (random() * 2 - 1) * SPREAD,
                    ),
                    scale: new THREE.Vector3(
                        size,
                        size * (0.8 + random() * 0.4),
                        size,
                    ),
                    speed: 1.2 + random() * 1.8,
                });
            }
        }
    }

    update(
        dt: number,
        center: THREE.Vector3,
        sky: THREE.Color,
        night: number,
    ): void {
        this.material.emissive.copy(sky).multiplyScalar(0.35);
        this.material.opacity = 0.92 - night * 0.35;

        for (const cloud of this.clouds) {
            cloud.position.x += cloud.speed * dt;

            // Wrap around the player.
            for (const axis of ['x', 'z'] as const) {
                const offset = cloud.position[axis] - center[axis];

                if (offset > SPREAD) {
                    cloud.position[axis] -= SPREAD * 2;
                } else if (offset < -SPREAD) {
                    cloud.position[axis] += SPREAD * 2;
                }
            }

            this.matrix.compose(cloud.position, this.quaternion, cloud.scale);
            cloud.mesh.setMatrixAt(cloud.index, this.matrix);
        }

        for (const mesh of this.group.children as THREE.InstancedMesh[]) {
            mesh.instanceMatrix.needsUpdate = true;
        }
    }
}
