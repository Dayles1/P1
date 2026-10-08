/**
 * The water surface: one sheet at WATER_LEVEL over the whole world — the
 * ground pokes through it everywhere but in lakes. It rocks gently and
 * takes the sky's colour.
 */

import * as THREE from 'three';
import { WATER_LEVEL, WORLD_HALF } from './terrain';

const DEEP = new THREE.Color(0x5f7f8f);

export class Water {
    readonly mesh: THREE.Mesh;
    private material: THREE.MeshStandardMaterial;
    private time = 0;

    constructor() {
        this.material = new THREE.MeshStandardMaterial({
            color: DEEP,
            transparent: true,
            opacity: 0.78,
            roughness: 0.18,
            metalness: 0.05,
            depthWrite: false,
        });
        const geometry = new THREE.PlaneGeometry(
            WORLD_HALF * 2,
            WORLD_HALF * 2,
        );
        geometry.rotateX(-Math.PI / 2);
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.position.y = WATER_LEVEL;
        this.mesh.renderOrder = 1;
        this.mesh.receiveShadow = true;
    }

    update(dt: number, sky: THREE.Color): void {
        this.time += dt;
        this.mesh.position.y = WATER_LEVEL + Math.sin(this.time * 0.8) * 0.025;
        this.material.color.copy(DEEP).lerp(sky, 0.35);
    }
}
