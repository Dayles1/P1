/**
 * An orbit camera around a target on the ground: yaw (0 = looking north,
 * towards y−, at the mountains), pitch, distance; every change eases
 * towards its goal. The view is kept to what the world is built for: the
 * yaw swings only so far either side of north, the pitch never looks up
 * past the horizon nor straight down, the zoom has a cap, and the target
 * stays over the player's land (plus a margin). The field of view widens
 * on tall screens so a phone in portrait still sees enough of the map.
 */

import * as THREE from 'three';
import { clamp, damp } from './colors';

export const MIN_DISTANCE = 6;
export const MAX_DISTANCE = 70;
export const MIN_PITCH = (14 * Math.PI) / 180;
export const MAX_PITCH = (66 * Math.PI) / 180;
/** The top of the view rises at most this far above the horizon. */
const SKY_ABOVE = (12 * Math.PI) / 180;
/** How far the view may turn from north either way. */
export const MAX_YAW = (35 * Math.PI) / 180;
/** Vertical field of view on wide screens, and the least horizontal one. */
const BASE_FOV = 42;
const MIN_HORIZONTAL_FOV = 50;
const MAX_FOV = 70;
/** Fixed far plane: everything out to the fogged ends of the world. */
const FAR = 1600;

interface CameraState {
    yaw: number;
    pitch: number;
    distance: number;
    x: number;
    z: number;
}

/** The rectangle (world X, Z) the target is kept within. */
export interface CameraArea {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
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

    private area: CameraArea = { minX: 0, maxX: 1, minZ: 0, maxZ: 1 };

    constructor(private heightAt: (x: number, z: number) => number) {
        this.camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, FAR);
        this.goal = {
            yaw: 0,
            pitch: (30 * Math.PI) / 180,
            distance: 40,
            x: 0,
            z: 0,
        };
        this.current = { ...this.goal };
    }

    /** The rectangle the target is kept within. */
    setArea(area: CameraArea): void {
        const a = this.area;

        if (
            a.minX === area.minX &&
            a.maxX === area.maxX &&
            a.minZ === area.minZ &&
            a.maxZ === area.maxZ
        ) {
            return;
        }

        this.area = { ...area };
        this.clampTarget(this.goal);
        this.clampTarget(this.current);
    }

    private clampTarget(state: CameraState): void {
        state.x = clamp(state.x, this.area.minX, this.area.maxX);
        state.z = clamp(state.z, this.area.minZ, this.area.maxZ);
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
        camera.near = Math.max(0.1, distance * 0.02);
        camera.far = FAR;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
    }

    /** A new screen shape: a tall one gets a taller field of view. */
    setAspect(aspect: number): void {
        const wide = (MIN_HORIZONTAL_FOV * Math.PI) / 360;
        const needed =
            (Math.atan(Math.tan(wide) / Math.max(0.1, aspect)) * 360) / Math.PI;

        this.camera.aspect = aspect;
        this.camera.fov = clamp(needed, BASE_FOV, MAX_FOV);
        this.camera.updateProjectionMatrix();
        this.goal.pitch = clamp(this.goal.pitch, this.minPitch, MAX_PITCH);
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
        this.goal.yaw = clamp(this.goal.yaw + radians, -MAX_YAW, MAX_YAW);
    }

    /** The lowest pitch: never so low that the view is mostly sky. */
    get minPitch(): number {
        return Math.max(
            MIN_PITCH,
            (this.camera.fov * Math.PI) / 360 - SKY_ABOVE,
        );
    }

    tilt(radians: number): void {
        this.goal.pitch = clamp(
            this.goal.pitch + radians,
            this.minPitch,
            MAX_PITCH,
        );
    }

    setYaw(radians: number, smooth = true): void {
        this.goal.yaw = clamp(wrapAngle(radians), -MAX_YAW, MAX_YAW);

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
