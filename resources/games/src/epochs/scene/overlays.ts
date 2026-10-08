/**
 * What the player works with on top of the world: the hovered tile, the
 * ghost of a building being placed (with its footprint and ranges), the
 * selected building's outline and ranges, the selected resident's ring,
 * a road being dragged and the districts' areas. Each piece is rebuilt
 * only when its inputs change.
 */

import * as THREE from 'three';
import type { BuildingDef, Effects } from '../engine/content/types';
import type { Game } from '../engine/sim/game';
import { featureCode } from '../engine/world/world-map';
import type { BuildingEntry, Buildings } from './buildings';
import { modelGroup } from './buildings';
import { color, hash3, wallsOf } from './colors';
import type { MaterialSet } from './materials';
import { buildModel } from './model';
import type { ModelGeometry } from './model';
import type { People } from './people';
import type { Overlay } from './renderer';
import { WATER_Y } from './terrain';
import type { Terrain } from './terrain';

type RGBA = [number, number, number, number];

function rgba(css: string, alpha: number): RGBA {
    const c = color(css);

    return [c.r, c.g, c.b, alpha];
}

/** Translucent tiles lying on the ground. */
class TileMesh {
    readonly mesh: THREE.Mesh;
    private key = '\u0000';

    constructor(
        private terrain: Terrain,
        group: THREE.Group,
        order: number,
        private lift = 0.045,
    ) {
        this.mesh = new THREE.Mesh(
            new THREE.BufferGeometry(),
            new THREE.MeshBasicMaterial({
                vertexColors: true,
                transparent: true,
                depthWrite: false,
                toneMapped: false,
                polygonOffset: true,
                polygonOffsetFactor: -6,
                polygonOffsetUnits: -6,
            }),
        );
        this.mesh.renderOrder = order;
        this.mesh.frustumCulled = false;
        group.add(this.mesh);
    }

    /** Rebuilds if `key` changed; `fill` lists the tiles. */
    set(key: string, fill: () => { x: number; y: number; c: RGBA }[]): void {
        if (key === this.key) {
            return;
        }

        this.key = key;

        const positions: number[] = [];
        const colors: number[] = [];
        // Over water, tiles lie on its surface (where a bridge would go).
        const h = (x: number, y: number) =>
            Math.max(this.terrain.heightAt(x, y), WATER_Y) + this.lift;

        for (const { x, y, c } of fill()) {
            for (let j = 0; j < 2; j++) {
                for (let i = 0; i < 2; i++) {
                    const x0 = x + i / 2;
                    const y0 = y + j / 2;
                    const x1 = x0 + 0.5;
                    const y1 = y0 + 0.5;
                    const a = [x0, h(x0, y0), y0];
                    const b = [x1, h(x1, y0), y0];
                    const cc = [x0, h(x0, y1), y1];
                    const d = [x1, h(x1, y1), y1];

                    for (const p of [a, cc, b, b, cc, d]) {
                        positions.push(p[0], p[1], p[2]);
                        colors.push(c[0], c[1], c[2], c[3]);
                    }
                }
            }
        }

        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3),
        );
        geometry.setAttribute(
            'color',
            new THREE.Float32BufferAttribute(colors, 4),
        );
        this.mesh.geometry.dispose();
        this.mesh.geometry = geometry;
        this.mesh.visible = positions.length > 0;
    }

    invalidate(): void {
        this.key = '\u0000';
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
    }
}

/** Outlines of tile rectangles on the ground. */
class RectLines {
    readonly lines: THREE.LineSegments;
    private key = '\u0000';

    constructor(
        private terrain: Terrain,
        group: THREE.Group,
    ) {
        this.lines = new THREE.LineSegments(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({
                vertexColors: true,
                transparent: true,
                depthWrite: false,
                toneMapped: false,
            }),
        );
        this.lines.renderOrder = 7;
        this.lines.frustumCulled = false;
        group.add(this.lines);
    }

    set(
        key: string,
        rects: () => {
            x0: number;
            y0: number;
            x1: number;
            y1: number;
            c: RGBA;
        }[],
    ): void {
        if (key === this.key) {
            return;
        }

        this.key = key;

        const positions: number[] = [];
        const colors: number[] = [];
        const lift = 0.06;

        for (const { x0, y0, x1, y1, c } of rects()) {
            const edge = (ax: number, ay: number, bx: number, by: number) => {
                const steps = Math.max(
                    1,
                    Math.round(Math.hypot(bx - ax, by - ay) * 2),
                );

                for (let i = 0; i < steps; i++) {
                    const sx = ax + ((bx - ax) * i) / steps;
                    const sy = ay + ((by - ay) * i) / steps;
                    const ex = ax + ((bx - ax) * (i + 1)) / steps;
                    const ey = ay + ((by - ay) * (i + 1)) / steps;

                    positions.push(
                        sx,
                        this.terrain.heightAt(sx, sy) + lift,
                        sy,
                        ex,
                        this.terrain.heightAt(ex, ey) + lift,
                        ey,
                    );
                    colors.push(...c, ...c);
                }
            };

            edge(x0, y0, x1, y0);
            edge(x1, y0, x1, y1);
            edge(x1, y1, x0, y1);
            edge(x0, y1, x0, y0);
        }

        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3),
        );
        geometry.setAttribute(
            'color',
            new THREE.Float32BufferAttribute(colors, 4),
        );
        this.lines.geometry.dispose();
        this.lines.geometry = geometry;
    }

    invalidate(): void {
        this.key = '\u0000';
    }

    dispose(): void {
        this.lines.geometry.dispose();
        (this.lines.material as THREE.Material).dispose();
    }
}

interface Ranges {
    x: number;
    y: number;
    w: number;
    h: number;
    effects: Effects;
}

export class Overlays {
    readonly group = new THREE.Group();

    private hover: TileMesh;
    private path: TileMesh;
    private ranges: TileMesh;
    private districts: TileMesh;
    private footprint: TileMesh;
    private lines: RectLines;
    private ghost: {
        key: string;
        cacheKey: string;
        group: THREE.Group;
    } | null = null;
    private outline: {
        uid: number;
        signature: string;
        group: THREE.Group;
    } | null = null;
    private ring: THREE.Mesh;

    constructor(
        private game: Game,
        private terrain: Terrain,
        private buildings: Buildings,
        private people: People,
        private materials: MaterialSet,
    ) {
        this.districts = new TileMesh(terrain, this.group, 3, 0.04);
        this.ranges = new TileMesh(terrain, this.group, 4, 0.05);
        this.footprint = new TileMesh(terrain, this.group, 5, 0.055);
        this.path = new TileMesh(terrain, this.group, 5, 0.055);
        this.hover = new TileMesh(terrain, this.group, 6, 0.06);
        this.lines = new RectLines(terrain, this.group);
        this.ring = new THREE.Mesh(
            new THREE.RingGeometry(0.1, 0.135, 28).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({
                color: 0xffd34d,
                transparent: true,
                depthWrite: false,
                toneMapped: false,
            }),
        );
        this.ring.renderOrder = 8;
        this.ring.visible = false;
        this.group.add(this.ring);
    }

    /** The ground changed height: rebuild everything lying on it. */
    invalidate(): void {
        for (const mesh of [
            this.hover,
            this.path,
            this.ranges,
            this.districts,
            this.footprint,
        ]) {
            mesh.invalidate();
        }

        this.lines.invalidate();
    }

    update(overlay: Overlay, time: number): void {
        const game = this.game;

        this.updateHover(overlay);
        this.path.set(
            overlay.roadPath
                .map((t) => `${t.x},${t.y},${t.ok ? 1 : 0}`)
                .join(';'),
            () =>
                overlay.roadPath.map((t) => ({
                    x: t.x,
                    y: t.y,
                    c: t.ok ? rgba('#5adf6a', 0.5) : rgba('#ff4a3a', 0.5),
                })),
        );
        this.updateGhost(overlay);
        this.updateRanges(overlay);
        this.updateOutline(overlay, time);
        this.updateDistricts(overlay);

        const npc =
            overlay.selectedNpc !== null
                ? this.people.positionOf(overlay.selectedNpc)
                : null;

        this.ring.visible = npc !== null;

        if (npc) {
            this.ring.position.set(npc.x, npc.y + 0.02, npc.z);
            this.ring.scale.setScalar(1 + Math.sin(time * 5) * 0.12);
        }

        void game;
    }

    private updateHover(overlay: Overlay): void {
        const hover = overlay.hover;
        const show =
            hover &&
            !overlay.ghost &&
            !overlay.roadPath.length &&
            this.game.map.inBounds(hover.x, hover.y);

        this.hover.set(
            show ? `${hover.x},${hover.y},${overlay.bulldoze ? 1 : 0}` : '',
            () =>
                show
                    ? [
                          {
                              x: hover.x,
                              y: hover.y,
                              c: overlay.bulldoze
                                  ? rgba('#ff3a2a', 0.45)
                                  : rgba('#ffffff', 0.28),
                          },
                      ]
                    : [],
        );
    }

    private ghostLook(ghost: NonNullable<Overlay['ghost']>, def: BuildingDef) {
        const game = this.game;
        const moving = ghost.moving
            ? game.buildings.get(ghost.moving)
            : undefined;

        if (moving) {
            const palette = game.paletteOf(moving);

            return {
                key: `ghost|${game.lookKey(moving)}`,
                parts: game.levelDef(moving).model?.parts ?? [],
                palette,
                roof: game.roofOf(moving),
                wallIndex: Math.floor(
                    game.noise(moving, 7) * wallsOf(palette).length,
                ),
            };
        }

        const level = game.content.level(def, ghost.level || 1);

        return {
            key: `ghost|${def.id}|${level.level}`,
            parts: level.model?.parts ?? [],
            palette: game.content.levelPalette(level),
            roof: null,
            wallIndex: 0,
        };
    }

    private updateGhost(overlay: Overlay): void {
        const game = this.game;
        const ghost = overlay.ghost;
        const def =
            ghost && game.content.hasBuilding(ghost.type)
                ? game.content.building(ghost.type)
                : null;

        if (!ghost || !def) {
            this.clearGhost();
            this.footprint.set('', () => []);

            return;
        }

        const look = this.ghostLook(ghost, def);

        if (!this.ghost || this.ghost.key !== look.key) {
            this.clearGhost();

            const model: ModelGeometry = this.buildings.cache.acquire(
                look.key,
                () =>
                    buildModel(look.parts, look.palette, {
                        wallIndex: look.wallIndex,
                        seed: 0,
                        roof: look.roof,
                    }),
            );
            const group = modelGroup(model, () => this.materials.ghost, false);

            this.ghost = { key: look.key, cacheKey: look.key, group };
            this.group.add(group);
        }

        const { w, h } = def.size;
        const base = this.terrain.baseOf(ghost.x, ghost.y, w, h);

        this.ghost.group.position.set(ghost.x, base + 0.005, ghost.y);
        this.materials.ghost.emissive.set(ghost.ok ? 0x30ff60 : 0xff3020);
        this.materials.ghost.emissiveIntensity = 0.35;
        this.footprint.set(
            `${ghost.x},${ghost.y},${w},${h},${ghost.ok ? 1 : 0}`,
            () => {
                const tiles: { x: number; y: number; c: RGBA }[] = [];

                for (let y = ghost.y; y < ghost.y + h; y++) {
                    for (let x = ghost.x; x < ghost.x + w; x++) {
                        if (game.map.inBounds(x, y)) {
                            tiles.push({
                                x,
                                y,
                                c: ghost.ok
                                    ? rgba('#5adf6a', 0.45)
                                    : rgba('#ff4a3a', 0.5),
                            });
                        }
                    }
                }

                return tiles;
            },
        );
    }

    private clearGhost(): void {
        if (this.ghost) {
            this.group.remove(this.ghost.group);
            this.buildings.cache.release(this.ghost.cacheKey);
            this.ghost = null;
        }
    }

    private updateRanges(overlay: Overlay): void {
        const game = this.game;
        let ranges: Ranges | null = null;
        let key = '';

        if (overlay.ghost && game.content.hasBuilding(overlay.ghost.type)) {
            const def = game.content.building(overlay.ghost.type);
            const g = overlay.ghost;

            ranges = {
                x: g.x,
                y: g.y,
                w: def.size.w,
                h: def.size.h,
                effects: game.content.level(def, g.level || 1).effects,
            };
            key = `g:${g.type}:${g.level}:${g.x}:${g.y}`;
        } else if (overlay.selectedUid !== null) {
            const building = game.buildings.get(overlay.selectedUid);

            if (building && game.def(building).role !== 'road') {
                const def = game.def(building);

                ranges = {
                    x: building.x,
                    y: building.y,
                    w: def.size.w,
                    h: def.size.h,
                    effects: game.effects(building),
                };
                key = `s:${building.uid}:${building.level}:${building.x}:${building.y}`;
            }
        }

        if (ranges?.effects.near) {
            // Features change as they are cleared: include a cheap count.
            const near = ranges.effects.near;

            key += `:${game.countFeatureNear(ranges.x, ranges.y, ranges.w, ranges.h, near.radius, near.feature)}`;
        }

        const r = ranges;

        this.ranges.set(key, () => {
            if (!r) {
                return [];
            }

            const tiles = new Map<number, { x: number; y: number; c: RGBA }>();
            const add = (radius: number, c: RGBA) => {
                for (let y = r.y - radius; y < r.y + r.h + radius; y++) {
                    for (let x = r.x - radius; x < r.x + r.w + radius; x++) {
                        if (game.map.inBounds(x, y)) {
                            const index = game.map.index(x, y);
                            const existing = tiles.get(index);

                            if (existing) {
                                existing.c = [
                                    (existing.c[0] + c[0]) / 2,
                                    (existing.c[1] + c[1]) / 2,
                                    (existing.c[2] + c[2]) / 2,
                                    Math.min(0.4, existing.c[3] + c[3] * 0.5),
                                ];
                            } else {
                                tiles.set(index, { x, y, c: [...c] as RGBA });
                            }
                        }
                    }
                }
            };
            const e = r.effects;

            if (e.aura) {
                add(e.aura.radius, rgba('#4da3ff', 0.16));
            }

            if (e.boost) {
                add(e.boost.radius, rgba('#ffd34d', 0.16));
            }

            if (e.pollution) {
                add(e.pollution.radius, rgba('#8a5a2b', 0.2));
            }

            if (e.near) {
                const code = featureCode(e.near.feature);

                for (const [x, y] of game.around(
                    r.x,
                    r.y,
                    r.w,
                    r.h,
                    e.near.radius,
                )) {
                    const index = game.map.index(x, y);

                    tiles.set(index, {
                        x,
                        y,
                        c:
                            game.map.feature[index] === code
                                ? rgba('#5adf6a', 0.45)
                                : rgba('#5adf6a', 0.08),
                    });
                }
            }

            return [...tiles.values()];
        });

        this.lines.set(key, () => {
            if (!r) {
                return [];
            }

            const rects: {
                x0: number;
                y0: number;
                x1: number;
                y1: number;
                c: RGBA;
            }[] = [];
            const e = r.effects;
            const rect = (radius: number, c: RGBA) =>
                rects.push({
                    x0: r.x - radius,
                    y0: r.y - radius,
                    x1: r.x + r.w + radius,
                    y1: r.y + r.h + radius,
                    c,
                });

            if (e.aura) {
                rect(e.aura.radius, rgba('#4da3ff', 0.9));
            }

            if (e.boost) {
                rect(e.boost.radius, rgba('#ffd34d', 0.9));
            }

            if (e.pollution) {
                rect(e.pollution.radius, rgba('#a0703a', 0.9));
            }

            if (e.near) {
                rect(e.near.radius, rgba('#5adf6a', 0.9));
            }

            return rects;
        });
    }

    private updateOutline(overlay: Overlay, time: number): void {
        const entry: BuildingEntry | undefined =
            overlay.selectedUid !== null
                ? this.buildings.entries.get(overlay.selectedUid)
                : undefined;

        if (!entry) {
            this.clearOutline();

            return;
        }

        if (
            !this.outline ||
            this.outline.uid !== entry.uid ||
            this.outline.signature !== entry.signature
        ) {
            this.clearOutline();

            const inner = new THREE.Group();

            for (const bucket of [
                'matte',
                'metal',
                'glass',
                'foliage',
            ] as const) {
                const geometry = entry.model.buckets[bucket];

                if (geometry) {
                    inner.add(new THREE.Mesh(geometry, this.materials.outline));
                }
            }

            const bounds = entry.model.bounds;
            const cx = (bounds.min.x + bounds.max.x) / 2;
            const cz = (bounds.min.z + bounds.max.z) / 2;
            const size = Math.max(
                0.3,
                bounds.max.x - bounds.min.x,
                bounds.max.z - bounds.min.z,
            );
            const grow = 1 + 0.05 / size;
            const group = new THREE.Group();

            inner.position.set(-cx, 0, -cz);
            group.add(inner);
            group.position.set(
                entry.building.x + cx,
                entry.base - 0.01,
                entry.building.y + cz,
            );
            group.scale.set(
                grow,
                1 + 0.03 / Math.max(0.3, entry.model.height),
                grow,
            );
            group.renderOrder = 9;
            this.outline = {
                uid: entry.uid,
                signature: entry.signature,
                group,
            };
            this.group.add(group);
        }

        this.materials.outline.opacity = 0.6 + Math.sin(time * 4) * 0.25;
    }

    private clearOutline(): void {
        if (this.outline) {
            this.group.remove(this.outline.group);
            this.outline = null;
        }
    }

    private updateDistricts(overlay: Overlay): void {
        const game = this.game;

        if (!overlay.showDistricts) {
            this.districts.set('', () => []);

            return;
        }

        const halls = game
            .districtHalls()
            .filter((hall) => game.isComplete(hall));
        const key = `d:${halls.map((h) => `${h.uid}@${h.x},${h.y}`).join(';')}`;

        this.districts.set(key, () => {
            const tiles: { x: number; y: number; c: RGBA }[] = [];
            const colors = new Map<number, RGBA>();

            for (const hall of halls) {
                const c = new THREE.Color().setHSL(
                    hash3(hall.uid, 17, 3),
                    0.75,
                    0.55,
                );

                colors.set(hall.uid, [c.r, c.g, c.b, 0.26]);
            }

            for (let y = 0; y < game.map.height; y++) {
                for (let x = 0; x < game.map.width; x++) {
                    const hall = game.districtAt(x, y);

                    if (hall) {
                        tiles.push({
                            x,
                            y,
                            c: colors.get(hall.uid) ?? rgba('#ffffff', 0.2),
                        });
                    }
                }
            }

            return tiles;
        });
    }

    dispose(): void {
        this.clearGhost();
        this.clearOutline();

        for (const mesh of [
            this.hover,
            this.path,
            this.ranges,
            this.districts,
            this.footprint,
        ]) {
            mesh.dispose();
        }

        this.lines.dispose();
        this.ring.geometry.dispose();
        (this.ring.material as THREE.Material).dispose();
    }
}
