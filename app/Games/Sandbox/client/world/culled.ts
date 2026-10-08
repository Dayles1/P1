/**
 * Many copies of one shape (trees of a kind, rocks, sticks…) of which only
 * the ones that matter are drawn. Every copy's matrix and colour is kept
 * here; refresh() hands the graphics card just two short lists:
 *
 * - near: within `shadowReach` of the player, all round — these cast
 *   shadows, wherever the camera looks, since the sun can throw one into
 *   view from behind;
 * - far: beyond that, within `reach` and inside the camera's view, with
 *   no shadows.
 *
 * Everything else is skipped. Between refreshes a changed copy (a shaking
 * tree, one being felled) is updated in place.
 *
 * It answers to setMatrixAt / setColorAt / count like an InstancedMesh, so
 * the code that places things does not need to know.
 */

import * as THREE from 'three';

const SPHERE = new THREE.Sphere();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export interface Reach {
    /** Drawn at all up to here, metres. */
    reach: number;
    /** Casting shadows up to here. */
    shadowReach: number;
}

export class CulledInstances {
    readonly group = new THREE.Group();
    readonly geometry: THREE.BufferGeometry;
    /** Copies in use (slots 0…count-1). */
    count = 0;
    /** Set when a copy appeared or moved far: the next refresh must happen. */
    stale = true;

    private near: THREE.InstancedMesh;
    private far: THREE.InstancedMesh;
    private matrices: Float32Array;
    private colors: Float32Array | null = null;
    /** Where each slot is drawn now: index in near (≥0), in far (-2-index) or nowhere (-1). */
    private drawn: Int32Array;
    private hidden: Uint8Array;
    private radius: Float32Array;
    private baseRadius: number;

    constructor(
        geometry: THREE.BufferGeometry,
        material: THREE.Material | THREE.Material[],
        capacity: number,
        private limits: Reach,
        shadows = true,
    ) {
        this.geometry = geometry;
        geometry.computeBoundingSphere();
        this.baseRadius = geometry.boundingSphere!.radius;
        this.matrices = new Float32Array(capacity * 16);
        this.drawn = new Int32Array(capacity).fill(-1);
        this.hidden = new Uint8Array(capacity).fill(1);
        this.radius = new Float32Array(capacity);

        this.near = new THREE.InstancedMesh(geometry, material, capacity);
        this.far = new THREE.InstancedMesh(geometry, material, capacity);

        for (const mesh of [this.near, this.far]) {
            mesh.count = 0;
            mesh.visible = false;
            mesh.frustumCulled = false;
            mesh.receiveShadow = true;
            this.group.add(mesh);
        }

        this.near.castShadow = shadows;
    }

    setLimits(limits: Reach): void {
        this.limits = limits;
        this.stale = true;
    }

    setMatrixAt(slot: number, matrix: THREE.Matrix4): void {
        const e = matrix.elements;
        matrix.toArray(this.matrices, slot * 16);
        const scale = Math.max(
            Math.hypot(e[0], e[1], e[2]),
            Math.hypot(e[4], e[5], e[6]),
            Math.hypot(e[8], e[9], e[10]),
        );
        const wasHidden = this.hidden[slot];
        this.hidden[slot] = scale === 0 ? 1 : 0;
        this.radius[slot] = this.baseRadius * scale;

        const at = this.drawn[slot];

        if (at === -1) {
            // Not drawn now: a copy that just appeared waits for the next refresh.
            if (!this.hidden[slot] && wasHidden) {
                this.stale = true;
            }

            return;
        }

        const mesh = at >= 0 ? this.near : this.far;
        mesh.setMatrixAt(
            at >= 0 ? at : -2 - at,
            this.hidden[slot] ? ZERO : matrix,
        );
        mesh.instanceMatrix.needsUpdate = true;
    }

    setColorAt(slot: number, color: THREE.Color): void {
        if (!this.colors) {
            this.colors = new Float32Array(this.hidden.length * 3).fill(1);
        }

        color.toArray(this.colors, slot * 3);
        // Make the shader expect colours from the start.
        this.near.setColorAt(0, color);
        this.far.setColorAt(0, color);
        this.stale = true;
    }

    /**
     * Picks what to draw around `center` for a camera seeing `frustum`.
     * Cheap enough to run several times a second.
     */
    refresh(center: THREE.Vector3, frustum: THREE.Frustum): void {
        const { reach, shadowReach } = this.limits;
        const reach2 = reach * reach;
        const shadow2 = shadowReach * shadowReach;
        const matrices = this.matrices;
        const nearMatrix = this.near.instanceMatrix.array as Float32Array;
        const farMatrix = this.far.instanceMatrix.array as Float32Array;
        const nearColor = this.near.instanceColor?.array as
            Float32Array | undefined;
        const farColor = this.far.instanceColor?.array as
            Float32Array | undefined;
        let nearCount = 0;
        let farCount = 0;

        for (let slot = 0; slot < this.count; slot++) {
            this.drawn[slot] = -1;

            if (this.hidden[slot]) {
                continue;
            }

            const x = matrices[slot * 16 + 12];
            const y = matrices[slot * 16 + 13];
            const z = matrices[slot * 16 + 14];
            const dx = x - center.x;
            const dz = z - center.z;
            const distance2 = dx * dx + dz * dz;

            if (distance2 < shadow2) {
                nearMatrix.set(
                    matrices.subarray(slot * 16, slot * 16 + 16),
                    nearCount * 16,
                );

                if (this.colors && nearColor) {
                    nearColor.set(
                        this.colors.subarray(slot * 3, slot * 3 + 3),
                        nearCount * 3,
                    );
                }

                this.drawn[slot] = nearCount++;
                continue;
            }

            if (distance2 > reach2) {
                continue;
            }

            SPHERE.center.set(x, y, z);
            SPHERE.radius = this.radius[slot] + 2;

            if (!frustum.intersectsSphere(SPHERE)) {
                continue;
            }

            farMatrix.set(
                matrices.subarray(slot * 16, slot * 16 + 16),
                farCount * 16,
            );

            if (this.colors && farColor) {
                farColor.set(
                    this.colors.subarray(slot * 3, slot * 3 + 3),
                    farCount * 3,
                );
            }

            this.drawn[slot] = -2 - farCount++;
        }

        this.show(this.near, nearCount);
        this.show(this.far, farCount);
        this.stale = false;
    }

    private show(mesh: THREE.InstancedMesh, count: number): void {
        mesh.count = count;
        mesh.visible = count > 0;
        mesh.instanceMatrix.needsUpdate = true;

        if (mesh.instanceColor) {
            mesh.instanceColor.needsUpdate = true;
        }
    }
}
