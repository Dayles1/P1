/**
 * An orbit camera around a target on the ground: yaw (0 = looking north,
 * towards y−), pitch, distance; every change eases towards its goal.
 */

import * as THREE from 'three';
import { clamp, damp } from './colors';

export const MIN_DISTANCE = 6;
export const MAX_DISTANCE = 120;
export const MIN_PITCH = (20 * Math.PI) / 180;
export const MAX_PITCH = (85 * Math.PI) / 180;

interface CameraState {
    yaw: number;
    pitch: number;
    distance: number;
    x: number;
    z: number;
}

function wrapAngle(angle: number): number {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export class OrbitCamera {
    readonly camera: THREE.PerspectiveCamera;
    readonly goal: CameraState;
    readonly current: CameraState;
    /** Smoothed ground height under the target. */
    groundY = 0;

    private width = 1;
    private height = 1;

    constructor(private heightAt: (x: number, z: number) => number) {
        this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
        this.goal = {
            yaw: Math.PI / 4,
            pitch: (55 * Math.PI) / 180,
            distance: 30,
            x: 0,
            z: 0,
        };
        this.current = { ...this.goal };
    }

    /** The map size the target is kept within. */
    setBounds(width: number, height: number): void {
        this.width = width;
        this.height = height;
        this.clampTarget(this.goal);
        this.clampTarget(this.current);
    }

    private clampTarget(state: CameraState): void {
        state.x = clamp(state.x, 0, this.width);
        state.z = clamp(state.z, 0, this.height);
    }

    get target(): THREE.Vector3 {
        return new THREE.Vector3(this.current.x, this.groundY, this.current.z);
    }

    update(dt: number): void {
        const goal = this.goal;
        const current = this.current;
        const k = damp(10, dt);

        current.yaw += wrapAngle(goal.yaw - current.yaw) * k;
        current.pitch += (goal.pitch - current.pitch) * k;
        current.distance += (goal.distance - current.distance) * k;
        current.x += (goal.x - current.x) * k;
        current.z += (goal.z - current.z) * k;

        const ground = this.heightAt(current.x, current.z);

        this.groundY += (ground - this.groundY) * damp(6, dt);
        this.apply();
    }

    /** Places the three.js camera from the current state. */
    apply(): void {
        const { yaw, pitch, distance, x, z } = this.current;
        const horizontal = distance * Math.cos(pitch);
        const camera = this.camera;

        camera.position.set(
            x - Math.sin(yaw) * horizontal,
            this.groundY + distance * Math.sin(pitch),
            z + Math.cos(yaw) * horizontal,
        );
        camera.up.set(0, 1, 0);
        camera.lookAt(x, this.groundY, z);
        camera.near = Math.max(0.05, distance * 0.02);
        camera.far = distance * 6 + 160;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
    }

    setAspect(aspect: number): void {
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
    }

    centerOn(x: number, z: number, smooth = true): void {
        this.goal.x = x;
        this.goal.z = z;
        this.clampTarget(this.goal);

        if (!smooth) {
            this.current.x = this.goal.x;
            this.current.z = this.goal.z;
            this.groundY = this.heightAt(this.current.x, this.current.z);
            this.apply();
        }
    }

    /** Zooms; with a ground point, keeps it under the pointer (roughly). */
    zoom(factor: number, towards: { x: number; z: number } | null): void {
        const before = this.goal.distance;
        const after = clamp(
            before / Math.max(0.01, factor),
            MIN_DISTANCE,
            MAX_DISTANCE,
        );

        if (towards) {
            const share = 1 - after / before;

            this.goal.x += (towards.x - this.goal.x) * share;
            this.goal.z += (towards.z - this.goal.z) * share;
            this.clampTarget(this.goal);
        }

        this.goal.distance = after;
    }

    /** Moves the target so the ground follows a drag of (dx, dy) CSS pixels. */
    pan(dx: number, dy: number, viewportHeight: number): void {
        const fov = (this.camera.fov * Math.PI) / 180;
        const perPixel =
            (2 * this.current.distance * Math.tan(fov / 2)) /
            Math.max(1, viewportHeight);
        const yaw = this.current.yaw;
        const rightX = Math.cos(yaw);
        const rightZ = Math.sin(yaw);
        const forwardX = Math.sin(yaw);
        const forwardZ = -Math.cos(yaw);
        const along =
            (dy * perPixel) / Math.max(0.3, Math.sin(this.current.pitch));
        const mx = -rightX * dx * perPixel + forwardX * along;
        const mz = -rightZ * dx * perPixel + forwardZ * along;

        this.goal.x += mx;
        this.goal.z += mz;
        this.current.x += mx;
        this.current.z += mz;
        this.clampTarget(this.goal);
        this.clampTarget(this.current);
        this.apply();
    }

    rotate(radians: number): void {
        this.goal.yaw += radians;
    }

    tilt(radians: number): void {
        this.goal.pitch = clamp(
            this.goal.pitch + radians,
            MIN_PITCH,
            MAX_PITCH,
        );
    }

    setYaw(radians: number, smooth = true): void {
        this.goal.yaw =
            this.current.yaw + wrapAngle(radians - this.current.yaw);

        if (!smooth) {
            this.current.yaw = this.goal.yaw;
            this.apply();
        }
    }

    get view(): {
        yaw: number;
        pitch: number;
        distance: number;
        targetX: number;
        targetY: number;
    } {
        const tau = Math.PI * 2;

        return {
            yaw: ((this.current.yaw % tau) + tau) % tau,
            pitch: this.current.pitch,
            distance: this.current.distance,
            targetX: this.current.x,
            targetY: this.current.z,
        };
    }
}
