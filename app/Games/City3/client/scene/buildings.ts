/**
 * Buildings: each building's model geometry is built once per look (cached
 * by lookKey + wall variant + lit-window pattern) and, once complete,
 * merged with its neighbours into one mesh per material per 8×8-tile
 * chunk — a few hundred draw calls for the whole city. Buildings under
 * construction are drawn on their own, growing from the ground inside
 * scaffolding (an upgrade keeps showing the previous level until done).
 * Moving parts (blades, rings, beacons) are small separate objects.
 */

import * as THREE from 'three';
import type { BuildingDef, Palette, RoofShape } from '../engine/content/types';
import type { Game } from '../engine/sim/game';
import type { BuildingState } from '../engine/sim/state';
import { wallsOf } from './colors';
import type { Bucket, MaterialSet } from './materials';
import { BUCKETS } from './materials';
import {
    buildModel,
    buildScaffold,
    createAnimated,
    mergeTranslated,
} from './model';
import type { AnimatedInstance, ModelGeometry } from './model';
import type { Footprint, Terrain } from './terrain';

const CHUNK = 8;

interface Cached {
    model: ModelGeometry;
    refs: number;
}

export interface BuildingEntry {
    uid: number;
    building: BuildingState;
    def: BuildingDef;
    signature: string;
    cacheKey: string;
    model: ModelGeometry;
    chunk: number;
    base: number;
    complete: boolean;
    /** The level drawn (the previous one while upgrading). */
    shownLevel: number;
    /** The last level seen complete. */
    completeLevel: number;
    upgrading: boolean;
    /** World bounds for picking. */
    box: THREE.Box3;
    animated: AnimatedInstance[];
    animatedGroup: THREE.Group | null;
    individual: THREE.Group | null;
}

/** A model plus the palette and roof it was built with, shareable by key. */
export class ModelCache {
    private cache = new Map<string, Cached>();
    private scaffolds = new Map<string, THREE.BufferGeometry>();

    acquire(key: string, make: () => ModelGeometry): ModelGeometry {
        let cached = this.cache.get(key);

        if (!cached) {
            cached = { model: make(), refs: 0 };
            this.cache.set(key, cached);
        }

        cached.refs++;

        return cached.model;
    }

    release(key: string): void {
        const cached = this.cache.get(key);

        if (cached && --cached.refs <= 0) {
            cached.model.dispose();
            this.cache.delete(key);
        }
    }

    scaffold(w: number, d: number, h: number): THREE.BufferGeometry {
        const height = Math.ceil(h * 5) / 5;
        const key = `${w}x${d}x${height}`;
        let geometry = this.scaffolds.get(key);

        if (!geometry) {
            geometry = buildScaffold(w, d, height);
            this.scaffolds.set(key, geometry);
        }

        return geometry;
    }

    dispose(): void {
        for (const cached of this.cache.values()) {
            cached.model.dispose();
        }

        for (const geometry of this.scaffolds.values()) {
            geometry.dispose();
        }

        this.cache.clear();
        this.scaffolds.clear();
    }
}

/** A group of meshes (one per bucket) for a model, sharing its geometry. */
export function modelGroup(
    model: ModelGeometry,
    material: (bucket: Bucket) => THREE.Material,
    shadows = true,
): THREE.Group {
    const group = new THREE.Group();

    for (const bucket of BUCKETS) {
        const geometry = model.buckets[bucket];

        if (geometry) {
            const mesh = new THREE.Mesh(geometry, material(bucket));

            mesh.castShadow =
                shadows && bucket !== 'glow' && bucket !== 'windows';
            mesh.receiveShadow = shadows;
            group.add(mesh);
        }
    }

    return group;
}

function shadowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');

    canvas.width = 64;
    canvas.height = 64;

    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 6, 32, 32, 32);

    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(0.55, 'rgba(0,0,0,0.6)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);

    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
}

/** Look inputs of one building at a level. */
export interface Look {
    cacheKey: string;
    palette: Palette;
    roof: RoofShape | null;
    wallIndex: number;
    seed: number;
}

export function lookOf(
    game: Game,
    building: BuildingState,
    level = building.level,
): Look {
    const at = level === building.level ? building : { ...building, level };
    const palette = game.paletteOf(at);
    const walls = wallsOf(palette);
    const wallIndex = Math.floor(game.noise(building, 7) * walls.length);
    const seed = Math.floor(game.noise(building, 3) * 4);
    const roof = game.roofOf(at);

    return {
        cacheKey: `${game.lookKey(at)}|${roof ?? ''}|w${wallIndex}|s${seed}`,
        palette,
        roof,
        wallIndex,
        seed,
    };
}

export class Buildings {
    readonly group = new THREE.Group();
    readonly entries = new Map<number, BuildingEntry>();
    /** Bumped when any footprint appears, moves or goes. */
    structureRevision = 0;
    /** Bumped when anything about the set of drawn buildings changes. */
    revision = 0;

    private chunks = new Map<number, THREE.Mesh[]>();
    private dirtyChunks = new Set<number>();
    private chunkGroup = new THREE.Group();
    private individualGroup = new THREE.Group();
    private animatedGroup = new THREE.Group();
    private shadows: THREE.InstancedMesh | null = null;
    private shadowGeometry: THREE.PlaneGeometry;
    private shadowMaterial: THREE.MeshBasicMaterial;
    private shadowTexture: THREE.CanvasTexture;
    private shadowsDirty = true;
    private chunksPerRow: number;
    private seen = new Set<number>();

    constructor(
        private game: Game,
        private terrain: Terrain,
        private materials: MaterialSet,
        readonly cache: ModelCache,
    ) {
        this.chunksPerRow = Math.ceil(game.map.width / CHUNK);
        this.shadowTexture = shadowTexture();
        this.shadowGeometry = new THREE.PlaneGeometry(1, 1);
        this.shadowGeometry.rotateX(-Math.PI / 2);
        this.shadowMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            alphaMap: this.shadowTexture,
            transparent: true,
            opacity: 0.32,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -4,
            polygonOffsetUnits: -4,
        });
        this.group.add(
            this.chunkGroup,
            this.individualGroup,
            this.animatedGroup,
        );
    }

    /** Footprints of every non-road building, for flattening the ground. */
    footprints(): Footprint[] {
        return [...this.entries.values()].map((entry) => ({
            x: entry.building.x,
            y: entry.building.y,
            w: entry.def.size.w,
            h: entry.def.size.h,
            base: entry.base,
        }));
    }

    /** Diffs the game's buildings against what is drawn. */
    sync(): void {
        const game = this.game;

        this.seen.clear();

        for (const building of game.buildings.values()) {
            const def = game.def(building);

            if (def.role === 'road') {
                continue;
            }

            this.seen.add(building.uid);

            const entry = this.entries.get(building.uid);
            const complete = game.isComplete(building);
            let completeLevel = entry
                ? entry.completeLevel
                : complete
                  ? building.level
                  : 0;

            if (
                entry &&
                entry.complete &&
                entry.building.level <= building.level
            ) {
                completeLevel = Math.max(completeLevel, entry.shownLevel);
            }

            if (complete) {
                completeLevel = building.level;
            }

            const upgrading =
                !complete &&
                completeLevel > 0 &&
                completeLevel < building.level;
            const shownLevel = upgrading ? completeLevel : building.level;
            const signature = `${game.lookKey(building)}|${shownLevel}|${building.x},${building.y}|${complete ? 1 : 0}|${upgrading ? 1 : 0}`;

            if (!entry || entry.signature !== signature) {
                this.place(
                    building,
                    def,
                    signature,
                    complete,
                    shownLevel,
                    completeLevel,
                    upgrading,
                    entry,
                );
            }
        }

        for (const uid of [...this.entries.keys()]) {
            if (!this.seen.has(uid)) {
                this.remove(uid);
            }
        }
    }

    private place(
        building: BuildingState,
        def: BuildingDef,
        signature: string,
        complete: boolean,
        shownLevel: number,
        completeLevel: number,
        upgrading: boolean,
        previous: BuildingEntry | undefined,
    ): void {
        const game = this.game;
        const look = lookOf(game, building, shownLevel);
        const levelDef = game.content.level(def, shownLevel);
        const model = this.cache.acquire(look.cacheKey, () =>
            buildModel(levelDef.model?.parts ?? [], look.palette, {
                wallIndex: look.wallIndex,
                seed: look.seed,
                roof: look.roof,
            }),
        );

        if (previous) {
            this.detach(previous);
        }

        const base = this.terrain.baseOf(
            building.x,
            building.y,
            def.size.w,
            def.size.h,
        );
        const chunk =
            Math.floor(building.y / CHUNK) * this.chunksPerRow +
            Math.floor(building.x / CHUNK);
        const box = model.bounds
            .clone()
            .translate(new THREE.Vector3(building.x, base, building.y));

        box.union(
            new THREE.Box3(
                new THREE.Vector3(building.x, base, building.y),
                new THREE.Vector3(
                    building.x + def.size.w,
                    base + 0.1,
                    building.y + def.size.h,
                ),
            ),
        );

        const entry: BuildingEntry = {
            uid: building.uid,
            building,
            def,
            signature,
            cacheKey: look.cacheKey,
            model,
            chunk,
            base,
            complete,
            shownLevel,
            completeLevel,
            upgrading,
            box,
            animated: [],
            animatedGroup: null,
            individual: null,
        };

        if (
            !previous ||
            previous.building.x !== building.x ||
            previous.building.y !== building.y
        ) {
            this.structureRevision++;
        }

        this.entries.set(building.uid, entry);
        this.revision++;
        this.shadowsDirty = true;

        if (complete) {
            this.dirtyChunks.add(chunk);

            if (model.animated.length) {
                const group = new THREE.Group();

                group.position.set(building.x, base, building.y);

                for (const spec of model.animated) {
                    const instance = createAnimated(
                        spec,
                        this.materials,
                        game.noise(building, 11),
                    );

                    entry.animated.push(instance);
                    group.add(instance.object);
                }

                entry.animatedGroup = group;
                this.animatedGroup.add(group);
            }
        } else {
            const group = new THREE.Group();
            const growing = modelGroup(
                model,
                (bucket) => this.materials.buckets[bucket],
            );
            const targetHeight = upgrading
                ? Math.max(model.height, this.levelHeight(def, building.level))
                : model.height;
            const scaffold = new THREE.Mesh(
                this.cache.scaffold(
                    def.size.w,
                    def.size.h,
                    targetHeight + 0.08,
                ),
                this.materials.buckets.matte,
            );

            growing.name = 'growing';
            scaffold.castShadow = true;
            group.add(growing, scaffold);
            group.position.set(building.x, base, building.y);
            entry.individual = group;
            this.individualGroup.add(group);
        }
    }

    private levelHeight(def: BuildingDef, level: number): number {
        const parts = this.game.content.level(def, level).model?.parts ?? [];
        let top = 0.2;

        for (const part of parts) {
            const z = 'z' in part && typeof part.z === 'number' ? part.z : 0;
            const h =
                'h' in part && typeof part.h === 'number'
                    ? part.h
                    : part.kind === 'floors'
                      ? part.floors * part.floorHeight
                      : 0;

            top = Math.max(top, z + h);
        }

        return top;
    }

    private detach(entry: BuildingEntry): void {
        if (entry.complete) {
            this.dirtyChunks.add(entry.chunk);
        }

        if (entry.animatedGroup) {
            this.animatedGroup.remove(entry.animatedGroup);
        }

        if (entry.individual) {
            this.individualGroup.remove(entry.individual);
        }

        this.cache.release(entry.cacheKey);
    }

    private remove(uid: number): void {
        const entry = this.entries.get(uid);

        if (!entry) {
            return;
        }

        this.detach(entry);
        this.entries.delete(uid);
        this.structureRevision++;
        this.revision++;
        this.shadowsDirty = true;
    }

    /** Re-seats everything on new base heights (after the ground changed). */
    refreshBases(): void {
        for (const entry of this.entries.values()) {
            entry.signature = '';
        }
    }

    /** Per frame: construction growth, moving parts, chunk rebuilds. */
    update(time: number, night: number): void {
        const game = this.game;

        for (const entry of this.entries.values()) {
            if (entry.individual) {
                const building = entry.building;
                const span = Math.max(
                    0.001,
                    building.buildEnd - building.buildStart,
                );
                const progress = Math.max(
                    0,
                    Math.min(1, (game.state.time - building.buildStart) / span),
                );
                const growing = entry.individual.getObjectByName('growing');

                if (growing && !entry.upgrading) {
                    growing.scale.y = 0.06 + 0.94 * progress;
                }
            }

            for (const instance of entry.animated) {
                instance.update(time, night);
            }
        }

        for (const chunk of this.dirtyChunks) {
            this.rebuildChunk(chunk);
        }

        this.dirtyChunks.clear();

        if (this.shadowsDirty) {
            this.shadowsDirty = false;
            this.rebuildShadows();
        }
    }

    /** Construction progress of a building (0..1), or null when complete. */
    progressOf(entry: BuildingEntry): number | null {
        if (entry.complete) {
            return null;
        }

        const building = entry.building;
        const span = Math.max(0.001, building.buildEnd - building.buildStart);

        return Math.max(
            0,
            Math.min(1, (this.game.state.time - building.buildStart) / span),
        );
    }

    private rebuildChunk(chunk: number): void {
        const old = this.chunks.get(chunk);

        if (old) {
            for (const mesh of old) {
                this.chunkGroup.remove(mesh);
                mesh.geometry.dispose();
            }
        }

        const items = new Map<
            Bucket,
            {
                geometry: THREE.BufferGeometry;
                x: number;
                y: number;
                z: number;
            }[]
        >();

        for (const entry of this.entries.values()) {
            if (entry.chunk !== chunk || !entry.complete) {
                continue;
            }

            for (const bucket of BUCKETS) {
                const geometry = entry.model.buckets[bucket];

                if (geometry) {
                    let list = items.get(bucket);

                    if (!list) {
                        list = [];
                        items.set(bucket, list);
                    }

                    list.push({
                        geometry,
                        x: entry.building.x,
                        y: entry.base,
                        z: entry.building.y,
                    });
                }
            }
        }

        const meshes: THREE.Mesh[] = [];

        for (const [bucket, list] of items) {
            const geometry = mergeTranslated(list);

            if (!geometry) {
                continue;
            }

            const mesh = new THREE.Mesh(
                geometry,
                this.materials.buckets[bucket],
            );

            mesh.castShadow = bucket !== 'glow' && bucket !== 'windows';
            mesh.receiveShadow = true;
            mesh.matrixAutoUpdate = false;
            meshes.push(mesh);
            this.chunkGroup.add(mesh);
        }

        if (meshes.length) {
            this.chunks.set(chunk, meshes);
        } else {
            this.chunks.delete(chunk);
        }
    }

    private rebuildShadows(): void {
        if (this.shadows) {
            this.group.remove(this.shadows);
            this.shadows.dispose();
            this.shadows = null;
        }

        if (!this.entries.size) {
            return;
        }

        const mesh = new THREE.InstancedMesh(
            this.shadowGeometry,
            this.shadowMaterial,
            this.entries.size,
        );
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();
        const rotation = new THREE.Quaternion();
        let i = 0;

        for (const entry of this.entries.values()) {
            const { w, h } = entry.def.size;
            const bounds = entry.model.bounds;
            const bw = Math.min(w + 0.4, bounds.max.x - bounds.min.x + 0.45);
            const bd = Math.min(h + 0.4, bounds.max.z - bounds.min.z + 0.45);

            position.set(
                entry.building.x + (bounds.min.x + bounds.max.x) / 2,
                entry.base + 0.012,
                entry.building.y + (bounds.min.z + bounds.max.z) / 2,
            );
            scale.set(Math.max(0.4, bw), 1, Math.max(0.4, bd));
            matrix.compose(position, rotation, scale);
            mesh.setMatrixAt(i++, matrix);
        }

        mesh.renderOrder = 1;
        mesh.computeBoundingSphere();
        this.shadows = mesh;
        this.group.add(mesh);
    }

    /** Emitters (world) of complete buildings, with the building they belong to. */
    *emitters(): Generator<{
        entry: BuildingEntry;
        position: THREE.Vector3;
        type: string;
    }> {
        const position = new THREE.Vector3();

        for (const entry of this.entries.values()) {
            if (!entry.complete) {
                continue;
            }

            for (const emitter of entry.model.emitters) {
                position.set(
                    entry.building.x + emitter.position.x,
                    entry.base + emitter.position.y,
                    entry.building.y + emitter.position.z,
                );
                yield { entry, position, type: emitter.type };
            }
        }
    }

    dispose(): void {
        for (const entry of this.entries.values()) {
            this.detach(entry);
        }

        this.entries.clear();

        for (const meshes of this.chunks.values()) {
            for (const mesh of meshes) {
                mesh.geometry.dispose();
            }
        }

        this.chunks.clear();
        this.shadows?.dispose();
        this.shadowGeometry.dispose();
        this.shadowMaterial.dispose();
        this.shadowTexture.dispose();
    }
}
