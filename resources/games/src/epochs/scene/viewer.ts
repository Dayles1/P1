/**
 * A single-model 3D viewer for the content editor: shows a list of model
 * parts with a palette on a ground plate, drag to orbit, wheel to zoom,
 * optional auto-rotation, night (lit windows and glows) and snow.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ModelPart, Palette, RoofShape } from '../engine/content/types';
import { modelGroup } from './buildings';
import { clamp } from './colors';
import { GlowLayer, Particles } from './fx';
import type { ParticleKind } from './fx';
import { createMaterials } from './materials';
import type { MaterialSet } from './materials';
import { buildModel, createAnimated } from './model';
import type { AnimatedInstance, ModelGeometry } from './model';

export class ModelViewer {
    private gl: THREE.WebGLRenderer;
    private scene = new THREE.Scene();
    private camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
    private materials: MaterialSet;
    private environment: THREE.Texture;
    private sun: THREE.DirectionalLight;
    private hemisphere: THREE.HemisphereLight;
    private particles = new Particles(600);
    private glow = new GlowLayer(32);
    private content = new THREE.Group();
    private model: ModelGeometry | null = null;
    private animated: AnimatedInstance[] = [];
    private plate: THREE.Mesh | null = null;
    private target = new THREE.Vector3();
    private yaw = Math.PI / 4;
    private pitch = 0.6;
    private distance = 3;
    private autoRotate = false;
    private night = false;
    private frame = 0;
    private last = 0;
    private time = 0;
    private width = 0;
    private height = 0;
    private dragging: { x: number; y: number; id: number } | null = null;
    private listeners: [string, EventListener][] = [];

    constructor(private canvas: HTMLCanvasElement) {
        this.gl = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true,
        });
        this.gl.outputColorSpace = THREE.SRGBColorSpace;
        this.gl.toneMapping = THREE.ACESFilmicToneMapping;
        this.gl.toneMappingExposure = 1.15;
        this.gl.shadowMap.enabled = true;
        this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
        this.gl.setClearColor(0x000000, 0);

        const pmrem = new THREE.PMREMGenerator(this.gl);

        this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        pmrem.dispose();
        this.scene.environment = this.environment;
        this.materials = createMaterials();
        this.sun = new THREE.DirectionalLight(0xfff3df, 2.8);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(1024, 1024);
        this.sun.shadow.bias = -0.0005;
        this.sun.shadow.normalBias = 0.02;
        this.hemisphere = new THREE.HemisphereLight(0xdceaff, 0x8a7a60, 1.1);
        this.scene.add(
            this.sun,
            this.sun.target,
            this.hemisphere,
            this.content,
            this.particles.object,
            this.glow.object,
        );

        this.listen('pointerdown', (event) => {
            const e = event as PointerEvent;

            this.dragging = { x: e.clientX, y: e.clientY, id: e.pointerId };
            canvas.setPointerCapture?.(e.pointerId);
        });
        this.listen('pointermove', (event) => {
            const e = event as PointerEvent;

            if (!this.dragging || this.dragging.id !== e.pointerId) {
                return;
            }

            this.yaw -= (e.clientX - this.dragging.x) * 0.01;
            this.pitch = clamp(
                this.pitch + (e.clientY - this.dragging.y) * 0.008,
                0.05,
                1.45,
            );
            this.dragging.x = e.clientX;
            this.dragging.y = e.clientY;
        });

        const stop = (event: Event) => {
            const e = event as PointerEvent;

            if (this.dragging?.id === e.pointerId) {
                this.dragging = null;
                canvas.releasePointerCapture?.(e.pointerId);
            }
        };

        this.listen('pointerup', stop);
        this.listen('pointercancel', stop);
        this.listen(
            'wheel',
            (event) => {
                const e = event as WheelEvent;

                e.preventDefault();
                this.distance = clamp(
                    this.distance * Math.exp(e.deltaY * 0.0012),
                    0.4,
                    60,
                );
            },
            { passive: false },
        );

        const loop = (now: number) => {
            this.frame = requestAnimationFrame(loop);
            this.render(now);
        };

        this.frame = requestAnimationFrame(loop);
    }

    private listen(
        type: string,
        listener: EventListener,
        options?: AddEventListenerOptions,
    ): void {
        this.canvas.addEventListener(type, listener, options);
        this.listeners.push([type, listener]);
    }

    /** Shows a model: its parts, palette, footprint size (tiles) and look options. */
    show(
        parts: ModelPart[],
        palette: Palette,
        size: { w: number; h: number },
        opts: { roof?: RoofShape | null; night?: boolean; snow?: number } = {},
    ): void {
        this.clear();

        const model = buildModel(parts ?? [], palette, {
            wallIndex: 0,
            seed: 0,
            roof: opts.roof ?? null,
        });
        const group = modelGroup(
            model,
            (bucket) => this.materials.buckets[bucket],
        );

        for (const spec of model.animated) {
            const instance = createAnimated(spec, this.materials, 0.2);

            this.animated.push(instance);
            group.add(instance.object);
        }

        const margin = 0.6;
        const plateGeometry = new THREE.BoxGeometry(
            size.w + margin * 2,
            0.06,
            size.h + margin * 2,
        ).translate(size.w / 2, -0.03, size.h / 2);

        this.plate = new THREE.Mesh(
            plateGeometry,
            new THREE.MeshStandardMaterial({
                color: opts.snow ? 0xe8eef2 : 0x86a85a,
                roughness: 0.95,
            }),
        );
        this.plate.receiveShadow = true;
        this.content.add(this.plate, group);
        this.model = model;
        this.night = Boolean(opts.night);
        this.materials.uniforms.uSnow.value = clamp(opts.snow ?? 0, 0, 1);
        this.materials.uniforms.uLit.value = this.night ? 0.7 : 0;

        const bounds = model.bounds
            .clone()
            .union(
                new THREE.Box3(
                    new THREE.Vector3(0, 0, 0),
                    new THREE.Vector3(size.w, 0.1, size.h),
                ),
            );
        const radius = bounds.getSize(new THREE.Vector3()).length() / 2;

        bounds.getCenter(this.target);
        this.target.y = Math.min(this.target.y, bounds.max.y * 0.45);
        this.distance = Math.max(1.2, radius * 3.2);

        const shadow = this.sun.shadow.camera;
        const extent = radius + margin + 0.5;

        shadow.left = -extent;
        shadow.right = extent;
        shadow.top = extent;
        shadow.bottom = -extent;
        shadow.near = 0.1;
        shadow.far = extent * 6 + 10;
        shadow.updateProjectionMatrix();

        this.glow.begin();

        for (const light of model.lights) {
            this.glow.add(light.position, light.radius * 2, light.color, 0.85);
        }

        this.glow.end();
    }

    setAutoRotate(on: boolean): void {
        this.autoRotate = on;
    }

    private clear(): void {
        if (this.model) {
            this.model.dispose();
            this.model = null;
        }

        if (this.plate) {
            this.plate.geometry.dispose();
            (this.plate.material as THREE.Material).dispose();
            this.plate = null;
        }

        this.content.clear();
        this.animated = [];
        this.particles.clear();
    }

    private render(now: number): void {
        const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;

        this.last = now;
        this.time += dt;

        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;

        if (!width || !height) {
            return;
        }

        if (width !== this.width || height !== this.height) {
            this.width = width;
            this.height = height;
            this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            this.gl.setSize(width, height, false);
            this.camera.aspect = width / height;
        }

        if (this.autoRotate && !this.dragging) {
            this.yaw += dt * 0.45;
        }

        const horizontal = this.distance * Math.cos(this.pitch);

        this.camera.position.set(
            this.target.x + Math.sin(this.yaw) * horizontal,
            this.target.y + this.distance * Math.sin(this.pitch),
            this.target.z + Math.cos(this.yaw) * horizontal,
        );
        this.camera.lookAt(this.target);
        this.camera.near = Math.max(0.01, this.distance * 0.01);
        this.camera.far = this.distance * 10 + 20;
        this.camera.updateProjectionMatrix();

        const night = this.night ? 1 : 0;

        this.sun.color.set(this.night ? 0x9db2ff : 0xfff3df);
        this.sun.intensity = this.night ? 0.5 : 2.8;
        this.sun.position.set(
            this.target.x + 4,
            this.target.y + 7,
            this.target.z + 5,
        );
        this.sun.target.position.copy(this.target);
        this.hemisphere.intensity = this.night ? 0.35 : 1.1;
        this.scene.environmentIntensity = this.night ? 0.08 : 0.4;
        this.materials.uniforms.uTime.value = this.time;
        this.materials.glow.color.setScalar(1 + night * 0.6);
        this.glow.intensity = night;

        for (const instance of this.animated) {
            instance.update(this.time, night);
        }

        if (this.model) {
            for (const emitter of this.model.emitters) {
                if (Math.random() < 4 * dt) {
                    this.particles.spawn(
                        emitter.type as ParticleKind,
                        emitter.position.x,
                        emitter.position.y,
                        emitter.position.z,
                    );
                }
            }
        }

        const scale =
            (height * this.gl.getPixelRatio()) /
            (2 * Math.tan((this.camera.fov * Math.PI) / 360));

        this.particles.scale = scale;
        this.glow.scale = scale;
        this.particles.update(dt);
        this.gl.render(this.scene, this.camera);
    }

    dispose(): void {
        cancelAnimationFrame(this.frame);

        for (const [type, listener] of this.listeners) {
            this.canvas.removeEventListener(type, listener);
        }

        this.clear();
        this.materials.dispose();
        this.particles.dispose();
        this.glow.dispose();
        this.environment.dispose();
        this.sun.dispose();
        this.hemisphere.dispose();
        this.gl.dispose();
    }
}
