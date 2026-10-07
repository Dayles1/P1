/**
 * Draws the city onto a canvas: the land, roads, trees and rocks,
 * buildings (sorted back to front), people and vehicles walking the
 * roads, smoke, construction dust and floating texts, plus the overlays
 * the player works with (placement ghost, selection, ranges).
 */

import { BUILDING } from '../engine/data';
import type { BuildingDef } from '../engine/data';
import {
    FOREST,
    MAP_SIZE,
    ROCK,
    TERRAIN_CODE,
    WATER,
    inMap,
    tileHash,
} from '../engine/map';
import type { Building, City, CityEvent } from '../engine/sim';
import { drawBuilding, rock, tree } from './buildings';
import { HH, HW, P, box, line, poly, rect, shade, tile } from './iso';
import type { Ctx, Point } from './iso';
import { STYLES } from './style';

export interface Overlay {
    hover: { x: number; y: number } | null;
    ghost: {
        type: string;
        x: number;
        y: number;
        ok: boolean;
        moving?: number;
    } | null;
    roadPath: { x: number; y: number; ok: boolean }[];
    selectedId: number | null;
    bulldoze: boolean;
}

interface Walker {
    x: number;
    y: number;
    nx: number;
    ny: number;
    px: number;
    py: number;
    p: number;
    speed: number;
    kind: 'person' | 'cart' | 'car';
    color: string;
    lane: number;
}

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
    color: string;
    kind: 'smoke' | 'dust' | 'spark' | 'confetti';
}

interface FloatText {
    x: number;
    y: number;
    z: number;
    text: string;
    color: string;
    life: number;
}

const CLOTHES = [
    ['#7a4b2a', '#5b6e3a', '#8a7a5a', '#6a3d2a'],
    ['#7a4b2a', '#5b6e3a', '#8a7a5a', '#4a5f7a'],
    ['#8b2f2f', '#2f4f8b', '#5b6e3a', '#7a5a2a'],
    ['#7a2e8e', '#8b2f2f', '#2f4f8b', '#c49a2a'],
    ['#1f6f5c', '#8b2f2f', '#2f2f4f', '#c4a36a'],
    ['#2f4f8b', '#9c4a5a', '#3a6a4a', '#c4a36a'],
    ['#2f2f35', '#4a4a55', '#5a3a2a', '#6a6a72'],
    ['#2a5fbf', '#c43a3a', '#3a3a3a', '#e0b030'],
    ['#11a39a', '#ff6a3a', '#3a3a5a', '#f5d14a'],
];

const CARS = ['#d64545', '#3f7fd6', '#e0a530', '#f2f2f2', '#3a3a3a', '#4aa35a'];

export class Renderer {
    canvas: HTMLCanvasElement;
    ctx: Ctx;
    city: City | null = null;
    camera = { x: 0, y: 0, zoom: 1 };
    width = 0;
    height = 0;
    dpr = 1;

    private time = 0;
    private walkers: Walker[] = [];
    private particles: Particle[] = [];
    private floats: FloatText[] = [];
    private emitters: {
        x: number;
        y: number;
        z: number;
        kind: 'smoke' | 'steam';
    }[] = [];
    private flash = 0;
    private shore = new Uint8Array(MAP_SIZE * MAP_SIZE);
    private shoreRevision = -1;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
    }

    setCity(city: City): void {
        this.city = city;
        this.walkers = [];
        this.shoreRevision = -1;
    }

    resize(): void {
        const rectBox = this.canvas.getBoundingClientRect();

        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.width = rectBox.width;
        this.height = rectBox.height;
        this.canvas.width = Math.round(rectBox.width * this.dpr);
        this.canvas.height = Math.round(rectBox.height * this.dpr);
    }

    centerOn(x: number, y: number): void {
        const [sx, sy] = P(x, y);

        this.camera.x = this.width / 2 - sx * this.camera.zoom;
        this.camera.y = this.height / 2 - sy * this.camera.zoom;
    }

    zoomAt(factor: number, px = this.width / 2, py = this.height / 2): void {
        const zoom = Math.min(2.6, Math.max(0.35, this.camera.zoom * factor));
        const ratio = zoom / this.camera.zoom;

        this.camera.x = px - (px - this.camera.x) * ratio;
        this.camera.y = py - (py - this.camera.y) * ratio;
        this.camera.zoom = zoom;
    }

    pan(dx: number, dy: number): void {
        this.camera.x += dx;
        this.camera.y += dy;
        this.clampCamera();
    }

    /** Keeps at least part of the map on screen. */
    clampCamera(): void {
        const z = this.camera.zoom;
        const left = P(0, MAP_SIZE)[0] * z;
        const right = P(MAP_SIZE, 0)[0] * z;
        const bottom = P(MAP_SIZE, MAP_SIZE)[1] * z;

        this.camera.x = Math.min(
            this.width - left - 200,
            Math.max(-right + 200, this.camera.x),
        );
        this.camera.y = Math.min(
            this.height - 200,
            Math.max(-bottom + 200, this.camera.y),
        );
    }

    /** Fractional tile coordinates under a point of the canvas (CSS px). */
    screenToWorld(px: number, py: number): { x: number; y: number } {
        const sx = (px - this.camera.x) / this.camera.zoom;
        const sy = (py - this.camera.y) / this.camera.zoom;

        return { x: (sx / HW + sy / HH) / 2, y: (sy / HH - sx / HW) / 2 };
    }

    worldToScreen(x: number, y: number, z = 0): Point {
        const [sx, sy] = P(x, y, z);

        return [
            sx * this.camera.zoom + this.camera.x,
            sy * this.camera.zoom + this.camera.y,
        ];
    }

    /** The building drawn under a point, tall ones included. */
    pickBuilding(px: number, py: number): Building | null {
        const city = this.city;

        if (!city) {
            return null;
        }

        const sx = (px - this.camera.x) / this.camera.zoom;
        const sy = (py - this.camera.y) / this.camera.zoom;
        const candidates = city.state.buildings
            .filter((b) => b.type !== 'road')
            .sort((a, b) => depth(b) - depth(a));

        for (const building of candidates) {
            const def = BUILDING[building.type];
            const s = def.size;
            const h = estimateHeight(building, def);
            const hull = [
                P(building.x, building.y + s, 0),
                P(building.x + s, building.y + s, 0),
                P(building.x + s, building.y, 0),
                P(building.x + s, building.y, h),
                P(building.x, building.y, h),
                P(building.x, building.y + s, h),
            ];

            if (inside(hull, sx, sy)) {
                return building;
            }
        }

        const { x, y } = this.screenToWorld(px, py);

        return city.buildingAt(Math.floor(x), Math.floor(y));
    }

    handle(event: CityEvent): void {
        if (event.type === 'fx') {
            const cx = event.x + event.size / 2;
            const cy = event.y + event.size / 2;

            if (event.kind === 'build' || event.kind === 'demolish') {
                this.burst(
                    cx,
                    cy,
                    event.kind === 'build' ? '#c9a77a' : '#8a7a6a',
                    26 * event.size,
                    'dust',
                );
            } else if (event.kind === 'upgrade') {
                this.burst(cx, cy, '#ffd75a', 30, 'spark');
                this.floats.push({
                    x: cx,
                    y: cy,
                    z: 40,
                    text: '⬆ Улучшение',
                    color: '#ffe17a',
                    life: 1.8,
                });
            } else {
                this.burst(cx, cy, '#fff2b0', 14, 'spark');
            }
        } else if (event.type === 'float') {
            this.floats.push({
                x: event.x,
                y: event.y,
                z: 20,
                text: event.text,
                color: event.color,
                life: 1.6,
            });
        } else if (event.type === 'epoch') {
            this.flash = 1.4;

            const center = MAP_SIZE / 2;

            for (let i = 0; i < 160; i++) {
                this.particles.push({
                    x: center + (Math.random() - 0.5) * 16,
                    y: center + (Math.random() - 0.5) * 16,
                    z: 160 + Math.random() * 80,
                    vx: (Math.random() - 0.5) * 0.4,
                    vy: (Math.random() - 0.5) * 0.4,
                    vz: -30 - Math.random() * 40,
                    life: 3,
                    max: 3,
                    size: 3,
                    grow: 0,
                    color: [
                        '#ffd75a',
                        '#ff6a6a',
                        '#6ad1ff',
                        '#8aff8a',
                        '#ffffff',
                    ][i % 5],
                    kind: 'confetti',
                });
            }
        }
    }

    private burst(
        x: number,
        y: number,
        color: string,
        count: number,
        kind: Particle['kind'],
    ): void {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 0.8,
                y: y + (Math.random() - 0.5) * 0.8,
                z: kind === 'spark' ? 10 + Math.random() * 30 : 2,
                vx: (Math.random() - 0.5) * 0.8,
                vy: (Math.random() - 0.5) * 0.8,
                vz:
                    kind === 'spark'
                        ? 20 + Math.random() * 30
                        : 8 + Math.random() * 14,
                life: 1 + Math.random() * 0.6,
                max: 1.6,
                size: kind === 'spark' ? 2 : 3 + Math.random() * 3,
                grow: kind === 'dust' ? 4 : 0,
                color,
                kind,
            });
        }
    }

    frame(dt: number, overlay: Overlay): void {
        const city = this.city;
        const ctx = this.ctx;

        if (!city) {
            return;
        }

        this.time += dt;

        const style = STYLES[city.state.epoch];

        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        const sky = ctx.createLinearGradient(0, 0, 0, this.height);

        sky.addColorStop(0, style.sky[0]);
        sky.addColorStop(1, style.sky[1]);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, this.width, this.height);

        const z = this.camera.zoom;

        ctx.setTransform(
            this.dpr * z,
            0,
            0,
            this.dpr * z,
            this.dpr * this.camera.x,
            this.dpr * this.camera.y,
        );

        this.updateShore(city);
        this.drawGround(ctx, city, overlay);
        this.drawOverlaysBelow(ctx, city, overlay);
        this.emitters = [];
        this.drawObjects(ctx, city, overlay, dt);
        this.drawWarnings(ctx, city);
        this.updateParticles(ctx, dt);

        if (this.flash > 0) {
            this.flash = Math.max(0, this.flash - dt);
            ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            ctx.fillStyle = `rgba(255, 248, 225, ${Math.min(1, this.flash) * 0.85})`;
            ctx.fillRect(0, 0, this.width, this.height);
        }
    }

    private visible(x: number, y: number, margin = 80): boolean {
        const [sx, sy] = this.worldToScreen(x + 0.5, y + 0.5);
        const m = margin * this.camera.zoom;

        return (
            sx > -m &&
            sy > -m * 2 &&
            sx < this.width + m &&
            sy < this.height + m
        );
    }

    private updateShore(city: City): void {
        if (this.shoreRevision === city.state.cleared.length) {
            return;
        }

        this.shoreRevision = city.state.cleared.length;

        for (let y = 0; y < MAP_SIZE; y++) {
            for (let x = 0; x < MAP_SIZE; x++) {
                let shore = 0;

                if (city.terrainAt(x, y) !== WATER) {
                    for (const [dx, dy] of [
                        [1, 0],
                        [-1, 0],
                        [0, 1],
                        [0, -1],
                    ]) {
                        if (
                            inMap(x + dx, y + dy) &&
                            city.terrainAt(x + dx, y + dy) === WATER
                        ) {
                            shore = 1;
                        }
                    }
                }

                this.shore[y * MAP_SIZE + x] = shore;
            }
        }
    }

    private drawGround(ctx: Ctx, city: City, overlay: Overlay): void {
        const style = STYLES[city.state.epoch];
        const t = this.time;

        for (let y = 0; y < MAP_SIZE; y++) {
            for (let x = 0; x < MAP_SIZE; x++) {
                if (!this.visible(x, y)) {
                    continue;
                }

                const terrain = city.terrainAt(x, y);
                const inside = city.inTerritory(x, y);
                const hash = tileHash(x, y);
                let color: string;

                if (terrain === WATER) {
                    color = shade(
                        '#3f8fc4',
                        Math.sin(t * 1.2 + x * 0.7 + y * 0.45) * 0.06,
                    );
                } else if (this.shore[y * MAP_SIZE + x]) {
                    color = hash > 0.5 ? '#d8c48c' : '#d1bc84';
                } else if (terrain === FOREST) {
                    color = shade(style.grass, -0.14);
                } else if (terrain === ROCK) {
                    color = '#98a084';
                } else {
                    color = hash > 0.5 ? style.grass : style.grassAlt;
                }

                if (!inside) {
                    color = shade(color, -0.28);
                }

                poly(ctx, tile(x, y), color);

                const building = city.buildingAt(x, y);

                if (building?.type === 'road') {
                    this.drawRoad(
                        ctx,
                        city,
                        x,
                        y,
                        style,
                        city.connectedRoads.has(y * MAP_SIZE + x),
                    );
                }
            }
        }

        // Territory border, and the land the next era adds.
        const { min, max } = city.territory();

        ctx.setLineDash([6, 5]);
        poly(
            ctx,
            rect(min, min, max + 1, max + 1),
            'rgba(0,0,0,0)',
            'rgba(255,255,255,0.55)',
            1.5,
        );

        if (city.state.epoch < STYLES.length - 1) {
            const next = city.territory(city.state.epoch + 1);

            poly(
                ctx,
                rect(next.min, next.min, next.max + 1, next.max + 1),
                'rgba(0,0,0,0)',
                'rgba(255,255,255,0.18)',
                1,
            );
        }

        ctx.setLineDash([]);

        if (overlay.ghost || overlay.roadPath.length) {
            ctx.globalAlpha = 0.18;

            for (let y = min; y <= max; y++) {
                line(ctx, P(min, y), P(max + 1, y), '#ffffff', 0.5);
            }

            for (let x = min; x <= max; x++) {
                line(ctx, P(x, min), P(x, max + 1), '#ffffff', 0.5);
            }

            ctx.globalAlpha = 1;
        }
    }

    private drawRoad(
        ctx: Ctx,
        city: City,
        x: number,
        y: number,
        style: (typeof STYLES)[number],
        connected: boolean,
    ): void {
        const isRoad = (tx: number, ty: number) =>
            city.buildingAt(tx, ty)?.type === 'road';

        poly(
            ctx,
            tile(x, y, 0.5),
            connected ? style.road : shade(style.road, -0.15),
        );

        const edges: [number, number, Point, Point][] = [
            [0, -1, P(x, y, 0.5), P(x + 1, y, 0.5)],
            [1, 0, P(x + 1, y, 0.5), P(x + 1, y + 1, 0.5)],
            [0, 1, P(x + 1, y + 1, 0.5), P(x, y + 1, 0.5)],
            [-1, 0, P(x, y + 1, 0.5), P(x, y, 0.5)],
        ];

        for (const [dx, dy, a, b] of edges) {
            if (!isRoad(x + dx, y + dy)) {
                line(ctx, a, b, style.roadEdge, 1.4);
            }
        }

        if (style.roadMark) {
            ctx.setLineDash([3, 4]);

            if (isRoad(x - 1, y) || isRoad(x + 1, y)) {
                line(
                    ctx,
                    P(x, y + 0.5, 0.6),
                    P(x + 1, y + 0.5, 0.6),
                    style.roadMark,
                    0.8,
                );
            }

            if (isRoad(x, y - 1) || isRoad(x, y + 1)) {
                line(
                    ctx,
                    P(x + 0.5, y, 0.6),
                    P(x + 0.5, y + 1, 0.6),
                    style.roadMark,
                    0.8,
                );
            }

            ctx.setLineDash([]);
        } else if (city.state.epoch >= 2) {
            // Cobbles.
            for (let i = 0; i < 3; i++) {
                const [cx, cy] = P(
                    x + 0.2 + tileHash(x, y, i) * 0.6,
                    y + 0.2 + tileHash(y, x, i) * 0.6,
                    0.6,
                );

                ctx.fillStyle = shade(style.road, -0.12);
                ctx.fillRect(cx - 1.5, cy - 0.75, 3, 1.5);
            }
        }

        if (!connected) {
            const [cx, cy] = P(x + 0.5, y + 0.5, 1);

            ctx.fillStyle = 'rgba(220,60,40,0.55)';
            ctx.beginPath();
            ctx.arc(cx, cy, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private drawOverlaysBelow(ctx: Ctx, city: City, overlay: Overlay): void {
        for (const step of overlay.roadPath) {
            poly(
                ctx,
                tile(step.x, step.y, 0.8),
                step.ok ? 'rgba(255,255,255,0.45)' : 'rgba(230,60,50,0.45)',
            );
        }

        if (overlay.hover && overlay.bulldoze) {
            poly(
                ctx,
                tile(overlay.hover.x, overlay.hover.y, 1),
                'rgba(230,60,50,0.35)',
                '#ff6a5a',
                1.5,
            );
        } else if (
            overlay.hover &&
            !overlay.ghost &&
            !overlay.roadPath.length
        ) {
            poly(
                ctx,
                tile(overlay.hover.x, overlay.hover.y, 0.6),
                'rgba(255,255,255,0.12)',
                'rgba(255,255,255,0.5)',
                1,
            );
        }

        const selected = overlay.selectedId
            ? city.byId.get(overlay.selectedId)
            : null;

        if (selected) {
            const def = BUILDING[selected.type];

            this.drawRanges(ctx, def, selected.x, selected.y);
            poly(
                ctx,
                rect(
                    selected.x,
                    selected.y,
                    selected.x + def.size,
                    selected.y + def.size,
                    0.8,
                ),
                'rgba(255,220,90,0.18)',
                '#ffd75a',
                2,
            );
        }

        if (overlay.ghost) {
            const def = BUILDING[overlay.ghost.type];
            const { x, y, ok } = overlay.ghost;

            if (def.nearby) {
                const code = TERRAIN_CODE[def.nearby.terrain];

                for (const [tx, ty] of city.around(
                    x,
                    y,
                    def.size,
                    def.nearby.terrain === 'water' ? 1 : 2,
                )) {
                    if (city.terrainAt(tx, ty) === code) {
                        poly(ctx, tile(tx, ty, 1), 'rgba(255,230,90,0.35)');
                    }
                }
            }

            this.drawRanges(ctx, def, x, y);

            for (let ty = y; ty < y + def.size; ty++) {
                for (let tx = x; tx < x + def.size; tx++) {
                    poly(
                        ctx,
                        tile(tx, ty, 1),
                        ok ? 'rgba(80,220,120,0.4)' : 'rgba(230,60,50,0.45)',
                    );
                }
            }
        }
    }

    private drawRanges(ctx: Ctx, def: BuildingDef, x: number, y: number): void {
        const ranges: [number, string][] = [];

        if (def.aura) {
            ranges.push([def.aura.radius, 'rgba(120,220,255,0.9)']);
        }

        if (def.boost) {
            ranges.push([def.boost.radius, 'rgba(255,220,90,0.9)']);
        }

        if (def.pollution) {
            ranges.push([def.pollution.radius, 'rgba(160,110,90,0.9)']);
        }

        for (const [radius, color] of ranges) {
            ctx.setLineDash([5, 4]);
            poly(
                ctx,
                rect(
                    x - radius,
                    y - radius,
                    x + def.size + radius,
                    y + def.size + radius,
                    0.5,
                ),
                color.replace('0.9', '0.08'),
                color,
                1.4,
            );
            ctx.setLineDash([]);
        }
    }

    private drawObjects(
        ctx: Ctx,
        city: City,
        overlay: Overlay,
        dt: number,
    ): void {
        const style = STYLES[city.state.epoch];
        const items: { key: number; draw: () => void }[] = [];
        const moving = overlay.ghost?.moving;

        for (const building of city.state.buildings) {
            if (building.type === 'road' || building.id === moving) {
                continue;
            }

            const def = BUILDING[building.type];

            if (
                !this.visible(
                    building.x + def.size / 2 - 0.5,
                    building.y + def.size / 2 - 0.5,
                    160,
                )
            ) {
                continue;
            }

            const duration = Math.max(
                0.001,
                building.buildEnd - building.buildStart,
            );
            const progress = city.isComplete(building)
                ? 1
                : (city.state.time - building.buildStart) / duration;
            const grow =
                building.level > 1 && !city.isComplete(building)
                    ? 1
                    : Math.max(0.15, Math.min(1, progress));
            const water =
                def.id === 'harbor'
                    ? this.waterSide(city, building)
                    : undefined;

            items.push({
                key: depth(building),
                draw: () => {
                    drawBuilding(ctx, {
                        b: building,
                        def,
                        epoch: city.state.epoch,
                        style,
                        t: this.time,
                        grow: city.isComplete(building) ? 1 : grow,
                        emit: (x, y, z, kind) =>
                            this.emitters.push({ x, y, z, kind }),
                        water,
                    });

                    if (!city.isComplete(building)) {
                        this.progressBar(
                            ctx,
                            building,
                            def,
                            Math.min(1, progress),
                        );

                        if (Math.random() < dt * 6) {
                            this.burst(
                                building.x + Math.random() * def.size,
                                building.y + Math.random() * def.size,
                                '#c9a77a',
                                1,
                                'dust',
                            );
                        }
                    }
                },
            });
        }

        for (let y = 0; y < MAP_SIZE; y++) {
            for (let x = 0; x < MAP_SIZE; x++) {
                const terrain = city.terrainAt(x, y);

                if (
                    (terrain !== FOREST && terrain !== ROCK) ||
                    !this.visible(x, y)
                ) {
                    continue;
                }

                if (terrain === FOREST) {
                    for (let i = 0; i < 2; i++) {
                        const ox = 0.25 + tileHash(x, y, i + 11) * 0.5;
                        const oy = 0.25 + tileHash(x, y, i + 21) * 0.5;

                        items.push({
                            key: x + ox + y + oy,
                            draw: () =>
                                tree(
                                    ctx,
                                    x + ox,
                                    y + oy,
                                    0.85 + tileHash(x, y, i + 31) * 0.4,
                                    tileHash(x, y, i + 41) > 0.45,
                                ),
                        });
                    }
                } else {
                    items.push({
                        key: x + y + 1,
                        draw: () => rock(ctx, x, y, 5),
                    });
                }
            }
        }

        this.updateWalkers(city, dt);

        for (const walker of this.walkers) {
            const fx =
                walker.x + 0.5 + (walker.nx - walker.x) * walker.p + walker.px;
            const fy =
                walker.y + 0.5 + (walker.ny - walker.y) * walker.p + walker.py;

            items.push({
                key: fx + fy + 0.05,
                draw: () => this.drawWalker(ctx, walker, fx, fy),
            });
        }

        if (overlay.ghost) {
            const def = BUILDING[overlay.ghost.type];
            const ghost: Building = {
                id: -1,
                type: def.id,
                x: overlay.ghost.x,
                y: overlay.ghost.y,
                level: 1,
                buildEnd: 0,
                buildStart: 0,
            };

            if (def.id !== 'road') {
                items.push({
                    key: depth(ghost) + 0.01,
                    draw: () => {
                        ctx.globalAlpha = overlay.ghost!.ok ? 0.72 : 0.4;
                        drawBuilding(ctx, {
                            b: ghost,
                            def,
                            epoch: city.state.epoch,
                            style,
                            t: this.time,
                            grow: 1,
                            emit: () => {},
                        });
                        ctx.globalAlpha = 1;
                    },
                });
            }
        }

        items.sort((a, b) => a.key - b.key);

        for (const item of items) {
            item.draw();
        }

        for (const emitter of this.emitters) {
            if (Math.random() < dt * (emitter.kind === 'steam' ? 4 : 2.5)) {
                this.particles.push({
                    x: emitter.x,
                    y: emitter.y,
                    z: emitter.z,
                    vx: 0.05 + Math.random() * 0.08,
                    vy: -0.05 - Math.random() * 0.05,
                    vz: 12 + Math.random() * 8,
                    life: 3,
                    max: 3,
                    size: emitter.kind === 'steam' ? 5 : 3,
                    grow: emitter.kind === 'steam' ? 5 : 3,
                    color:
                        emitter.kind === 'steam'
                            ? '235,238,240'
                            : '110,108,105',
                    kind: 'smoke',
                });
            }
        }
    }

    private waterSide(city: City, building: Building): [number, number] {
        for (const [dx, dy] of [
            [1, 0],
            [0, 1],
            [-1, 0],
            [0, -1],
        ]) {
            const x = building.x + (dx > 0 ? 2 : dx < 0 ? -1 : 0);
            const y = building.y + (dy > 0 ? 2 : dy < 0 ? -1 : 0);

            if (
                city.terrainAt(x, y) === WATER ||
                city.terrainAt(x + Math.abs(dy), y + Math.abs(dx)) === WATER
            ) {
                return [dx, dy];
            }
        }

        return [1, 0];
    }

    private progressBar(
        ctx: Ctx,
        building: Building,
        def: BuildingDef,
        progress: number,
    ): void {
        const [sx, sy] = P(
            building.x + def.size / 2,
            building.y + def.size / 2,
            30 * def.size + 10,
        );

        ctx.fillStyle = 'rgba(20,20,25,0.7)';
        ctx.fillRect(sx - 16, sy, 32, 5);
        ctx.fillStyle = building.level > 1 ? '#ffd75a' : '#6ad18a';
        ctx.fillRect(sx - 15, sy + 1, 30 * progress, 3);
    }

    private drawWarnings(ctx: Ctx, city: City): void {
        ctx.font = '12px system-ui, "Segoe UI Emoji", sans-serif';
        ctx.textAlign = 'center';

        for (const building of city.state.buildings) {
            if (building.type === 'road' || !city.isComplete(building)) {
                continue;
            }

            const status = city.status.get(building.id);
            const def = BUILDING[building.type];
            let icon = '';

            if (!status) {
                continue;
            }

            if (!status.connected) {
                icon = '🚧';
            } else if (status.noPower) {
                icon = '⚡';
            } else if (status.starved) {
                icon = '📦';
            } else if (def.workers && status.efficiency < 0.5) {
                icon = '👷';
            }

            if (!icon) {
                continue;
            }

            const [sx, sy] = P(
                building.x + def.size / 2,
                building.y + def.size / 2,
                estimateHeight(building, def) + 14,
            );
            const bob = Math.sin(this.time * 3 + building.id) * 2;

            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.beginPath();
            ctx.arc(sx, sy + bob - 4, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillText(icon, sx, sy + bob);
        }
    }

    private updateWalkers(city: City, dt: number): void {
        const roads = [...city.connectedRoads];
        const epoch = city.state.epoch;

        if (!roads.length) {
            this.walkers = [];

            return;
        }

        const people = Math.min(70, 2 + Math.floor(city.state.population / 9));
        const vehicles =
            epoch >= 4
                ? Math.min(30, Math.floor(roads.length / (epoch >= 7 ? 3 : 6)))
                : 0;
        const isRoad = (x: number, y: number) =>
            city.connectedRoads.has(y * MAP_SIZE + x);
        const count = (kind: Walker['kind'] | 'vehicle') =>
            this.walkers.filter((w) =>
                kind === 'vehicle' ? w.kind !== 'person' : w.kind === kind,
            ).length;

        const spawn = (kind: Walker['kind']) => {
            const index = roads[Math.floor(Math.random() * roads.length)];
            const x = index % MAP_SIZE;
            const y = Math.floor(index / MAP_SIZE);
            const palette = CLOTHES[epoch];

            this.walkers.push({
                x,
                y,
                nx: x,
                ny: y,
                px: 0,
                py: 0,
                p: 1,
                speed:
                    kind === 'person'
                        ? 0.5 + Math.random() * 0.4
                        : kind === 'cart'
                          ? 0.7
                          : 1.4 + Math.random(),
                kind,
                color:
                    kind === 'car'
                        ? CARS[Math.floor(Math.random() * CARS.length)]
                        : palette[Math.floor(Math.random() * palette.length)],
                lane: Math.random() > 0.5 ? 1 : -1,
            });
        };

        if (count('person') < people && Math.random() < 0.3) {
            spawn('person');
        }

        if (count('vehicle') < vehicles && Math.random() < 0.2) {
            spawn(epoch >= 7 ? 'car' : 'cart');
        }

        this.walkers = this.walkers.filter((walker) => {
            walker.p += walker.speed * dt;

            if (walker.p < 1) {
                return true;
            }

            const fromX = walker.x;
            const fromY = walker.y;

            walker.x = walker.nx;
            walker.y = walker.ny;

            if (!isRoad(walker.x, walker.y)) {
                return false;
            }

            const options = [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
            ].filter(
                ([dx, dy]) =>
                    isRoad(walker.x + dx, walker.y + dy) &&
                    !(walker.x + dx === fromX && walker.y + dy === fromY),
            );
            const next = options.length
                ? options[Math.floor(Math.random() * options.length)]
                : [fromX - walker.x, fromY - walker.y];

            if (!isRoad(walker.x + next[0], walker.y + next[1])) {
                return false;
            }

            walker.nx = walker.x + next[0];
            walker.ny = walker.y + next[1];
            walker.p = 0;

            const side = walker.kind === 'person' ? 0.32 : 0.15;

            walker.px =
                next[1] !== 0 ? walker.lane * side * Math.sign(next[1]) : 0;
            walker.py =
                next[0] !== 0 ? -walker.lane * side * Math.sign(next[0]) : 0;

            return Math.random() > 0.004;
        });
    }

    private drawWalker(ctx: Ctx, walker: Walker, fx: number, fy: number): void {
        if (walker.kind === 'person') {
            const [sx, sy] = P(fx, fy, 0.5);
            const step = Math.sin((walker.p + walker.x) * 18) * 0.8;

            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(sx - 2, sy - 0.5, 4, 1.5);
            ctx.fillStyle = walker.color;
            ctx.fillRect(sx - 1.5, sy - 7 + step * 0.2, 3, 6);
            ctx.fillStyle = '#f1c9a0';
            ctx.beginPath();
            ctx.arc(sx, sy - 8.5, 1.6, 0, Math.PI * 2);
            ctx.fill();

            return;
        }

        const alongX = walker.nx !== walker.x;
        const half = walker.kind === 'car' ? 0.2 : 0.17;
        const across = 0.1;
        const x0 = fx - (alongX ? half : across);
        const x1 = fx + (alongX ? half : across);
        const y0 = fy - (alongX ? across : half);
        const y1 = fy + (alongX ? across : half);

        if (walker.kind === 'car') {
            box(ctx, x0, y0, x1, y1, 1, 3.5, walker.color);
            box(
                ctx,
                x0 + (alongX ? 0.06 : 0.02),
                y0 + (alongX ? 0.02 : 0.06),
                x1 - (alongX ? 0.08 : 0.02),
                y1 - (alongX ? 0.02 : 0.08),
                4.5,
                2.5,
                '#9fc7de',
            );
        } else {
            box(ctx, x0, y0, x1, y1, 2, 4, '#8a5a2b', '#c9a064');
            box(
                ctx,
                x0 + 0.03,
                y0 + 0.03,
                x1 - 0.03,
                y1 - 0.03,
                6,
                1.5,
                '#e8d9b0',
            );
        }
    }

    private updateParticles(ctx: Ctx, dt: number): void {
        if (this.particles.length > 900) {
            this.particles.splice(0, this.particles.length - 900);
        }

        this.particles = this.particles.filter((p) => {
            p.life -= dt;

            if (p.life <= 0) {
                return false;
            }

            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z = Math.max(0, p.z + p.vz * dt);

            if (p.kind === 'dust' || p.kind === 'spark') {
                p.vz -= 40 * dt;
            }

            p.size += p.grow * dt;

            const alpha =
                Math.min(1, p.life / p.max) * (p.kind === 'smoke' ? 0.45 : 0.9);
            const [sx, sy] = P(p.x, p.y, p.z);

            if (p.kind === 'smoke') {
                ctx.fillStyle = `rgba(${p.color},${alpha})`;
                ctx.beginPath();
                ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.kind === 'confetti') {
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.fillRect(
                    sx - 2,
                    sy - 1,
                    4,
                    2 + Math.sin(p.life * 10) * 1.5,
                );
                ctx.globalAlpha = 1;
            } else {
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
                ctx.globalAlpha = 1;
            }

            return true;
        });

        ctx.textAlign = 'center';
        ctx.font = 'bold 13px system-ui, "Segoe UI Emoji", sans-serif';

        this.floats = this.floats.filter((f) => {
            f.life -= dt;
            f.z += 18 * dt;

            const [sx, sy] = P(f.x, f.y, f.z);

            ctx.globalAlpha = Math.min(1, f.life);
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            ctx.strokeText(f.text, sx, sy);
            ctx.fillStyle = f.color;
            ctx.fillText(f.text, sx, sy);
            ctx.globalAlpha = 1;

            return f.life > 0;
        });
    }
}

function depth(building: Building): number {
    const size = BUILDING[building.type].size;

    return building.x + building.y + size + building.x * 0.0001;
}

function estimateHeight(building: Building, def: BuildingDef): number {
    switch (def.shape) {
        case 'tower':
            return def.id === 'tenement'
                ? (3 + building.level) * 8
                : def.id === 'apartment'
                  ? (5 + building.level * 2) * 8
                  : (12 + building.level * 5) * 6.5;
        case 'office':
            return (12 + building.level * 5) * 6;
        case 'house':
            return 22 + building.level * 6;
        case 'farm':
        case 'park':
        case 'solar':
            return 18;
        default:
            return 30 * def.size + 10;
    }
}

function inside(points: Point[], x: number, y: number): boolean {
    let result = false;

    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];

        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
            result = !result;
        }
    }

    return result;
}
