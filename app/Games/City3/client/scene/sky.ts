/**
 * Sky and light: a gradient sky from the current era's palette blended to
 * night colours, the sun (with shadows around the camera target) moving
 * through the day, bluish moonlight at night, hemisphere ambient light,
 * dawn / dusk tints and fog for depth (denser in foggy weather).
 */

import * as THREE from 'three';
import type { Game } from '../engine/sim/game';
import { color, smoothstep } from './colors';

const NIGHT_ZENITH = '#060a1c';
const NIGHT_HORIZON = '#1a2350';

export interface SkyState {
    /** 0 = full day, 1 = deep night. */
    night: number;
    /** Light level 0..1. */
    level: number;
}

export class Sky {
    readonly sun: THREE.DirectionalLight;
    readonly hemisphere: THREE.HemisphereLight;
    readonly fog: THREE.Fog;

    private canvas: HTMLCanvasElement;
    private texture: THREE.CanvasTexture;
    private gradientKey = '';
    private shadowSize = 0;
    private zenith = new THREE.Color();
    private horizon = new THREE.Color();
    private scratch = new THREE.Color();

    constructor(private scene: THREE.Scene) {
        this.sun = new THREE.DirectionalLight(0xffffff, 3);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(2048, 2048);
        this.sun.shadow.bias = -0.0004;
        this.sun.shadow.normalBias = 0.025;
        this.sun.shadow.camera.near = 1;
        this.sun.shadow.camera.far = 200;
        this.hemisphere = new THREE.HemisphereLight(0xbfdcff, 0x6b5a40, 1);
        this.fog = new THREE.Fog(0xdde8f0, 60, 200);
        this.canvas = document.createElement('canvas');
        this.canvas.width = 2;
        this.canvas.height = 256;
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        scene.add(this.sun, this.sun.target, this.hemisphere);
        scene.background = this.texture;
        scene.fog = this.fog;
    }

    update(game: Game, target: THREE.Vector3, distance: number): SkyState {
        const weather = game.weather;
        const light = game.clock.light(game.state.time, weather?.light ?? 0);
        const tod = game.clock.timeOfDay(game.state.time);
        const night = 1 - smoothstep(0.42, 0.85, light.level);
        const tint = light.tint ? color(light.tint) : null;
        const tintShare = light.tint
            ? Math.min(1, light.tintStrength * 1.6)
            : 0;
        const gloom = Math.max(0, -(weather?.light ?? 0)) * 2.2;
        const sky = game.palette.sky ?? ['#8fc3e8', '#eef2f2'];

        // Sky colours.
        this.zenith.copy(color(sky[0])).lerp(color(NIGHT_ZENITH), night);
        this.horizon.copy(color(sky[1])).lerp(color(NIGHT_HORIZON), night);

        if (tint) {
            this.horizon.lerp(tint, tintShare * 0.8);
            this.zenith.lerp(tint, tintShare * 0.3);
        }

        if (gloom > 0) {
            const grey = color('#8d969e');

            this.zenith.lerp(grey, Math.min(0.7, gloom) * (1 - night * 0.7));
            this.horizon.lerp(grey, Math.min(0.6, gloom) * (1 - night * 0.7));
        }

        this.paintGradient();

        // Sun and moon.
        const angle = (tod - 0.25) * Math.PI * 2;
        const height = Math.sin(angle);
        const sunPower =
            smoothstep(-0.08, 0.2, height) * Math.pow(light.level, 1.3);
        const moonPower = night * 0.55;
        const direction = new THREE.Vector3();

        if (sunPower >= moonPower * 0.8) {
            direction
                .set(Math.cos(angle) * 0.85, Math.max(0.32, height), 0.42)
                .normalize();
            this.sun.color.copy(color('#fff3df'));

            if (tint) {
                this.sun.color.lerp(tint, tintShare);
            }

            this.sun.intensity =
                3.1 * sunPower * (1 - Math.min(0.5, gloom * 0.6));
        } else {
            direction.set(-Math.cos(angle) * 0.5, 0.75, -0.35).normalize();
            this.sun.color.copy(color('#9db2ff'));
            this.sun.intensity = moonPower;
        }

        this.sun.position.copy(target).addScaledVector(direction, 80);
        this.sun.target.position.copy(target);
        this.sun.target.updateMatrixWorld();

        const size = Math.max(8, Math.min(70, distance * 0.9));

        if (Math.abs(size - this.shadowSize) > 0.5) {
            this.shadowSize = size;

            const camera = this.sun.shadow.camera;

            camera.left = -size;
            camera.right = size;
            camera.top = size;
            camera.bottom = -size;
            camera.updateProjectionMatrix();
        }

        // Ambient.
        this.hemisphere.color
            .copy(this.zenith)
            .lerp(color('#ffffff'), 0.35 * (1 - night));
        this.hemisphere.groundColor
            .copy(color('#6b5a40'))
            .lerp(color('#10142a'), night);
        this.hemisphere.intensity = 0.35 + light.level * 0.85;

        if (tint) {
            this.hemisphere.color.lerp(tint, tintShare * 0.5);
        }

        this.scene.environmentIntensity = 0.08 + light.level * 0.32;

        // Fog: far by default, close in fog; coloured like the horizon.
        const foggy =
            weather?.particles?.kind === 'fog' ? weather.particles.density : 0;
        const rainy = weather?.particles?.kind === 'rain' ? 0.3 : 0;
        const near = distance * (1.6 - foggy * 1.4 - rainy);
        const far =
            distance * (5.5 - foggy * 3.6 - rainy * 2) + 30 * (1 - foggy);

        this.fog.near = Math.max(1, near);
        this.fog.far = Math.max(this.fog.near + 5, far);
        this.fog.color.copy(this.horizon);

        if (foggy) {
            this.fog.color.lerp(
                this.scratch.set(0xd8dde2).multiplyScalar(1 - night * 0.8),
                foggy * 0.6,
            );
        }

        return { night, level: light.level };
    }

    private paintGradient(): void {
        const key = `${this.zenith.getHexString()}${this.horizon.getHexString()}`;

        if (key === this.gradientKey) {
            return;
        }

        this.gradientKey = key;

        const ctx = this.canvas.getContext('2d')!;
        const gradient = ctx.createLinearGradient(0, 0, 0, 256);

        gradient.addColorStop(
            0,
            `#${this.zenith.getHexString(THREE.SRGBColorSpace)}`,
        );
        gradient.addColorStop(
            0.75,
            `#${this.horizon.getHexString(THREE.SRGBColorSpace)}`,
        );
        gradient.addColorStop(
            1,
            `#${this.horizon.getHexString(THREE.SRGBColorSpace)}`,
        );
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 2, 256);
        this.texture.needsUpdate = true;
    }

    dispose(): void {
        this.texture.dispose();
        this.sun.dispose();
        this.hemisphere.dispose();
    }
}
