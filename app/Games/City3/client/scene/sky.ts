/**
 * Sky and light: a natural sky dome (the same in every era) blended to
 * night colours, the sun (with shadows around the camera target) moving
 * through the day, bluish moonlight at night, hemisphere ambient light,
 * dawn / dusk tints and fog for depth (denser in foggy weather).
 *
 * The dome is world-space and follows the camera; its colour at and below
 * the horizon is exactly the fog colour, so fogged ground and the far
 * ridges melt into the sky with no seam. The fog is sized in world units
 * so the ends of the world (the aprons past the map) are always fogged.
 */

import * as THREE from 'three';
import type { Game } from '../engine/sim/game';
import { color, smoothstep } from './colors';

const DAY_ZENITH = '#5b9bd5';
const DAY_HORIZON = '#d3e2ea';
const NIGHT_ZENITH = '#060a1c';
const NIGHT_HORIZON = '#1a2350';

/** Fog in world units (tiles): clear weather, at any zoom. */
const FOG_NEAR = 85;
const FOG_FAR = 330;
/** The dome's radius; it must stay inside the camera's far plane. */
export const DOME_RADIUS = 1400;

const DOME_VERTEX = /* glsl */ `
    varying vec3 vDirection;

    void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const DOME_FRAGMENT = /* glsl */ `
    uniform vec3 uZenith;
    uniform vec3 uHorizon;
    uniform vec3 uSun;
    uniform vec3 uSunColor;
    varying vec3 vDirection;

    void main() {
        vec3 direction = normalize(vDirection);
        float up = max(direction.y, 0.0);
        vec3 sky = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.6, up), 0.7));
        float sun = max(dot(direction, uSun), 0.0);

        // A soft glow around the sun, fading out towards the horizon line.
        sky += uSunColor * (pow(sun, 48.0) * 0.5 + pow(sun, 6.0) * 0.08)
            * smoothstep(0.0, 0.12, up);
        gl_FragColor = vec4(sky, 1.0);

        #include <colorspace_fragment>
    }
`;

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

    private dome: THREE.Mesh;
    private domeMaterial: THREE.ShaderMaterial;
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
        this.fog = new THREE.Fog(0xdde8f0, FOG_NEAR, FOG_FAR);
        this.domeMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uZenith: { value: new THREE.Color() },
                uHorizon: { value: new THREE.Color() },
                uSun: { value: new THREE.Vector3(0, 1, 0) },
                uSunColor: { value: new THREE.Color() },
            },
            vertexShader: DOME_VERTEX,
            fragmentShader: DOME_FRAGMENT,
            side: THREE.BackSide,
            depthWrite: false,
            depthTest: false,
            fog: false,
        });
        this.dome = new THREE.Mesh(
            new THREE.SphereGeometry(DOME_RADIUS, 32, 16),
            this.domeMaterial,
        );
        this.dome.name = 'sky';
        this.dome.frustumCulled = false;
        this.dome.renderOrder = -1000;
        scene.add(this.sun, this.sun.target, this.hemisphere, this.dome);
        scene.background = null;
        scene.fog = this.fog;
    }

    update(
        game: Game,
        target: THREE.Vector3,
        distance: number,
        eye: THREE.Vector3,
    ): SkyState {
        const weather = game.weather;
        const light = game.clock.light(game.state.time, weather?.light ?? 0);
        const tod = game.clock.timeOfDay(game.state.time);
        const night = 1 - smoothstep(0.42, 0.85, light.level);
        const tint = light.tint ? color(light.tint) : null;
        const tintShare = light.tint
            ? Math.min(1, light.tintStrength * 1.6)
            : 0;
        const gloom = Math.max(0, -(weather?.light ?? 0)) * 2.2;

        // Sky colours: natural, whatever the era.
        this.zenith.copy(color(DAY_ZENITH)).lerp(color(NIGHT_ZENITH), night);
        this.horizon
            .copy(color(DAY_HORIZON))
            .lerp(color(NIGHT_HORIZON), night);

        if (tint) {
            this.horizon.lerp(tint, tintShare * 0.8);
            this.zenith.lerp(tint, tintShare * 0.3);
        }

        if (gloom > 0) {
            const grey = color('#8d969e');

            this.zenith.lerp(grey, Math.min(0.7, gloom) * (1 - night * 0.7));
            this.horizon.lerp(grey, Math.min(0.6, gloom) * (1 - night * 0.7));
        }

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

        // Fog: in world units, closer in fog and rain; coloured like the horizon.
        const foggy =
            weather?.particles?.kind === 'fog' ? weather.particles.density : 0;
        const rainy = weather?.particles?.kind === 'rain' ? 0.3 : 0;

        this.fog.near = Math.max(4, FOG_NEAR * (1 - foggy * 0.9 - rainy));
        this.fog.far = Math.max(
            this.fog.near + 40,
            FOG_FAR * (1 - foggy * 0.6 - rainy * 0.6),
        );
        this.fog.color.copy(this.horizon);

        if (foggy) {
            this.fog.color.lerp(
                this.scratch.set(0xd8dde2).multiplyScalar(1 - night * 0.8),
                foggy * 0.6,
            );
            this.zenith.lerp(this.fog.color, foggy * 0.7);
        }

        // The dome: its horizon is the fog colour, so the two always meet.
        const uniforms = this.domeMaterial.uniforms;

        uniforms.uZenith.value.copy(this.zenith);
        uniforms.uHorizon.value.copy(this.fog.color);
        uniforms.uSun.value.copy(direction);
        uniforms.uSunColor.value
            .copy(this.sun.color)
            .multiplyScalar(sunPower >= moonPower * 0.8 ? sunPower : 0);
        this.dome.position.copy(eye);

        return { night, level: light.level };
    }

    dispose(): void {
        this.dome.geometry.dispose();
        this.domeMaterial.dispose();
        this.sun.dispose();
        this.hemisphere.dispose();
    }
}
