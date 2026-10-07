/**
 * The 3D view of a Game (three.js): terrain, water, roads, trees, the
 * buildings from their models, residents and traffic, sky, sun and
 * weather, effects for what happens in the city and the overlays the
 * player works with. Only what changed is rebuilt each frame.
 *
 * World coordinates: 1 tile = 1 unit; tile (x, y) covers X ∈ [x, x+1],
 * Z ∈ [y, y+1]; Y is up.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { GameEvent } from '../engine/core/events';
import type { Game } from '../engine/sim/game';
import type { BuildingState, NpcState } from '../engine/sim/state';
import { Buildings, ModelCache } from './buildings';
import { OrbitCamera } from './camera';
import { clamp, color } from './colors';
import { Features } from './features';
import { GlowLayer, Particles } from './fx';
import type { ParticleKind } from './fx';
import { Labels } from './labels';
import { createMaterials } from './materials';
import type { MaterialSet } from './materials';
import { Overlays } from './overlays';
import { People } from './people';
import { Roads } from './roads';
import { Sky } from './sky';
import { Terrain } from './terrain';
import { Weather } from './weather';

export interface Overlay {
    hover: { x: number; y: number } | null;
    ghost: {
        type: string;
        level: number;
        x: number;
        y: number;
        ok: boolean;
        moving?: number;
    } | null;
    roadPath: { x: number; y: number; ok: boolean }[];
    selectedUid: number | null;
    selectedNpc: number | null;
    bulldoze: boolean;
    /** Buildings see-through (to reach ones behind). */
    xray: boolean;
    /** Tint every district's area. */
    showDistricts: boolean;
}

/** Everything built for one attached game. */
interface World {
    game: Game;
    terrain: Terrain;
    roads: Roads;
    features: Features;
    buildings: Buildings;
    people: People;
    overlays: Overlays;
    group: THREE.Group;
}

const EMITTER_RATES: Record<string, number> = {
    smoke: 3,
    steam: 4,
    dust: 2.5,
    water: 22,
    sparks: 7,
};

/** Graphics presets: low trades looks for speed on weak machines. */
export type Quality = 'low' | 'medium' | 'high';

export class Renderer {
    /** Frames per second, averaged over about a second. */
    fps = 60;
    private quality: Quality = 'high';
    private fpsFrames = 0;
    private fpsTime = 0;

    private canvas: HTMLCanvasElement;
    private gl: THREE.WebGLRenderer;
    private scene = new THREE.Scene();
    private orbit: OrbitCamera;
    private materials: MaterialSet;
    private sky: Sky;
    private labels: Labels;
    private particles = new Particles();
    private staticGlow = new GlowLayer(512);
    private dynamicGlow = new GlowLayer(256);
    private weather = new Weather();
    private environment: THREE.Texture;
    private cache = new ModelCache();
    private world: World | null = null;
    private raycaster = new THREE.Raycaster();
    private width = 1;
    private height = 1;
    private time = 0;
    private night = 0;
    private structureRevision = -1;
    private glowRevision = '';
    private roadTimer = 0;
    private featureTimer = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.gl = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            powerPreference: 'high-performance',
        });
        this.gl.outputColorSpace = THREE.SRGBColorSpace;
        this.gl.toneMapping = THREE.ACESFilmicToneMapping;
        this.gl.toneMappingExposure = 1.15;
        this.gl.shadowMap.enabled = true;
        this.gl.shadowMap.type = THREE.PCFSoftShadowMap;

        const pmrem = new THREE.PMREMGenerator(this.gl);

        this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        pmrem.dispose();
        this.scene.environment = this.environment;
        this.materials = createMaterials();
        this.sky = new Sky(this.scene);
        this.labels = new Labels(canvas);
        this.orbit = new OrbitCamera(
            (x, z) => this.world?.terrain.heightAt(x, z) ?? 0,
        );
        this.scene.add(
            this.particles.object,
            this.staticGlow.object,
            this.dynamicGlow.object,
            this.weather.group,
        );
        this.resize();
    }

    /** Camera state for the UI (compass etc.). yaw in radians, 0 = looking north (towards y−). */
    get view(): {
        yaw: number;
        pitch: number;
        distance: number;
        targetX: number;
        targetY: number;
    } {
        return this.orbit.view;
    }

    /** (Re)builds the scene for a game. */
    attach(game: Game): void {
        this.detach();

        const terrain = new Terrain(game);
        const roads = new Roads(game, terrain);
        const features = new Features(game, terrain, this.materials);
        const buildings = new Buildings(
            game,
            terrain,
            this.materials,
            this.cache,
        );
        const people = new People(game, terrain);
        const overlays = new Overlays(
            game,
            terrain,
            buildings,
            people,
            this.materials,
        );
        const group = new THREE.Group();

        group.add(
            terrain.group,
            roads.group,
            features.group,
            buildings.group,
            people.group,
            overlays.group,
        );
        this.scene.add(group);
        this.world = {
            game,
            terrain,
            roads,
            features,
            buildings,
            people,
            overlays,
            group,
        };
        this.structureRevision = -1;
        this.glowRevision = '';
        this.particles.clear();
        this.labels.clear();
        this.orbit.setBounds(game.map.width, game.map.height);

        buildings.sync();
        this.reflatten();
        features.sync(true);

        const center = game.center;

        if (center) {
            const { w, h } = game.def(center).size;

            this.orbit.centerOn(center.x + w / 2, center.y + h / 2, false);
        } else {
            this.orbit.centerOn(game.map.width / 2, game.map.height / 2, false);
        }
    }

    private detach(): void {
        const world = this.world;

        if (!world) {
            return;
        }

        this.scene.remove(world.group);
        world.overlays.dispose();
        world.people.dispose();
        world.buildings.dispose();
        world.features.dispose();
        world.roads.dispose();
        world.terrain.dispose();
        this.world = null;
        this.particles.clear();
        this.labels.clear();
    }

    /**
     * Picks a graphics preset: high = sharp (up to 2× pixels) with soft
     * 2048 shadows, medium = 1.25× pixels and 1024 shadows, low = 1×
     * pixels and no shadows.
     */
    setQuality(quality: Quality): void {
        this.quality = quality;
        this.gl.shadowMap.enabled = quality !== 'low';
        this.gl.shadowMap.type =
            quality === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
        this.sky.sun.castShadow = quality !== 'low';

        const size = quality === 'high' ? 2048 : 1024;

        if (this.sky.sun.shadow.mapSize.x !== size) {
            this.sky.sun.shadow.mapSize.set(size, size);
            this.sky.sun.shadow.map?.dispose();
            this.sky.sun.shadow.map = null;
        }

        this.scene.traverse((object) => {
            const material = (object as THREE.Mesh).material;

            if (material) {
                for (const item of Array.isArray(material)
                    ? material
                    : [material]) {
                    item.needsUpdate = true;
                }
            }
        });
        this.resize();
    }

    /** The canvas' CSS size changed. */
    resize(): void {
        this.width = Math.max(1, this.canvas.clientWidth);
        this.height = Math.max(1, this.canvas.clientHeight);
        this.gl.setPixelRatio(
            Math.min(
                window.devicePixelRatio || 1,
                this.quality === 'high'
                    ? 2
                    : this.quality === 'medium'
                      ? 1.25
                      : 1,
            ),
        );
        this.gl.setSize(this.width, this.height, false);
        this.orbit.setAspect(this.width / this.height);
        this.labels.resize();
    }

    /** Ground under the buildings moved: flatten and re-seat what lies on it. */
    private reflatten(): void {
        const world = this.world!;

        this.structureRevision = world.buildings.structureRevision;
        world.terrain.flatten(world.buildings.footprints());
        world.roads.sync(true);
        world.features.sync(true);
        world.overlays.invalidate();
    }

    /** Every animation frame; dt in real seconds. */
    frame(dt: number, overlay: Overlay): void {
        this.fpsFrames++;
        this.fpsTime += dt;

        if (this.fpsTime >= 1) {
            this.fps = Math.round(this.fpsFrames / this.fpsTime);
            this.fpsFrames = 0;
            this.fpsTime = 0;
        }

        const world = this.world;
        const step = Math.min(0.1, Math.max(0, dt));

        this.time += step;

        if (!world) {
            this.gl.render(this.scene, this.orbit.camera);

            return;
        }

        const game = world.game;
        const season = game.season;

        this.orbit.update(step);

        const target = this.orbit.target;
        const distance = this.orbit.current.distance;
        const sky = this.sky.update(game, target, distance);

        this.night = sky.night;

        const uniforms = this.materials.uniforms;

        uniforms.uTime.value = this.time;
        uniforms.uSnow.value = season.snow ?? 0;
        uniforms.uLit.value = clamp((sky.night - 0.1) * 0.8, 0, 0.6);
        this.materials.foliage.color.copy(color(season.treeTint || '#4f9a4a'));
        this.materials.glow.color.setScalar(1 + sky.night * 0.6);
        this.materials.setXray(overlay.xray);

        world.terrain.update(step, this.time);
        world.terrain.showGrid(
            Boolean(overlay.ghost) || overlay.roadPath.length > 0,
        );
        world.buildings.sync();

        if (world.buildings.structureRevision !== this.structureRevision) {
            this.reflatten();
        }

        this.roadTimer -= step;
        this.featureTimer -= step;

        if (this.roadTimer <= 0) {
            this.roadTimer = 0.25;
            world.roads.sync();
        }

        if (this.featureTimer <= 0) {
            this.featureTimer = 0.5;
            world.features.sync();
        }

        world.buildings.update(this.time, sky.night);
        world.roads.update(sky.night);
        this.updateGlow(world);
        this.dynamicGlow.begin();
        world.people.update(step, this.time, sky.night, this.dynamicGlow);
        this.dynamicGlow.end();
        this.dynamicGlow.intensity = 1;
        this.spawnEmitters(world, step, target, distance);

        const pointScale =
            (this.height * this.gl.getPixelRatio()) /
            (2 * Math.tan((this.orbit.camera.fov * Math.PI) / 360));

        this.particles.scale = pointScale;
        this.staticGlow.scale = pointScale;
        this.dynamicGlow.scale = pointScale;
        this.particles.update(step);

        const particles = game.weather?.particles ?? null;

        this.weather.update(
            step,
            particles?.kind ?? null,
            particles?.density ?? 0,
            target,
            clamp(distance * 0.8, 10, 45),
            sky.level,
        );
        world.overlays.update(overlay, this.time);
        this.updateLabels(world, step);
        this.gl.render(this.scene, this.orbit.camera);
    }

    /** Static glows (lamps, model lights), rebuilt when buildings or roads change. */
    private updateGlow(world: World): void {
        const key = `${world.buildings.revision}:${world.roads.revision}`;

        if (key !== this.glowRevision) {
            this.glowRevision = key;
            this.staticGlow.begin();

            for (const lamp of world.roads.lamps) {
                this.staticGlow.add(lamp.position, 0.9, lamp.color, 0.75);
            }

            for (const entry of world.buildings.entries.values()) {
                if (!entry.complete) {
                    continue;
                }

                for (const light of entry.model.lights) {
                    this.staticGlow.addXYZ(
                        entry.building.x + light.position.x,
                        entry.base + light.position.y,
                        entry.building.y + light.position.z,
                        light.radius * 2,
                        light.color,
                        0.8,
                    );
                }
            }

            this.staticGlow.end();
        }

        this.staticGlow.intensity = this.night;
    }

    private spawnEmitters(
        world: World,
        dt: number,
        target: THREE.Vector3,
        distance: number,
    ): void {
        const reach = distance * 1.4 + 8;
        const reach2 = reach * reach;
        const busy = this.particles.count > 2400;

        if (busy) {
            return;
        }

        for (const { position, type } of world.buildings.emitters()) {
            const dx = position.x - target.x;
            const dz = position.z - target.z;

            if (dx * dx + dz * dz > reach2) {
                continue;
            }

            if (Math.random() < (EMITTER_RATES[type] ?? 2) * dt) {
                this.particles.spawn(
                    type as ParticleKind,
                    position.x,
                    position.y,
                    position.z,
                );
            }
        }
    }

    private project(position: THREE.Vector3): {
        x: number;
        y: number;
        visible: boolean;
    } {
        const v = position.clone().project(this.orbit.camera);

        return {
            x: ((v.x + 1) / 2) * this.width,
            y: ((1 - v.y) / 2) * this.height,
            visible:
                v.z > -1 &&
                v.z < 1 &&
                Math.abs(v.x) <= 1.05 &&
                Math.abs(v.y) <= 1.05,
        };
    }

    private updateLabels(world: World, dt: number): void {
        const game = world.game;
        const point = new THREE.Vector3();

        this.labels.beginFrame();

        for (const entry of world.buildings.entries.values()) {
            const { w, h } = entry.def.size;

            point.set(
                entry.building.x + w / 2,
                entry.box.max.y + 0.12,
                entry.building.y + h / 2,
            );

            const progress = world.buildings.progressOf(entry);

            if (progress !== null) {
                const screen = this.project(point);

                if (screen.visible) {
                    this.labels.progress(
                        `p${entry.uid}`,
                        progress,
                        screen.x,
                        screen.y,
                    );
                }

                continue;
            }

            const status = game.status.get(entry.uid);

            if (!status || !status.complete) {
                continue;
            }

            let text = '';

            if (!status.connected) {
                text += '🚧';
            }

            if (status.noPower) {
                text += '⚡';
            }

            if (status.starved) {
                text += '📦';
            }

            if (
                game.effects(entry.building).jobs > 0 &&
                status.efficiency < 0.5 &&
                status.connected
            ) {
                text += '👷';
            }

            if (text) {
                const screen = this.project(point);

                if (screen.visible) {
                    this.labels.badge(
                        `b${entry.uid}`,
                        text,
                        screen.x,
                        screen.y,
                    );
                }
            }
        }

        this.labels.endFrame();
        this.labels.update(dt, (position) => this.project(position));
    }

    /** Visual effects for engine events. */
    handle(event: GameEvent): void {
        const world = this.world;

        if (!world) {
            return;
        }

        const terrain = world.terrain;
        const particles = this.particles;

        switch (event.type) {
            case 'placed': {
                const base = terrain.baseOf(event.x, event.y, event.w, event.h);

                particles.burst(
                    'dust',
                    event.x,
                    base,
                    event.y,
                    event.w,
                    event.h,
                    14 * event.w * event.h,
                );
                break;
            }

            case 'removed': {
                const base = terrain.baseOf(event.x, event.y, event.w, event.h);

                particles.burst(
                    'dust',
                    event.x,
                    base + 0.05,
                    event.y,
                    event.w,
                    event.h,
                    24 * event.w * event.h,
                    1.4,
                );
                break;
            }

            case 'upgraded': {
                const base = terrain.baseOf(event.x, event.y, event.w, event.h);
                const entry = world.buildings.entries.get(event.uid);
                const top = entry ? entry.box.max.y : base + 0.5;

                particles.burst(
                    'sparks',
                    event.x,
                    base + 0.2,
                    event.y,
                    event.w,
                    event.h,
                    30,
                );
                this.labels.float(
                    '⬆ Улучшение',
                    new THREE.Vector3(
                        event.x + event.w / 2,
                        top + 0.2,
                        event.y + event.h / 2,
                    ),
                    '#ffe27a',
                );
                break;
            }

            case 'built': {
                const building = world.game.buildings.get(event.uid);

                if (building) {
                    const { w, h } = world.game.def(building).size;
                    const entry = world.buildings.entries.get(event.uid);
                    const base =
                        entry?.base ??
                        terrain.baseOf(building.x, building.y, w, h);
                    const top = entry ? entry.box.max.y : base + 0.4;

                    particles.burst(
                        'sparkle',
                        building.x,
                        base + (top - base) * 0.5,
                        building.y,
                        w,
                        h,
                        26,
                    );
                }

                break;
            }

            case 'cleared': {
                const ground = terrain.heightAt(event.x + 0.5, event.y + 0.5);

                particles.burst('dust', event.x, ground, event.y, 1, 1, 16);

                if (event.text) {
                    this.labels.float(
                        event.text,
                        new THREE.Vector3(
                            event.x + 0.5,
                            ground + 0.5,
                            event.y + 0.5,
                        ),
                        '#ffffff',
                    );
                }

                break;
            }

            case 'epoch': {
                const target = this.orbit.target;
                const spread = clamp(this.orbit.current.distance * 0.35, 4, 16);

                for (let i = 0; i < 260; i++) {
                    particles.spawn(
                        'confetti',
                        target.x + (Math.random() - 0.5) * spread,
                        target.y + 0.5 + Math.random() * 2,
                        target.z + (Math.random() - 0.5) * spread,
                    );
                }

                this.labels.flash();
                break;
            }

            case 'achievement': {
                const target = this.orbit.target;

                for (let i = 0; i < 90; i++) {
                    particles.spawn(
                        'sparkle',
                        target.x + (Math.random() - 0.5) * 3,
                        target.y + 0.3 + Math.random() * 1.5,
                        target.z + (Math.random() - 0.5) * 3,
                        1.6,
                    );
                }

                break;
            }

            default:
                break;
        }
    }

    centerOn(x: number, y: number, smooth = true): void {
        this.orbit.centerOn(x, y, smooth);
    }

    zoomBy(factor: number, px?: number, py?: number): void {
        const towards =
            px !== undefined && py !== undefined ? this.groundAt(px, py) : null;

        this.orbit.zoom(
            factor,
            towards ? { x: towards.x, z: towards.y } : null,
        );
    }

    panBy(dx: number, dy: number): void {
        this.orbit.pan(dx, dy, this.height);
    }

    rotateBy(radians: number): void {
        this.orbit.rotate(radians);
    }

    tiltBy(radians: number): void {
        this.orbit.tilt(radians);
    }

    setYaw(radians: number, smooth = true): void {
        this.orbit.setYaw(radians, smooth);
    }

    private ray(px: number, py: number): THREE.Ray {
        const ndc = new THREE.Vector2(
            (px / this.width) * 2 - 1,
            -((py / this.height) * 2 - 1),
        );

        this.orbit.camera.updateMatrixWorld();
        this.raycaster.setFromCamera(ndc, this.orbit.camera);

        return this.raycaster.ray;
    }

    /** Float tile coordinates on the terrain under a CSS-pixel point of the canvas. */
    groundAt(px: number, py: number): { x: number; y: number } | null {
        const world = this.world;

        if (!world) {
            return null;
        }

        const ray = this.ray(px, py);
        const terrain = world.terrain;
        const origin = ray.origin;
        const direction = ray.direction;

        if (direction.y >= -1e-4) {
            return null;
        }

        // March between the highest and lowest possible ground.
        const top = 4;
        const bottom = -0.7;
        const t0 = Math.max(0, (top - origin.y) / direction.y);
        const t1 = (bottom - origin.y) / direction.y;
        const stepLength = 0.1;
        let previous = t0;
        let hit = -1;

        const above = (t: number) => {
            const x = origin.x + direction.x * t;
            const z = origin.z + direction.z * t;

            return (
                origin.y +
                direction.y * t -
                Math.max(terrain.heightAt(x, z), -0.1)
            );
        };

        for (let t = t0; t <= t1; t += stepLength) {
            if (above(t) <= 0) {
                hit = t;
                break;
            }

            previous = t;
        }

        if (hit < 0) {
            hit = t1;
        }

        let low = previous;
        let high = hit;

        for (let i = 0; i < 10; i++) {
            const mid = (low + high) / 2;

            if (above(mid) > 0) {
                low = mid;
            } else {
                high = mid;
            }
        }

        const x = origin.x + direction.x * high;
        const z = origin.z + direction.z * high;

        if (
            x < 0 ||
            z < 0 ||
            x >= world.game.map.width ||
            z >= world.game.map.height
        ) {
            return null;
        }

        return { x, y: z };
    }

    /** Every building under the point, nearest first; roads only if nothing else. */
    pickBuildings(px: number, py: number): BuildingState[] {
        const world = this.world;

        if (!world) {
            return [];
        }

        const ray = this.ray(px, py);
        const hits: { building: BuildingState; distance: number }[] = [];
        const point = new THREE.Vector3();

        for (const entry of world.buildings.entries.values()) {
            if (ray.intersectBox(entry.box, point)) {
                hits.push({
                    building: entry.building,
                    distance: point.distanceTo(ray.origin),
                });
            }
        }

        if (hits.length) {
            hits.sort((a, b) => a.distance - b.distance);

            return hits.map((hit) => hit.building);
        }

        const ground = this.groundAt(px, py);

        if (ground) {
            const building = world.game.buildingAt(
                Math.floor(ground.x),
                Math.floor(ground.y),
            );

            if (building) {
                return [building];
            }
        }

        return [];
    }

    pickNpc(px: number, py: number): NpcState | null {
        const world = this.world;

        if (!world) {
            return null;
        }

        let best: number | null = null;
        let bestDistance = 16;
        const point = new THREE.Vector3();

        for (const [uid, position] of world.people.drawn) {
            point.copy(position);
            point.y += 0.1;

            const screen = this.project(point);

            if (!screen.visible) {
                continue;
            }

            const distance = Math.hypot(screen.x - px, screen.y - py);

            if (distance < bestDistance) {
                bestDistance = distance;
                best = uid;
            }
        }

        return best !== null ? (world.game.npcs.get(best) ?? null) : null;
    }

    /**
     * Canvas CSS pixels of a world point given in tile coordinates; `z` is
     * the height above the ground there.
     */
    worldToScreen(
        x: number,
        y: number,
        z = 0,
    ): { x: number; y: number; visible: boolean } {
        const ground = this.world?.terrain.heightAt(x, y) ?? 0;

        return this.project(new THREE.Vector3(x, ground + z, y));
    }

    dispose(): void {
        this.detach();
        this.cache.dispose();
        this.materials.dispose();
        this.sky.dispose();
        this.particles.dispose();
        this.staticGlow.dispose();
        this.dynamicGlow.dispose();
        this.weather.dispose();
        this.environment.dispose();
        this.labels.dispose();
        this.gl.dispose();
    }
}
