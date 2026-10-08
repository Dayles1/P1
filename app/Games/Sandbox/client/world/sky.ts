/**
 * Day and night. The time of day comes from the real clock — one day
 * lasts DAY_LENGTH — so it needs no saving and is the same in every tab.
 * The sky colour, fog, sun, moon, stars and the light on the world all
 * follow it: warm dawns and dusks, a dark-blue night lit by the moon.
 *
 * The sky itself is a dome around the player, pale at the horizon (the
 * fog's colour, so the land fades into it) and deeper overhead, with a
 * glow around the sun.
 */

import * as THREE from 'three';
import { smoothstep } from './noise';

export const DAY_LENGTH = 20 * 60_000;

const DAY = new THREE.Color(0xcfd8de);
const DUSK = new THREE.Color(0xe2b28f);
const NIGHT = new THREE.Color(0x121a26);
const ZENITH_DAY = new THREE.Color(0x7ea6cc);
const ZENITH_DUSK = new THREE.Color(0x5c6c99);
const ZENITH_NIGHT = new THREE.Color(0x05080f);
const SUN_DAY = new THREE.Color(0xfff6ea);
const SUN_LOW = new THREE.Color(0xffb27a);
const GROUND_DAY = new THREE.Color(0x8f8a80);
const GROUND_NIGHT = new THREE.Color(0x1d222b);

const DOME_VERTEX = /* glsl */ `
    varying vec3 vDirection;

    void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
    }
`;

const DOME_FRAGMENT = /* glsl */ `
    uniform vec3 zenith;
    uniform vec3 horizon;
    uniform vec3 glow;
    uniform vec3 sunDirection;
    varying vec3 vDirection;

    void main() {
        vec3 direction = normalize(vDirection);
        float up = clamp(direction.y, 0.0, 1.0);
        vec3 color = mix(horizon, zenith, pow(up, 0.6));
        float sun = max(dot(direction, sunDirection), 0.0);
        color += glow * (pow(sun, 5.0) * 0.3 + pow(sun, 48.0) * 0.5);
        gl_FragColor = vec4(color, 1.0);

        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

export interface SkyState {
    /** 0 at midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset. */
    time: number;
    /** 0 by day, 1 at full night. */
    night: number;
    color: THREE.Color;
}

export class Sky {
    readonly moon: THREE.DirectionalLight;
    readonly color = new THREE.Color();
    readonly dome: THREE.Mesh;
    private domeColors = {
        zenith: { value: new THREE.Color() },
        horizon: { value: new THREE.Color() },
        glow: { value: new THREE.Color() },
        sunDirection: { value: new THREE.Vector3(0, 1, 0) },
    };
    private stars: THREE.Points;
    private sunDisc: THREE.Mesh;
    private moonDisc: THREE.Mesh;
    private direction = new THREE.Vector3();
    /** Added to the clock (the debug key skips ahead). */
    private offset = 0;

    constructor(
        private scene: THREE.Scene,
        private sun: THREE.DirectionalLight,
        private ambient: THREE.HemisphereLight,
    ) {
        this.moon = new THREE.DirectionalLight(0x9fb4d8, 0);
        scene.add(this.moon, this.moon.target);

        this.dome = new THREE.Mesh(
            new THREE.SphereGeometry(800, 32, 16),
            new THREE.ShaderMaterial({
                uniforms: this.domeColors,
                vertexShader: DOME_VERTEX,
                fragmentShader: DOME_FRAGMENT,
                side: THREE.BackSide,
                depthWrite: false,
                fog: false,
            }),
        );
        this.dome.renderOrder = -1;
        this.dome.frustumCulled = false;
        scene.add(this.dome);

        const points = new Float32Array(1500 * 3);
        const random = Math.random;

        for (let i = 0; i < 1500; i++) {
            const theta = random() * Math.PI * 2;
            const y = random() * 0.95 + 0.05;
            const r = Math.sqrt(1 - y * y);
            points.set(
                [Math.cos(theta) * r * 600, y * 600, Math.sin(theta) * r * 600],
                i * 3,
            );
        }

        const starGeometry = new THREE.BufferGeometry();
        starGeometry.setAttribute(
            'position',
            new THREE.BufferAttribute(points, 3),
        );
        this.stars = new THREE.Points(
            starGeometry,
            new THREE.PointsMaterial({
                color: 0xffffff,
                size: 1.6,
                sizeAttenuation: false,
                transparent: true,
                fog: false,
                depthWrite: false,
            }),
        );

        this.sunDisc = new THREE.Mesh(
            new THREE.SphereGeometry(14, 16, 12),
            new THREE.MeshBasicMaterial({ color: 0xfff1d6, fog: false }),
        );
        this.moonDisc = new THREE.Mesh(
            new THREE.SphereGeometry(9, 16, 12),
            new THREE.MeshBasicMaterial({ color: 0xdfe6f0, fog: false }),
        );

        scene.add(this.stars, this.sunDisc, this.moonDisc);
    }

    /** Skips ahead by a fraction of a day. */
    skip(fraction: number): void {
        this.offset += fraction * DAY_LENGTH;
    }

    timeOfDay(now: number): number {
        return ((((now + this.offset) / DAY_LENGTH + 0.35) % 1) + 1) % 1;
    }

    update(now: number, center: THREE.Vector3): SkyState {
        const time = this.timeOfDay(now);
        const angle = (time - 0.25) * Math.PI * 2;
        const sunDirection = this.direction
            .set(Math.cos(angle) * 0.85, Math.sin(angle), 0.4)
            .normalize();

        const day = smoothstep(-0.12, 0.22, sunDirection.y);
        const low = 1 - smoothstep(0, 0.35, Math.abs(sunDirection.y));
        const night = 1 - day;

        this.color
            .copy(NIGHT)
            .lerp(DAY, day)
            .lerp(DUSK, low * 0.55);
        this.scene.background = this.color;
        (this.scene.fog as THREE.Fog).color.copy(this.color);

        const dome = this.domeColors;
        dome.horizon.value.copy(this.color);
        dome.zenith.value
            .copy(ZENITH_NIGHT)
            .lerp(ZENITH_DAY, day)
            .lerp(ZENITH_DUSK, low * 0.45);
        dome.glow.value
            .copy(SUN_DAY)
            .lerp(SUN_LOW, low)
            .multiplyScalar(smoothstep(-0.15, 0.08, sunDirection.y));
        dome.sunDirection.value.copy(sunDirection);
        this.dome.position.copy(center);

        this.sun.intensity = 2.4 * smoothstep(-0.02, 0.15, sunDirection.y);
        this.sun.color.copy(SUN_DAY).lerp(SUN_LOW, low);
        this.sun.position.copy(center).addScaledVector(sunDirection, 80);
        this.sun.target.position.copy(center);

        this.moon.intensity = 0.45 * night;
        this.moon.position.copy(center).addScaledVector(sunDirection, -80);
        this.moon.target.position.copy(center);

        this.ambient.intensity = 0.35 + 1.25 * day;
        this.ambient.color.copy(this.color).lerp(DAY, 0.4);
        this.ambient.groundColor.copy(GROUND_NIGHT).lerp(GROUND_DAY, day);

        this.sunDisc.position.copy(center).addScaledVector(sunDirection, 520);
        this.moonDisc.position.copy(center).addScaledVector(sunDirection, -520);
        this.stars.position.copy(center);
        (this.stars.material as THREE.PointsMaterial).opacity = smoothstep(
            0.4,
            0.9,
            night,
        );

        return { time, night, color: this.color };
    }
}
