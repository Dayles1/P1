/**
 * Falling weather around the camera's target: rain streaks and snow
 * flakes in a box that follows the view. Fog is the scene fog (set by
 * the renderer).
 */

import * as THREE from 'three';

const MAX = 3000;

function flakeTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');

    canvas.width = 32;
    canvas.height = 32;

    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(16, 16, 1, 16, 16, 16);

    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.7)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);

    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
}

function wrap(value: number, half: number): number {
    const size = half * 2;

    return ((((value + half) % size) + size) % size) - half;
}

export class Weather {
    readonly group = new THREE.Group();

    private drops = new Float32Array(MAX * 3);
    private speeds = new Float32Array(MAX);
    private rainPositions = new Float32Array(MAX * 6);
    private snowPositions = new Float32Array(MAX * 3);
    private rain: THREE.LineSegments;
    private snow: THREE.Points;
    private rainMaterial: THREE.LineBasicMaterial;
    private snowMaterial: THREE.PointsMaterial;
    private texture: THREE.CanvasTexture;
    private time = 0;

    constructor() {
        for (let i = 0; i < MAX; i++) {
            this.drops[i * 3] = (Math.random() - 0.5) * 2;
            this.drops[i * 3 + 1] = Math.random();
            this.drops[i * 3 + 2] = (Math.random() - 0.5) * 2;
            this.speeds[i] = 0.8 + Math.random() * 0.4;
        }

        const rainGeometry = new THREE.BufferGeometry();

        rainGeometry.setAttribute(
            'position',
            new THREE.BufferAttribute(this.rainPositions, 3).setUsage(
                THREE.DynamicDrawUsage,
            ),
        );
        this.rainMaterial = new THREE.LineBasicMaterial({
            color: 0xb4cce0,
            transparent: true,
            opacity: 0.45,
            depthWrite: false,
        });
        this.rain = new THREE.LineSegments(rainGeometry, this.rainMaterial);
        this.rain.frustumCulled = false;
        this.rain.visible = false;

        const snowGeometry = new THREE.BufferGeometry();

        snowGeometry.setAttribute(
            'position',
            new THREE.BufferAttribute(this.snowPositions, 3).setUsage(
                THREE.DynamicDrawUsage,
            ),
        );
        this.texture = flakeTexture();
        this.snowMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.09,
            map: this.texture,
            transparent: true,
            depthWrite: false,
            sizeAttenuation: true,
        });
        this.snow = new THREE.Points(snowGeometry, this.snowMaterial);
        this.snow.frustumCulled = false;
        this.snow.visible = false;
        this.group.add(this.rain, this.snow);
    }

    /**
     * @param kind  what falls (null: nothing)
     * @param density 0..1
     * @param centre the camera target in world coordinates
     * @param extent half-size of the box around it
     */
    update(
        dt: number,
        kind: 'rain' | 'snow' | 'fog' | null,
        density: number,
        centre: THREE.Vector3,
        extent: number,
        light: number,
    ): void {
        this.time += dt;

        const falling = kind === 'rain' || kind === 'snow';

        this.rain.visible = kind === 'rain';
        this.snow.visible = kind === 'snow';

        if (!falling) {
            return;
        }

        const count = Math.floor(
            MAX * Math.min(1, density) * Math.min(1, 0.4 + extent / 40),
        );
        const height = Math.max(6, extent * 0.9);
        const rain = kind === 'rain';
        const step = Math.min(dt, 0.1);
        const fall = rain ? 10 / height : 0.9 / height;

        for (let i = 0; i < count; i++) {
            const k = i * 3;

            this.drops[k + 1] -= fall * this.speeds[i] * step;

            if (!rain) {
                this.drops[k] +=
                    Math.sin(this.time * 0.8 + i) * 0.004 * step * 10;
                this.drops[k + 2] +=
                    Math.cos(this.time * 0.6 + i * 1.3) * 0.004 * step * 10;
            }

            if (this.drops[k + 1] < 0) {
                this.drops[k + 1] += 1;
            }

            const x =
                centre.x + wrap(this.drops[k] * extent - centre.x, extent);
            const y = centre.y - 1 + this.drops[k + 1] * height;
            const z =
                centre.z + wrap(this.drops[k + 2] * extent - centre.z, extent);

            if (rain) {
                const j = i * 6;

                this.rainPositions[j] = x;
                this.rainPositions[j + 1] = y;
                this.rainPositions[j + 2] = z;
                this.rainPositions[j + 3] = x - 0.04;
                this.rainPositions[j + 4] = y + 0.38;
                this.rainPositions[j + 5] = z - 0.02;
            } else {
                this.snowPositions[k] = x;
                this.snowPositions[k + 1] = y;
                this.snowPositions[k + 2] = z;
            }
        }

        const target = rain ? this.rain : this.snow;
        const attribute = target.geometry.getAttribute(
            'position',
        ) as THREE.BufferAttribute;

        attribute.needsUpdate = true;
        target.geometry.setDrawRange(0, rain ? count * 2 : count);
        this.rainMaterial.opacity = 0.25 + light * 0.25;
        this.snowMaterial.opacity = 0.6 + light * 0.4;
    }

    dispose(): void {
        this.rain.geometry.dispose();
        this.snow.geometry.dispose();
        this.rainMaterial.dispose();
        this.snowMaterial.dispose();
        this.texture.dispose();
    }
}
