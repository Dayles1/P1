/**
 * Small flying chips — bark, stone dust — where something is hit.
 */

import * as THREE from 'three';

const MAX = 120;
const GRAVITY = 14;

interface Chip {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    spin: THREE.Vector3;
    rotation: THREE.Euler;
    life: number;
    size: number;
}

export class Chips {
    readonly mesh: THREE.InstancedMesh;
    private chips: Chip[] = [];
    private matrix = new THREE.Matrix4();
    private quaternion = new THREE.Quaternion();
    private scale = new THREE.Vector3();
    private next = 0;

    constructor() {
        this.mesh = new THREE.InstancedMesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({ roughness: 0.9 }),
            MAX,
        );
        this.mesh.frustumCulled = false;
        this.mesh.castShadow = true;

        for (let index = 0; index < MAX; index++) {
            this.chips.push({
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                spin: new THREE.Vector3(),
                rotation: new THREE.Euler(),
                life: 0,
                size: 0,
            });
            this.mesh.setColorAt(index, new THREE.Color(0xffffff));
            this.hide(index);
        }
    }

    burst(at: THREE.Vector3, color: number, count: number, size = 0.07): void {
        const tint = new THREE.Color(color);

        for (let i = 0; i < count; i++) {
            const index = this.next;
            this.next = (this.next + 1) % MAX;
            const chip = this.chips[index];
            chip.position.copy(at);
            chip.velocity.set(
                (Math.random() - 0.5) * 4,
                2 + Math.random() * 3,
                (Math.random() - 0.5) * 4,
            );
            chip.spin.set(
                Math.random() * 10,
                Math.random() * 10,
                Math.random() * 10,
            );
            chip.life = 0.7 + Math.random() * 0.4;
            chip.size = size * (0.6 + Math.random() * 0.8);
            this.mesh.setColorAt(
                index,
                tint.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.12),
            );
        }

        this.mesh.instanceColor!.needsUpdate = true;
    }

    update(dt: number): void {
        this.chips.forEach((chip, index) => {
            if (chip.life <= 0) {
                return;
            }

            chip.life -= dt;

            if (chip.life <= 0) {
                this.hide(index);

                return;
            }

            chip.velocity.y -= GRAVITY * dt;
            chip.position.addScaledVector(chip.velocity, dt);
            chip.rotation.x += chip.spin.x * dt;
            chip.rotation.y += chip.spin.y * dt;
            chip.rotation.z += chip.spin.z * dt;
            this.quaternion.setFromEuler(chip.rotation);
            this.matrix.compose(
                chip.position,
                this.quaternion,
                this.scale.setScalar(chip.size * Math.min(1, chip.life * 3)),
            );
            this.mesh.setMatrixAt(index, this.matrix);
        });

        this.mesh.instanceMatrix.needsUpdate = true;
    }

    private hide(index: number): void {
        this.matrix.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(index, this.matrix);
    }
}
