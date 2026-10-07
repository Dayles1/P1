/**
 * Trees, rocks and reeds on the map's tiles, drawn with instancing: one
 * instanced mesh per kind, positions stable per tile. Rebuilt when a
 * feature is cleared or added (a copy of map.feature is compared).
 */

import * as THREE from 'three';
import type { Game } from '../engine/sim/game';
import { color, hash3 } from './colors';
import type { MaterialSet } from './materials';
import { treeGeometries } from './model';
import type { Terrain } from './terrain';

const TREE = 1;
const ROCK = 2;
const REEDS = 3;

function colorize(
    geometry: THREE.BufferGeometry,
    c: THREE.Color,
): THREE.BufferGeometry {
    const result = geometry.index ? geometry.toNonIndexed() : geometry;
    const count = result.getAttribute('position').count;
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        colors.set([c.r, c.g, c.b], i * 3);
    }

    result.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    result.computeVertexNormals();

    return result;
}

function reedsGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];

    for (let i = 0; i < 7; i++) {
        const h = 0.12 + hash3(i, 3, 1) * 0.1;
        const blade = new THREE.ConeGeometry(0.008, h, 3).toNonIndexed();
        const angle = (i / 7) * Math.PI * 2;
        const r = 0.04 + hash3(i, 4, 1) * 0.05;

        blade.rotateZ((hash3(i, 5, 1) - 0.5) * 0.5);
        blade.translate(Math.cos(angle) * r, h / 2, Math.sin(angle) * r);
        parts.push(colorize(blade, color(i % 3 ? '#7f9a4a' : '#a39a5a')));
    }

    const merged = new THREE.BufferGeometry();
    const total = parts.reduce(
        (sum, g) => sum + g.getAttribute('position').count,
        0,
    );

    for (const name of ['position', 'normal', 'color']) {
        const array = new Float32Array(total * 3);
        let offset = 0;

        for (const part of parts) {
            const source = part.getAttribute(name).array as Float32Array;

            array.set(source, offset);
            offset += source.length;
        }

        merged.setAttribute(name, new THREE.BufferAttribute(array, 3));
    }

    parts.forEach((part) => part.dispose());

    return merged;
}

interface Kind {
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
    mesh: THREE.InstancedMesh | null;
    shadow: boolean;
}

export class Features {
    readonly group = new THREE.Group();

    private copy: Uint8Array;
    private kinds: Record<
        'conifer' | 'leafTrunk' | 'leafCrown' | 'rock' | 'reeds',
        Kind
    >;

    constructor(
        private game: Game,
        private terrain: Terrain,
        materials: MaterialSet,
    ) {
        this.copy = new Uint8Array(game.map.feature.length);
        this.copy.fill(255);

        const conifer = treeGeometries(true);
        const leafy = treeGeometries(false);

        conifer.crown?.dispose();

        const rock = colorize(
            new THREE.DodecahedronGeometry(0.11, 0)
                .scale(1, 0.6, 1)
                .translate(0, 0.03, 0),
            color('#8d8a84'),
        );
        const kind = (
            geometry: THREE.BufferGeometry,
            material: THREE.Material,
            shadow = true,
        ): Kind => ({
            geometry,
            material,
            mesh: null,
            shadow,
        });

        this.kinds = {
            conifer: kind(conifer.trunk, materials.buckets.matte),
            leafTrunk: kind(leafy.trunk, materials.buckets.matte),
            leafCrown: kind(
                leafy.crown ?? new THREE.BufferGeometry(),
                materials.foliage,
            ),
            rock: kind(rock, materials.buckets.matte),
            reeds: kind(reedsGeometry(), materials.buckets.matte, false),
        };
    }

    /** Rebuilds the instances if any feature changed. */
    sync(force = false): boolean {
        const features = this.game.map.feature;
        let changed = force;

        if (!changed) {
            for (let i = 0; i < features.length; i++) {
                if (features[i] !== this.copy[i]) {
                    changed = true;
                    break;
                }
            }
        }

        if (!changed) {
            return false;
        }

        this.copy.set(features);
        this.rebuild();

        return true;
    }

    private rebuild(): void {
        const map = this.game.map;
        const lists: Record<
            keyof Features['kinds'],
            { m: THREE.Matrix4; c: THREE.Color }[]
        > = {
            conifer: [],
            leafTrunk: [],
            leafCrown: [],
            rock: [],
            reeds: [],
        };
        const q = new THREE.Quaternion();
        const up = new THREE.Vector3(0, 1, 0);

        const place = (
            x: number,
            y: number,
            scale: number,
            rotation: number,
            sy = 1,
        ) => {
            q.setFromAxisAngle(up, rotation);

            return new THREE.Matrix4().compose(
                new THREE.Vector3(x, this.terrain.heightAt(x, y) - 0.01, y),
                q,
                new THREE.Vector3(scale, scale * sy, scale),
            );
        };

        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                const i = y * map.width + x;
                const feature = map.feature[i];

                if (!feature) {
                    continue;
                }

                if (feature === TREE) {
                    const biome = map.biomeOfIndex(i).id;
                    const coniferShare =
                        biome.includes('hill') || biome.includes('mountain')
                            ? 0.8
                            : biome.includes('forest')
                              ? 0.45
                              : 0.25;
                    const count =
                        1 +
                        (hash3(x, y, 31) > 0.45 ? 1 : 0) +
                        (hash3(x, y, 32) > 0.75 ? 1 : 0);

                    for (let k = 0; k < count; k++) {
                        const px = x + 0.2 + hash3(x, y, 40 + k) * 0.6;
                        const py = y + 0.2 + hash3(x, y, 50 + k) * 0.6;
                        const scale =
                            (0.75 + hash3(x, y, 60 + k) * 0.55) *
                            (count > 1 ? 0.85 : 1);
                        const m = place(
                            px,
                            py,
                            scale,
                            hash3(x, y, 70 + k) * Math.PI * 2,
                            0.9 + hash3(x, y, 80 + k) * 0.3,
                        );
                        const tone = new THREE.Color().setScalar(
                            0.85 + hash3(x, y, 90 + k) * 0.3,
                        );

                        if (hash3(x, y, 33 + k) < coniferShare) {
                            lists.conifer.push({ m, c: tone });
                        } else {
                            lists.leafTrunk.push({
                                m,
                                c: new THREE.Color(1, 1, 1),
                            });
                            lists.leafCrown.push({ m, c: tone });
                        }
                    }
                } else if (feature === ROCK) {
                    const count = 1 + (hash3(x, y, 34) > 0.5 ? 1 : 0);

                    for (let k = 0; k < count; k++) {
                        const px = x + 0.25 + hash3(x, y, 41 + k) * 0.5;
                        const py = y + 0.25 + hash3(x, y, 51 + k) * 0.5;
                        const scale = 0.7 + hash3(x, y, 61 + k) * 0.9;

                        lists.rock.push({
                            m: place(px, py, scale, hash3(x, y, 71 + k) * 6.28),
                            c: new THREE.Color().setScalar(
                                0.8 + hash3(x, y, 81 + k) * 0.35,
                            ),
                        });
                    }
                } else if (feature === REEDS) {
                    for (let k = 0; k < 2; k++) {
                        const px = x + 0.25 + hash3(x, y, 42 + k) * 0.5;
                        const py = y + 0.25 + hash3(x, y, 52 + k) * 0.5;

                        lists.reeds.push({
                            m: place(
                                px,
                                py,
                                0.9 + hash3(x, y, 62 + k) * 0.5,
                                hash3(x, y, 72 + k) * 6.28,
                            ),
                            c: new THREE.Color().setScalar(
                                0.85 + hash3(x, y, 82 + k) * 0.3,
                            ),
                        });
                    }
                }
            }
        }

        for (const name of Object.keys(
            this.kinds,
        ) as (keyof Features['kinds'])[]) {
            const kind = this.kinds[name];
            const list = lists[name];

            if (kind.mesh) {
                this.group.remove(kind.mesh);
                kind.mesh.dispose();
                kind.mesh = null;
            }

            if (!list.length || !kind.geometry.getAttribute('position')) {
                continue;
            }

            const mesh = new THREE.InstancedMesh(
                kind.geometry,
                kind.material,
                list.length,
            );

            list.forEach(({ m, c }, i) => {
                mesh.setMatrixAt(i, m);
                mesh.setColorAt(i, c);
            });
            mesh.castShadow = kind.shadow;
            mesh.receiveShadow = true;
            mesh.computeBoundingSphere();
            kind.mesh = mesh;
            this.group.add(mesh);
        }
    }

    dispose(): void {
        for (const kind of Object.values(this.kinds)) {
            kind.mesh?.dispose();
            kind.geometry.dispose();
        }
    }
}
