/**
 * Residents walking about (small instanced figures coloured by their NPC
 * type) and traffic (carts, cars, buses, hover cars and drones) driving
 * along the roads, with headlights at night.
 */

import * as THREE from 'three';
import type { NpcTypeDef } from '../engine/content/types';
import type { Game } from '../engine/sim/game';
import type { Vehicle } from '../engine/sim/npcs';
import type { NpcState } from '../engine/sim/state';
import { color, hash3 } from './colors';
import type { GlowLayer } from './fx';
import type { Terrain } from './terrain';

const PERSON_SCALE = 1.25;

type VehicleKind = NonNullable<NpcTypeDef['vehicle']>;

/** Geometry with a flat vertex colour per part, merged. */
function build(
    parts: { geometry: THREE.BufferGeometry; color: string }[],
): THREE.BufferGeometry {
    const geometries = parts.map(({ geometry, color: css }) => {
        const g = geometry.index ? geometry.toNonIndexed() : geometry;
        const c = color(css);
        const count = g.getAttribute('position').count;
        const colors = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
        }

        g.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        if (g.hasAttribute('uv')) {
            g.deleteAttribute('uv');
        }

        return g;
    });
    const total = geometries.reduce(
        (sum, g) => sum + g.getAttribute('position').count,
        0,
    );
    const merged = new THREE.BufferGeometry();

    for (const name of ['position', 'normal', 'color']) {
        const array = new Float32Array(total * 3);
        let offset = 0;

        for (const g of geometries) {
            const source = g.getAttribute(name).array as Float32Array;

            array.set(source, offset);
            offset += source.length;
        }

        merged.setAttribute(name, new THREE.BufferAttribute(array, 3));
    }

    geometries.forEach((g) => g.dispose());
    merged.computeBoundingSphere();

    return merged;
}

function box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
): THREE.BufferGeometry {
    return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

function wheel(x: number, z: number, r: number): THREE.BufferGeometry {
    return new THREE.CylinderGeometry(r, r, 0.02, 8)
        .rotateX(Math.PI / 2)
        .translate(x, r, z);
}

/** Vehicle geometries, length along +X: body (tinted per vehicle) and details. */
function vehicleGeometry(kind: VehicleKind): {
    body: THREE.BufferGeometry;
    detail: THREE.BufferGeometry;
    length: number;
    lift: number;
} {
    switch (kind) {
        case 'cart':
            return {
                body: build([
                    {
                        geometry: box(0.2, 0.05, 0.12, -0.03, 0.07, 0),
                        color: '#ffffff',
                    },
                    {
                        geometry: box(0.2, 0.04, 0.012, -0.03, 0.11, 0.055),
                        color: '#ffffff',
                    },
                    {
                        geometry: box(0.2, 0.04, 0.012, -0.03, 0.11, -0.055),
                        color: '#ffffff',
                    },
                ]),
                detail: build([
                    { geometry: wheel(-0.03, 0.068, 0.045), color: '#4a3220' },
                    { geometry: wheel(-0.03, -0.068, 0.045), color: '#4a3220' },
                    {
                        geometry: box(0.1, 0.07, 0.045, 0.14, 0.09, 0),
                        color: '#7a5a3a',
                    },
                    {
                        geometry: box(0.04, 0.05, 0.035, 0.2, 0.14, 0),
                        color: '#6a4a2a',
                    },
                    {
                        geometry: box(0.015, 0.06, 0.015, 0.12, 0.03, 0.015),
                        color: '#5a3a1a',
                    },
                    {
                        geometry: box(0.015, 0.06, 0.015, 0.17, 0.03, -0.015),
                        color: '#5a3a1a',
                    },
                ]),
                length: 0.3,
                lift: 0,
            };

        case 'bus':
            return {
                body: build([
                    {
                        geometry: box(0.46, 0.13, 0.14, 0, 0.1, 0),
                        color: '#ffffff',
                    },
                ]),
                detail: build([
                    {
                        geometry: box(0.4, 0.04, 0.142, 0, 0.13, 0),
                        color: '#26323d',
                    },
                    {
                        geometry: box(0.005, 0.05, 0.12, 0.231, 0.12, 0),
                        color: '#26323d',
                    },
                    { geometry: wheel(0.15, 0.06, 0.03), color: '#1c1c1c' },
                    { geometry: wheel(0.15, -0.06, 0.03), color: '#1c1c1c' },
                    { geometry: wheel(-0.15, 0.06, 0.03), color: '#1c1c1c' },
                    { geometry: wheel(-0.15, -0.06, 0.03), color: '#1c1c1c' },
                ]),
                length: 0.46,
                lift: 0,
            };

        case 'drone':
            return {
                body: build([
                    {
                        geometry: box(0.07, 0.025, 0.07, 0, 0, 0),
                        color: '#ffffff',
                    },
                    {
                        geometry: box(0.16, 0.01, 0.015, 0, 0, 0).rotateY(
                            Math.PI / 4,
                        ),
                        color: '#ffffff',
                    },
                    {
                        geometry: box(0.16, 0.01, 0.015, 0, 0, 0).rotateY(
                            -Math.PI / 4,
                        ),
                        color: '#ffffff',
                    },
                ]),
                detail: build(
                    [
                        [0.057, 0.057],
                        [-0.057, 0.057],
                        [0.057, -0.057],
                        [-0.057, -0.057],
                    ].map(([x, z]) => ({
                        geometry: new THREE.CylinderGeometry(
                            0.03,
                            0.03,
                            0.004,
                            10,
                        ).translate(x, 0.012, z),
                        color: '#2a2a2a',
                    })),
                ),
                length: 0.16,
                lift: 1.1,
            };

        case 'hover':
            return {
                body: build([
                    {
                        geometry: box(0.26, 0.05, 0.12, 0, 0.03, 0),
                        color: '#ffffff',
                    },
                    {
                        geometry: new THREE.SphereGeometry(
                            0.06,
                            10,
                            6,
                            0,
                            Math.PI * 2,
                            0,
                            Math.PI / 2,
                        )
                            .scale(1.4, 0.8, 0.9)
                            .translate(-0.01, 0.055, 0),
                        color: '#ffffff',
                    },
                ]),
                detail: build([
                    {
                        geometry: box(0.1, 0.02, 0.1, 0, -0.005, 0),
                        color: '#35e0d0',
                    },
                    {
                        geometry: box(0.08, 0.03, 0.125, 0.02, 0.07, 0),
                        color: '#1d2a36',
                    },
                ]),
                length: 0.26,
                lift: 0.22,
            };

        default:
            return {
                body: build([
                    {
                        geometry: box(0.26, 0.055, 0.12, 0, 0.055, 0),
                        color: '#ffffff',
                    },
                    {
                        geometry: box(0.13, 0.05, 0.11, -0.02, 0.105, 0),
                        color: '#ffffff',
                    },
                ]),
                detail: build([
                    {
                        geometry: box(0.135, 0.035, 0.112, -0.02, 0.105, 0),
                        color: '#26323d',
                    },
                    { geometry: wheel(0.08, 0.055, 0.026), color: '#1c1c1c' },
                    { geometry: wheel(0.08, -0.055, 0.026), color: '#1c1c1c' },
                    { geometry: wheel(-0.08, 0.055, 0.026), color: '#1c1c1c' },
                    { geometry: wheel(-0.08, -0.055, 0.026), color: '#1c1c1c' },
                ]),
                length: 0.26,
                lift: 0,
            };
    }
}

class Pool {
    mesh: THREE.InstancedMesh;

    constructor(
        private group: THREE.Group,
        readonly geometry: THREE.BufferGeometry,
        private material: THREE.Material,
        private tinted: boolean,
        capacity = 32,
    ) {
        this.mesh = this.create(capacity);
    }

    private create(capacity: number): THREE.InstancedMesh {
        const mesh = new THREE.InstancedMesh(
            this.geometry,
            this.material,
            capacity,
        );

        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        if (this.tinted) {
            mesh.setColorAt(0, new THREE.Color(1, 1, 1));
            mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
        }

        mesh.castShadow = true;
        mesh.frustumCulled = false;
        mesh.count = 0;
        this.group.add(mesh);

        return mesh;
    }

    ensure(count: number): void {
        if (count > this.mesh.instanceMatrix.count) {
            this.group.remove(this.mesh);
            this.mesh.dispose();
            this.mesh = this.create(
                Math.max(count, this.mesh.instanceMatrix.count * 2),
            );
        }
    }

    finish(count: number): void {
        this.mesh.count = count;
        this.mesh.instanceMatrix.needsUpdate = true;

        if (this.mesh.instanceColor) {
            this.mesh.instanceColor.needsUpdate = true;
        }
    }

    dispose(): void {
        this.mesh.dispose();
        this.geometry.dispose();
    }
}

interface Track {
    x: number;
    y: number;
    heading: number;
    phase: number;
}

export class People {
    readonly group = new THREE.Group();

    private material: THREE.MeshStandardMaterial;
    private glowMaterial: THREE.MeshBasicMaterial;
    private bodies: Pool;
    private heads: Pool;
    private hats: Pool;
    private halos: Pool;
    private vehicles = new Map<
        VehicleKind,
        { body: Pool; detail: Pool; length: number; lift: number }
    >();
    private tracks = new Map<number, Track>();
    private matrix = new THREE.Matrix4();
    private quaternion = new THREE.Quaternion();
    private scale = new THREE.Vector3();
    private position = new THREE.Vector3();
    private up = new THREE.Vector3(0, 1, 0);
    private scratch = new THREE.Color();
    /** World positions of the residents drawn last frame, by uid. */
    readonly drawn = new Map<number, THREE.Vector3>();

    constructor(
        private game: Game,
        private terrain: Terrain,
    ) {
        this.material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.7,
        });
        this.glowMaterial = new THREE.MeshBasicMaterial({
            vertexColors: true,
            toneMapped: false,
            transparent: true,
            opacity: 0.8,
        });

        const s = PERSON_SCALE;

        this.bodies = new Pool(
            this.group,
            build([
                {
                    geometry: new THREE.CylinderGeometry(
                        0.024 * s,
                        0.03 * s,
                        0.07 * s,
                        7,
                    ).translate(0, 0.07 * s, 0),
                    color: '#ffffff',
                },
                {
                    geometry: box(
                        0.014 * s,
                        0.04 * s,
                        0.014 * s,
                        0.01 * s,
                        0.02 * s,
                        0.008 * s,
                    ),
                    color: '#3a3a40',
                },
                {
                    geometry: box(
                        0.014 * s,
                        0.04 * s,
                        0.014 * s,
                        -0.01 * s,
                        0.02 * s,
                        -0.008 * s,
                    ),
                    color: '#3a3a40',
                },
            ]),
            this.material,
            true,
        );
        this.heads = new Pool(
            this.group,
            build([
                {
                    geometry: new THREE.SphereGeometry(
                        0.022 * s,
                        8,
                        6,
                    ).translate(0, 0.125 * s, 0),
                    color: '#ffffff',
                },
            ]),
            this.material,
            true,
        );
        this.hats = new Pool(
            this.group,
            build([
                {
                    geometry: new THREE.CylinderGeometry(
                        0.018 * s,
                        0.022 * s,
                        0.018 * s,
                        8,
                    ).translate(0, 0.148 * s, 0),
                    color: '#ffffff',
                },
                {
                    geometry: new THREE.CylinderGeometry(
                        0.034 * s,
                        0.034 * s,
                        0.004 * s,
                        10,
                    ).translate(0, 0.14 * s, 0),
                    color: '#ffffff',
                },
            ]),
            this.material,
            true,
        );
        this.halos = new Pool(
            this.group,
            build([
                {
                    geometry: new THREE.TorusGeometry(
                        0.045 * s,
                        0.005 * s,
                        4,
                        16,
                    )
                        .rotateX(Math.PI / 2)
                        .translate(0, 0.01, 0),
                    color: '#ffffff',
                },
            ]),
            this.glowMaterial,
            true,
        );
        this.halos.mesh.castShadow = false;
    }

    private vehicle(kind: VehicleKind) {
        let entry = this.vehicles.get(kind);

        if (!entry) {
            const geometry = vehicleGeometry(kind);

            entry = {
                body: new Pool(
                    this.group,
                    geometry.body,
                    this.material,
                    true,
                    16,
                ),
                detail: new Pool(
                    this.group,
                    geometry.detail,
                    this.material,
                    false,
                    16,
                ),
                length: geometry.length,
                lift: geometry.lift,
            };
            this.vehicles.set(kind, entry);
        }

        return entry;
    }

    /** Positions every visible resident and vehicle; adds headlights to `glow`. */
    update(dt: number, time: number, night: number, glow: GlowLayer): void {
        const game = this.game;
        const residents = game.npcs.residents;
        let count = 0;
        let hats = 0;
        let halos = 0;

        this.drawn.clear();
        this.bodies.ensure(residents.length);
        this.heads.ensure(residents.length);
        this.hats.ensure(residents.length);
        this.halos.ensure(residents.length);

        const seen = new Set<number>();

        for (const npc of residents) {
            if (!game.npcs.isVisible(npc)) {
                continue;
            }

            const type = game.npcs.typeOf(npc);
            const track = this.track(npc, dt);
            const moving = npc.activity === 'walking';
            const bob = moving
                ? Math.abs(Math.sin(time * 9 + track.phase)) * 0.012
                : 0;
            const h = this.terrain.surfaceAt(npc.x, npc.y) + bob;

            seen.add(npc.uid);
            this.position.set(npc.x, h, npc.y);
            this.drawn.set(npc.uid, this.position.clone());
            this.quaternion.setFromAxisAngle(this.up, track.heading);
            this.scale.set(1, 1, 1);
            this.matrix.compose(this.position, this.quaternion, this.scale);

            const body = type.body?.length
                ? type.body[Math.floor(hash3(npc.uid, 1, 3) * type.body.length)]
                : '#888888';
            const skins = type.skin?.length ? type.skin : ['#f1c9a0'];
            const skin = skins[Math.floor(hash3(npc.uid, 2, 3) * skins.length)];

            this.bodies.mesh.setMatrixAt(count, this.matrix);
            this.bodies.mesh.setColorAt(count, this.scratch.copy(color(body)));
            this.heads.mesh.setMatrixAt(count, this.matrix);
            this.heads.mesh.setColorAt(count, this.scratch.copy(color(skin)));

            if (type.hat) {
                this.hats.mesh.setMatrixAt(hats, this.matrix);
                this.hats.mesh.setColorAt(
                    hats,
                    this.scratch.copy(color(type.hat)),
                );
                hats++;
            }

            if (type.glow) {
                this.halos.mesh.setMatrixAt(halos, this.matrix);
                this.halos.mesh.setColorAt(
                    halos,
                    this.scratch
                        .copy(color(type.glow))
                        .multiplyScalar(1 + night),
                );
                halos++;

                if (night > 0.2) {
                    glow.addXYZ(
                        npc.x,
                        h + 0.1,
                        npc.y,
                        0.35,
                        color(type.glow),
                        0.5 * night,
                    );
                }
            }

            count++;
        }

        for (const uid of this.tracks.keys()) {
            if (!seen.has(uid)) {
                this.tracks.delete(uid);
            }
        }

        this.bodies.finish(count);
        this.heads.finish(count);
        this.hats.finish(hats);
        this.halos.finish(halos);
        this.updateVehicles(time, night, glow);
    }

    private track(npc: NpcState, dt: number): Track {
        let track = this.tracks.get(npc.uid);

        if (!track) {
            track = {
                x: npc.x,
                y: npc.y,
                heading: hash3(npc.uid, 4, 4) * Math.PI * 2,
                phase: hash3(npc.uid, 5, 5) * 6,
            };
            this.tracks.set(npc.uid, track);
        }

        const dx = npc.x - track.x;
        const dy = npc.y - track.y;

        if (dx * dx + dy * dy > 1e-6) {
            // Local +Z of the figure faces the walking direction.
            const target = Math.atan2(dx, dy);
            let delta = target - track.heading;

            delta = Math.atan2(Math.sin(delta), Math.cos(delta));
            track.heading += delta * Math.min(1, dt * 12);
        }

        track.x = npc.x;
        track.y = npc.y;

        return track;
    }

    private updateVehicles(time: number, night: number, glow: GlowLayer): void {
        const counts = new Map<VehicleKind, number>();
        const list = this.game.npcs.vehicles;
        const headlight = color('#fff2c4');
        const tail = color('#ff3a2a');

        for (const entry of this.vehicles.values()) {
            entry.body.ensure(list.length);
            entry.detail.ensure(list.length);
        }

        list.forEach((v: Vehicle, i: number) => {
            const kind: VehicleKind = v.type.vehicle ?? 'car';
            const entry = this.vehicle(kind);

            entry.body.ensure(list.length);
            entry.detail.ensure(list.length);

            const n = counts.get(kind) ?? 0;
            const p = Math.min(1, Math.max(0, v.p));
            const x = v.x + (v.nx - v.x) * p + 0.5 + v.px;
            const z = v.y + (v.ny - v.y) * p + 0.5 + v.py;
            let dx = v.nx - v.x;
            let dz = v.ny - v.y;

            if (dx === 0 && dz === 0) {
                dx = 1;
            }

            const length = Math.hypot(dx, dz);

            dx /= length;
            dz /= length;

            const ground = this.terrain.surfaceAt(x, z);
            const hover =
                kind === 'hover'
                    ? Math.sin(time * 2 + i) * 0.02
                    : kind === 'drone'
                      ? Math.sin(time * 1.5 + i) * 0.06
                      : 0;
            const y = ground + 0.02 + entry.lift + hover;

            this.position.set(x, y, z);
            this.quaternion.setFromAxisAngle(this.up, Math.atan2(-dz, dx));
            this.scale.set(1, 1, 1);
            this.matrix.compose(this.position, this.quaternion, this.scale);
            entry.body.mesh.setMatrixAt(n, this.matrix);
            entry.body.mesh.setColorAt(
                n,
                this.scratch.copy(color(v.color || '#cccccc')),
            );
            entry.detail.mesh.setMatrixAt(n, this.matrix);
            counts.set(kind, n + 1);

            if (night > 0.15 && kind !== 'cart') {
                const front = entry.length / 2;
                const sx = -dz * 0.04;
                const sz = dx * 0.04;
                const hy = y + (kind === 'drone' ? 0 : 0.06);

                glow.addXYZ(
                    x + dx * front + sx,
                    hy,
                    z + dz * front + sz,
                    0.16,
                    headlight,
                    night,
                );
                glow.addXYZ(
                    x + dx * front - sx,
                    hy,
                    z + dz * front - sz,
                    0.16,
                    headlight,
                    night,
                );
                glow.addXYZ(
                    x - dx * front,
                    hy,
                    z - dz * front,
                    0.1,
                    tail,
                    night * 0.7,
                );
            } else if (night > 0.15) {
                glow.addXYZ(
                    x + dx * 0.12,
                    y + 0.16,
                    z + dz * 0.12,
                    0.3,
                    color('#ffb45a'),
                    night * 0.6,
                );
            }
        });

        for (const [kind, entry] of this.vehicles) {
            const n = counts.get(kind) ?? 0;

            entry.body.finish(n);
            entry.detail.finish(n);
        }
    }

    /** The resident nearest to a ray (for picking), within `radius` screen-space handled by caller. */
    positionOf(uid: number): THREE.Vector3 | null {
        return this.drawn.get(uid) ?? null;
    }

    dispose(): void {
        this.bodies.dispose();
        this.heads.dispose();
        this.hats.dispose();
        this.halos.dispose();

        for (const entry of this.vehicles.values()) {
            entry.body.dispose();
            entry.detail.dispose();
        }

        this.material.dispose();
        this.glowMaterial.dispose();
    }
}
