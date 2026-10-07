/**
 * Building thumbnails: a model at a level, drawn with its era's palette
 * from a 3/4 view on a transparent background, rendered by ONE shared
 * offscreen WebGL renderer and cached as PNG data URLs.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Content } from '../engine/content/registry';
import type { BuildingDef } from '../engine/content/types';
import { modelGroup } from './buildings';
import { createMaterials } from './materials';
import type { MaterialSet } from './materials';
import { buildModel, createAnimated } from './model';

interface Shared {
    gl: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    materials: MaterialSet;
}

let shared: Shared | null = null;
const cache = new WeakMap<Content, Map<string, string>>();

function setup(): Shared {
    if (shared) {
        return shared;
    }

    const canvas = document.createElement('canvas');
    const gl = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
    });

    gl.setClearColor(0x000000, 0);
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.2;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(gl);

    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;
    pmrem.dispose();

    const sun = new THREE.DirectionalLight(0xfff3df, 2.6);

    sun.position.set(3, 6, 4);
    scene.add(sun, new THREE.HemisphereLight(0xdceaff, 0x8a7a60, 1.1));

    shared = {
        gl,
        scene,
        camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100),
        materials: createMaterials(),
    };

    return shared;
}

/** Cached PNG data URL of a building's model at a level (3/4 view, transparent). */
export function renderThumbnail(
    content: Content,
    def: BuildingDef,
    level: number,
    size = 128,
): string {
    let byContent = cache.get(content);

    if (!byContent) {
        byContent = new Map();
        cache.set(content, byContent);
    }

    const key = `${def.id}:${level}:${size}`;
    const cached = byContent.get(key);

    if (cached) {
        return cached;
    }

    try {
        const url = draw(content, def, level, size);

        byContent.set(key, url);

        return url;
    } catch {
        return '';
    }
}

function draw(
    content: Content,
    def: BuildingDef,
    level: number,
    size: number,
): string {
    const { gl, scene, camera, materials } = setup();
    const levelDef = content.level(def, level);
    const palette = content.levelPalette(levelDef);
    const model = buildModel(levelDef.model?.parts ?? [], palette, {
        wallIndex: 0,
        seed: 0,
        roof: null,
    });
    const group = modelGroup(
        model,
        (bucket) => materials.buckets[bucket],
        false,
    );

    for (const spec of model.animated) {
        const instance = createAnimated(spec, materials, 0.1);

        instance.update(0, 0);
        group.add(instance.object);
    }

    // A soft ground plate under the footprint.
    const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(def.size.w, def.size.h)
            .rotateX(-Math.PI / 2)
            .translate(def.size.w / 2, -0.002, def.size.h / 2),
        new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.12,
            depthWrite: false,
        }),
    );

    group.add(plate);
    scene.add(group);

    // 3/4 view from the south-east, fitted to the model's bounds.
    const bounds = model.bounds
        .clone()
        .union(
            new THREE.Box3(
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(def.size.w, 0.05, def.size.h),
            ),
        );
    const center = bounds.getCenter(new THREE.Vector3());
    const direction = new THREE.Vector3(1, 0.85, 1.25).normalize();
    const radius = bounds.getSize(new THREE.Vector3()).length();

    camera.position.copy(center).addScaledVector(direction, radius * 3 + 5);
    camera.lookAt(center);
    camera.updateMatrixWorld();

    const view = camera.matrixWorldInverse;
    let extent = 0.1;

    for (let i = 0; i < 8; i++) {
        const corner = new THREE.Vector3(
            i & 1 ? bounds.max.x : bounds.min.x,
            i & 2 ? bounds.max.y : bounds.min.y,
            i & 4 ? bounds.max.z : bounds.min.z,
        ).applyMatrix4(view);

        extent = Math.max(extent, Math.abs(corner.x), Math.abs(corner.y));
    }

    extent *= 1.08;
    camera.left = -extent;
    camera.right = extent;
    camera.top = extent;
    camera.bottom = -extent;
    camera.near = 0.01;
    camera.far = radius * 6 + 20;
    camera.updateProjectionMatrix();

    gl.setPixelRatio(1);
    gl.setSize(size, size, false);
    gl.clear();
    gl.render(scene, camera);

    const url = gl.domElement.toDataURL('image/png');

    scene.remove(group);
    plate.geometry.dispose();
    (plate.material as THREE.Material).dispose();
    model.dispose();

    return url;
}
