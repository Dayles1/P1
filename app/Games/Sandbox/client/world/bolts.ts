/**
 * The mage's fire bolts: a glowing ball that flies from the hand, homes
 * in on the creature it was aimed at (or goes straight on when there was
 * none) and bursts into sparks where it lands.
 */

import * as THREE from 'three';
import type { Chips } from './effects';
import type { Mob } from './mobs';
import { heightAt } from './terrain';

const SPEED = 24;
const LIFE = 1.4;

interface Bolt {
    mesh: THREE.Mesh;
    target: Mob | null;
    direction: THREE.Vector3;
    damage: number;
    life: number;
}

const CORE = new THREE.MeshBasicMaterial({ color: 0xffe0a0 });
const GLOW = new THREE.MeshBasicMaterial({
    color: 0xff8a3c,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});

export class Bolts {
    readonly group = new THREE.Group();
    /** A bolt reached its creature. */
    onHit: (mob: Mob, damage: number) => void = () => {};
    private bolts: Bolt[] = [];
    private aim = new THREE.Vector3();

    constructor(private chips: Chips) {}

    get flying(): number {
        return this.bolts.length;
    }

    fire(
        from: THREE.Vector3,
        facing: number,
        target: Mob | null,
        damage: number,
    ): void {
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.11, 10, 8),
            CORE,
        );
        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(0.24, 10, 8),
            GLOW,
        );
        mesh.add(glow);
        mesh.position.copy(from);
        this.group.add(mesh);
        this.bolts.push({
            mesh,
            target,
            direction: new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing)),
            damage,
            life: LIFE,
        });
    }

    update(dt: number): void {
        this.bolts = this.bolts.filter((bolt) => {
            const position = bolt.mesh.position;
            bolt.life -= dt;

            if (bolt.target && bolt.target.state !== 'dead') {
                this.aim
                    .copy(bolt.target.position)
                    .setY(bolt.target.position.y + 0.6)
                    .sub(position);
                const distance = this.aim.length();

                if (distance < 0.5) {
                    this.burst(bolt);
                    this.onHit(bolt.target, bolt.damage);

                    return false;
                }

                bolt.direction
                    .lerp(this.aim.divideScalar(distance), 0.35)
                    .normalize();
            }

            position.addScaledVector(bolt.direction, SPEED * dt);
            bolt.mesh.rotation.y += dt * 9;

            if (
                bolt.life <= 0 ||
                position.y < heightAt(position.x, position.z)
            ) {
                this.burst(bolt);

                return false;
            }

            return true;
        });
    }

    private burst(bolt: Bolt): void {
        this.chips.burst(bolt.mesh.position, 0xffa04c, 12, 0.06);
        this.group.remove(bolt.mesh);
        bolt.mesh.geometry.dispose();
        (bolt.mesh.children[0] as THREE.Mesh).geometry.dispose();
    }
}
