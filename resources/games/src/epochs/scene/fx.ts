/**
 * Point-sprite effects: soft particles (smoke, steam, dust, water,
 * sparks, confetti) simulated on the CPU, and additive glow sprites for
 * lights at night (street lamps, model lights, headlights).
 */

import * as THREE from 'three';
import { clamp } from './colors';

const VERTEX = /* glsl */ `
attribute float aSize;
attribute vec4 aColor;
uniform float uScale;
varying vec4 vColor;

void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    vColor = aColor;
}
`;

const GLOW_FRAGMENT = /* glsl */ `
uniform float uIntensity;
varying vec4 vColor;

void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = clamp(1.0 - d, 0.0, 1.0);
    a = a * a * vColor.a * uIntensity;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vColor.rgb, a);
    #include <colorspace_fragment>
}
`;

const SOFT_FRAGMENT = /* glsl */ `
varying vec4 vColor;

void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.55, d) * vColor.a;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor.rgb, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

/** A growable set of point sprites. */
class PointBuffer {
    readonly points: THREE.Points;
    readonly material: THREE.ShaderMaterial;
    count = 0;

    private positions: Float32Array;
    private sizes: Float32Array;
    private colors: Float32Array;
    private geometry = new THREE.BufferGeometry();

    constructor(
        private capacity: number,
        additive: boolean,
    ) {
        this.positions = new Float32Array(capacity * 3);
        this.sizes = new Float32Array(capacity);
        this.colors = new Float32Array(capacity * 4);
        this.attach();
        this.material = new THREE.ShaderMaterial({
            vertexShader: VERTEX,
            fragmentShader: additive ? GLOW_FRAGMENT : SOFT_FRAGMENT,
            uniforms: {
                uScale: { value: 500 },
                uIntensity: { value: 1 },
            },
            transparent: true,
            depthWrite: false,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        });
        this.points = new THREE.Points(this.geometry, this.material);
        this.points.frustumCulled = false;
        this.points.renderOrder = additive ? 5 : 4;
    }

    private attach(): void {
        this.geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(this.positions, 3).setUsage(
                THREE.DynamicDrawUsage,
            ),
        );
        this.geometry.setAttribute(
            'aSize',
            new THREE.BufferAttribute(this.sizes, 1).setUsage(
                THREE.DynamicDrawUsage,
            ),
        );
        this.geometry.setAttribute(
            'aColor',
            new THREE.BufferAttribute(this.colors, 4).setUsage(
                THREE.DynamicDrawUsage,
            ),
        );
    }

    begin(): void {
        this.count = 0;
    }

    add(
        x: number,
        y: number,
        z: number,
        size: number,
        r: number,
        g: number,
        b: number,
        a: number,
    ): void {
        if (this.count >= this.capacity) {
            const capacity = this.capacity * 2;
            const positions = new Float32Array(capacity * 3);
            const sizes = new Float32Array(capacity);
            const colors = new Float32Array(capacity * 4);

            positions.set(this.positions);
            sizes.set(this.sizes);
            colors.set(this.colors);
            this.positions = positions;
            this.sizes = sizes;
            this.colors = colors;
            this.capacity = capacity;
            this.geometry.dispose();
            this.attach();
        }

        const i = this.count++;

        this.positions[i * 3] = x;
        this.positions[i * 3 + 1] = y;
        this.positions[i * 3 + 2] = z;
        this.sizes[i] = size;
        this.colors[i * 4] = r;
        this.colors[i * 4 + 1] = g;
        this.colors[i * 4 + 2] = b;
        this.colors[i * 4 + 3] = a;
    }

    end(): void {
        for (const name of ['position', 'aSize', 'aColor']) {
            const attribute = this.geometry.getAttribute(
                name,
            ) as THREE.BufferAttribute;

            attribute.clearUpdateRanges();
            attribute.addUpdateRange(0, this.count * attribute.itemSize);
            attribute.needsUpdate = true;
        }

        this.geometry.setDrawRange(0, this.count);
    }

    set scale(value: number) {
        this.material.uniforms.uScale.value = value;
    }

    dispose(): void {
        this.geometry.dispose();
        this.material.dispose();
    }
}

/** Additive glow sprites; fill with begin / add / end. */
export class GlowLayer {
    private buffer: PointBuffer;

    constructor(capacity = 256) {
        this.buffer = new PointBuffer(capacity, true);
    }

    get object(): THREE.Points {
        return this.buffer.points;
    }

    set intensity(value: number) {
        this.buffer.material.uniforms.uIntensity.value = value;
        this.buffer.points.visible = value > 0.01;
    }

    set scale(value: number) {
        this.buffer.scale = value;
    }

    begin(): void {
        this.buffer.begin();
    }

    add(
        position: THREE.Vector3,
        size: number,
        c: THREE.Color,
        alpha = 1,
    ): void {
        this.buffer.add(
            position.x,
            position.y,
            position.z,
            size,
            c.r,
            c.g,
            c.b,
            alpha,
        );
    }

    addXYZ(
        x: number,
        y: number,
        z: number,
        size: number,
        c: THREE.Color,
        alpha = 1,
    ): void {
        this.buffer.add(x, y, z, size, c.r, c.g, c.b, alpha);
    }

    end(): void {
        this.buffer.end();
    }

    dispose(): void {
        this.buffer.dispose();
    }
}

export type ParticleKind =
    'smoke' | 'steam' | 'dust' | 'water' | 'sparks' | 'sparkle' | 'confetti';

interface Particle {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    max: number;
    size: number;
    grow: number;
    r: number;
    g: number;
    b: number;
    alpha: number;
    gravity: number;
    drag: number;
}

const CONFETTI = [
    '#ff5a5a',
    '#ffd34d',
    '#4dd2ff',
    '#7dff6a',
    '#ff7de9',
    '#ffffff',
].map((css) => new THREE.Color(css));

/** CPU-simulated soft particles. */
export class Particles {
    private buffer: PointBuffer;
    private list: Particle[] = [];
    private readonly max: number;

    constructor(max = 3000) {
        this.max = max;
        this.buffer = new PointBuffer(512, false);
    }

    get object(): THREE.Points {
        return this.buffer.points;
    }

    set scale(value: number) {
        this.buffer.scale = value;
    }

    get count(): number {
        return this.list.length;
    }

    clear(): void {
        this.list = [];
    }

    /** One particle of a kind at a point. */
    spawn(
        kind: ParticleKind,
        x: number,
        y: number,
        z: number,
        power = 1,
    ): void {
        if (this.list.length >= this.max) {
            return;
        }

        const r = Math.random;
        const p: Particle = {
            x,
            y,
            z,
            vx: 0,
            vy: 0,
            vz: 0,
            life: 0,
            max: 1,
            size: 0.1,
            grow: 0,
            r: 1,
            g: 1,
            b: 1,
            alpha: 1,
            gravity: 0,
            drag: 0.5,
        };

        switch (kind) {
            case 'smoke': {
                const grey = 0.32 + r() * 0.2;

                Object.assign(p, {
                    vx: (r() - 0.5) * 0.06 + 0.04,
                    vy: 0.18 + r() * 0.1,
                    vz: (r() - 0.5) * 0.06,
                    max: 3 + r() * 1.5,
                    size: 0.1,
                    grow: 0.12,
                    r: grey,
                    g: grey,
                    b: grey * 1.02,
                    alpha: 0.55,
                    drag: 0.1,
                });
                break;
            }

            case 'steam':
                Object.assign(p, {
                    vx: (r() - 0.5) * 0.05 + 0.03,
                    vy: 0.25 + r() * 0.1,
                    vz: (r() - 0.5) * 0.05,
                    max: 2 + r(),
                    size: 0.09,
                    grow: 0.14,
                    r: 0.95,
                    g: 0.96,
                    b: 0.98,
                    alpha: 0.5,
                    drag: 0.1,
                });
                break;

            case 'dust':
                Object.assign(p, {
                    vx: (r() - 0.5) * 0.5 * power,
                    vy: 0.05 + r() * 0.2 * power,
                    vz: (r() - 0.5) * 0.5 * power,
                    max: 0.9 + r() * 0.8,
                    size: 0.12 + r() * 0.08,
                    grow: 0.18,
                    r: 0.62,
                    g: 0.53,
                    b: 0.4,
                    alpha: 0.6,
                    drag: 2.2,
                });
                break;

            case 'water':
                Object.assign(p, {
                    vx: (r() - 0.5) * 0.25,
                    vy: 0.5 + r() * 0.25,
                    vz: (r() - 0.5) * 0.25,
                    max: 0.9,
                    size: 0.035,
                    grow: 0,
                    r: 0.7,
                    g: 0.86,
                    b: 1,
                    alpha: 0.8,
                    gravity: 1.4,
                    drag: 0,
                });
                break;

            case 'sparks':
                Object.assign(p, {
                    vx: (r() - 0.5) * 0.7 * power,
                    vy: 0.3 + r() * 0.6 * power,
                    vz: (r() - 0.5) * 0.7 * power,
                    max: 0.5 + r() * 0.5,
                    size: 0.04,
                    grow: -0.02,
                    r: 2.2,
                    g: 1.3,
                    b: 0.35,
                    alpha: 1,
                    gravity: 1.3,
                    drag: 0.6,
                });
                break;

            case 'sparkle': {
                const gold = r() > 0.4;

                Object.assign(p, {
                    vx: (r() - 0.5) * 0.25 * power,
                    vy: 0.2 + r() * 0.5 * power,
                    vz: (r() - 0.5) * 0.25 * power,
                    max: 1 + r() * 0.8,
                    size: 0.05 + r() * 0.04,
                    grow: -0.02,
                    r: gold ? 2 : 1.6,
                    g: gold ? 1.6 : 1.6,
                    b: gold ? 0.5 : 1.7,
                    alpha: 1,
                    gravity: -0.05,
                    drag: 0.8,
                });
                break;
            }

            case 'confetti': {
                const c = CONFETTI[Math.floor(r() * CONFETTI.length)];

                Object.assign(p, {
                    vx: (r() - 0.5) * 2.5 * power,
                    vy: 1.2 + r() * 1.8 * power,
                    vz: (r() - 0.5) * 2.5 * power,
                    max: 2.4 + r(),
                    size: 0.07,
                    grow: 0,
                    r: c.r,
                    g: c.g,
                    b: c.b,
                    alpha: 1,
                    gravity: 1.2,
                    drag: 1.2,
                });
                break;
            }
        }

        this.list.push(p);
    }

    /** A burst of `count` particles over a footprint (tile corner x, z; size w × d). */
    burst(
        kind: ParticleKind,
        x: number,
        y: number,
        z: number,
        w: number,
        d: number,
        count: number,
        power = 1,
    ): void {
        for (let i = 0; i < count; i++) {
            this.spawn(
                kind,
                x + Math.random() * w,
                y + Math.random() * 0.1,
                z + Math.random() * d,
                power,
            );
        }
    }

    update(dt: number): void {
        const step = Math.min(dt, 0.1);
        const alive: Particle[] = [];

        this.buffer.begin();

        for (const p of this.list) {
            p.life += step;

            if (p.life >= p.max) {
                continue;
            }

            const drag = Math.exp(-p.drag * step);

            p.vx *= drag;
            p.vz *= drag;
            p.vy = p.vy * drag - p.gravity * step;
            p.x += p.vx * step;
            p.y += p.vy * step;
            p.z += p.vz * step;
            p.size = Math.max(0.005, p.size + p.grow * step);

            const t = p.life / p.max;
            const alpha = p.alpha * clamp(t * 6, 0, 1) * (1 - t);

            this.buffer.add(p.x, p.y, p.z, p.size, p.r, p.g, p.b, alpha);
            alive.push(p);
        }

        this.list = alive;
        this.buffer.end();
    }

    dispose(): void {
        this.buffer.dispose();
    }
}
