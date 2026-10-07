/**
 * Draws a Game: terrain by biome and season, roads in the era's style,
 * features, buildings from their models, residents and traffic, weather,
 * smoke and effects, then day/night lighting with lit windows and street
 * lamps, and the overlays the player works with.
 */

import type { BuildingDef } from '../engine/content/types';
import type { GameEvent } from '../engine/core/events';
import { hash2 } from '../engine/core/random';
import type { Game } from '../engine/sim/game';
import type { BuildingState, NpcState } from '../engine/sim/state';
import { HH, HW, P, box, line, poly, pyramid, rect, shade, tile } from './iso';
import type { Point } from './iso';
import { drawModel, modelHeight, tree } from './model';

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
    selectedUid: number | null;
    selectedNpc: number | null;
    bulldoze: boolean;
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
    kind: 'smoke' | 'dust' | 'spark' | 'confetti' | 'water';
}

interface FloatText {
    x: number;
    y: number;
    z: number;
    text: string;
    color: string;
    life: number;
}

interface Glow {
    x: number;
    y: number;
    z: number;
    radius: number;
    color: string;
}

function mix(a: string, b: string, t: number): string {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const ch = (shift: number) =>
        Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);

    return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

export class Renderer {
    readonly canvas: HTMLCanvasElement;
    readonly ctx: CanvasRenderingContext2D;
    game: Game | null = null;
    camera = { x: 0, y: 0, zoom: 1 };
    width = 0;
    height = 0;
    dpr = 1;

    private time = 0;
    private particles: Particle[] = [];
    private floats: FloatText[] = [];
    private emitters: { x: number; y: number; z: number; kind: string }[] = [];
    private glows: Glow[] = [];
    private weatherDrops: { x: number; y: number; s: number }[] = [];
    private flash = 0;
    private lightCanvas = document.createElement('canvas');

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
    }

    attach(game: Game): void {
        this.game = game;
        this.particles = [];
        this.floats = [];
    }

    resize(): void {
        const box = this.canvas.getBoundingClientRect();

        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.width = box.width;
        this.height = box.height;
        this.canvas.width = Math.round(box.width * this.dpr);
        this.canvas.height = Math.round(box.height * this.dpr);
        this.lightCanvas.width = this.canvas.width;
        this.lightCanvas.height = this.canvas.height;
    }

    centerOn(x: number, y: number): void {
        const [sx, sy] = P(x, y);

        this.camera.x = this.width / 2 - sx * this.camera.zoom;
        this.camera.y = this.height / 2 - sy * this.camera.zoom;
    }

    zoomAt(factor: number, px = this.width / 2, py = this.height / 2): void {
        const zoom = Math.min(3, Math.max(0.3, this.camera.zoom * factor));
        const ratio = zoom / this.camera.zoom;

        this.camera.x = px - (px - this.camera.x) * ratio;
        this.camera.y = py - (py - this.camera.y) * ratio;
        this.camera.zoom = zoom;
    }

    pan(dx: number, dy: number): void {
        this.camera.x += dx;
        this.camera.y += dy;
    }

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

    pickNpc(px: number, py: number): NpcState | null {
        const game = this.game;

        if (!game) {
            return null;
        }

        let best: NpcState | null = null;
        let bestDistance = 12;

        for (const npc of game.npcs.residents) {
            if (!game.npcs.isVisible(npc)) {
                continue;
            }

            const [sx, sy] = this.worldToScreen(npc.x, npc.y, 5);
            const distance = Math.hypot(sx - px, sy - py);

            if (distance < bestDistance) {
                best = npc;
                bestDistance = distance;
            }
        }

        return best;
    }

    pickBuilding(px: number, py: number): BuildingState | null {
        const game = this.game;

        if (!game) {
            return null;
        }

        const sx = (px - this.camera.x) / this.camera.zoom;
        const sy = (py - this.camera.y) / this.camera.zoom;
        const list = [...game.buildings.values()]
            .filter((b) => game.def(b).render !== 'road')
            .sort((a, b) => this.depth(game, b) - this.depth(game, a));

        for (const building of list) {
            const def = game.def(building);
            const h = modelHeight(game.levelDef(building).model.parts);
            const { w, h: d } = def.size;
            const hull = [
                P(building.x, building.y + d, 0),
                P(building.x + w, building.y + d, 0),
                P(building.x + w, building.y, 0),
                P(building.x + w, building.y, h),
                P(building.x, building.y, h),
                P(building.x, building.y + d, h),
            ];

            if (inside(hull, sx, sy)) {
                return building;
            }
        }

        const world = this.screenToWorld(px, py);

        return (
            game.buildingAt(Math.floor(world.x), Math.floor(world.y)) ?? null
        );
    }

    handle(event: GameEvent): void {
        if (event.type === 'placed' || event.type === 'removed') {
            this.burst(
                event.x + event.w / 2,
                event.y + event.h / 2,
                event.type === 'placed' ? '#c9a77a' : '#8a7a6a',
                22 * event.w,
                'dust',
            );
        } else if (event.type === 'upgraded') {
            this.burst(
                event.x + event.w / 2,
                event.y + event.h / 2,
                '#ffd75a',
                30,
                'spark',
            );
            this.floats.push({
                x: event.x + event.w / 2,
                y: event.y + event.h / 2,
                z: 40,
                text: '⬆ Улучшение',
                color: '#ffe17a',
                life: 1.8,
            });
        } else if (event.type === 'cleared') {
            this.burst(event.x + 0.5, event.y + 0.5, '#8a7a6a', 10, 'dust');
            this.floats.push({
                x: event.x + 0.5,
                y: event.y + 0.5,
                z: 18,
                text: event.text,
                color: '#f2c46d',
                life: 1.5,
            });
        } else if (event.type === 'built') {
            const building = this.game?.buildings.get(event.uid);

            if (building) {
                this.burst(
                    building.x + 0.5,
                    building.y + 0.5,
                    '#fff2b0',
                    12,
                    'spark',
                );
            }
        } else if (event.type === 'epoch') {
            this.flash = 1.4;

            const game = this.game!;

            for (let i = 0; i < 160; i++) {
                this.particles.push({
                    x: game.map.width / 2 + (Math.random() - 0.5) * 16,
                    y: game.map.height / 2 + (Math.random() - 0.5) * 16,
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

    /** `dt` real seconds (animation), `gameDt` game seconds (NPC motion). */
    frame(dt: number, overlay: Overlay): void {
        const game = this.game;
        const ctx = this.ctx;

        if (!game) {
            return;
        }

        this.time += dt;

        const palette = game.palette;
        const light = game.clock.light(
            game.state.time,
            game.weather?.light ?? 0,
        );

        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        const sky = ctx.createLinearGradient(0, 0, 0, this.height);

        sky.addColorStop(0, palette.sky[0]);
        sky.addColorStop(1, palette.sky[1]);
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

        this.glows = [];
        this.emitters = [];
        this.drawGround(game, overlay, light.night);
        this.drawOverlaysBelow(game, overlay);
        this.drawObjects(game, overlay, light.night);
        this.drawWarnings(game);
        this.updateParticles(dt);
        this.drawLighting(light);
        this.drawWeather(game, dt);

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
            sy > -m * 2.5 &&
            sx < this.width + m &&
            sy < this.height + m
        );
    }

    private drawGround(game: Game, overlay: Overlay, night: boolean): void {
        const ctx = this.ctx;
        const map = game.map;
        const season = game.season;
        const t = game.territory();

        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                if (!this.visible(x, y)) {
                    continue;
                }

                const index = map.index(x, y);
                const biome = map.biomeOfIndex(index);
                let color = biome.colors[hash2(x, y) > 0.5 ? 0 : 1];

                if (biome.water) {
                    color = shade(
                        color,
                        Math.sin(this.time * 1.2 + x * 0.7 + y * 0.45) * 0.05,
                    );

                    if (season.snow > 0.5 && map.elevation[index] > 64) {
                        color = mix(color, '#dbe8f0', 0.6);
                    }
                } else if (biome.walkable) {
                    if (season.groundTint) {
                        color = mix(
                            color,
                            season.groundTint,
                            season.snow > 0
                                ? season.snow * (0.75 + hash2(x, y, 4) * 0.25)
                                : 0.22,
                        );
                    }
                }

                if (x < t.minX || y < t.minY || x > t.maxX || y > t.maxY) {
                    color = shade(color, -0.3);
                }

                poly(ctx, tile(x, y), color);

                const occupant = game.buildings.get(map.occupant[index]);

                if (occupant?.type === 'road') {
                    this.drawRoad(
                        game,
                        x,
                        y,
                        game.connectedRoads.has(index),
                        night,
                    );
                }
            }
        }

        ctx.setLineDash([6, 5]);
        poly(
            ctx,
            rect(t.minX, t.minY, t.maxX + 1, t.maxY + 1),
            'rgba(0,0,0,0)',
            'rgba(255,255,255,0.55)',
            1.5,
        );

        if (game.state.epoch < game.content.epochs.length - 1) {
            const n = game.territory(game.state.epoch + 1);

            poly(
                ctx,
                rect(n.minX, n.minY, n.maxX + 1, n.maxY + 1),
                'rgba(0,0,0,0)',
                'rgba(255,255,255,0.18)',
                1,
            );
        }

        ctx.setLineDash([]);

        if (overlay.ghost || overlay.roadPath.length) {
            ctx.globalAlpha = 0.16;

            for (let y = t.minY; y <= t.maxY + 1; y++) {
                line(ctx, P(t.minX, y), P(t.maxX + 1, y), '#ffffff', 0.5);
            }

            for (let x = t.minX; x <= t.maxX + 1; x++) {
                line(ctx, P(x, t.minY), P(x, t.maxY + 1), '#ffffff', 0.5);
            }

            ctx.globalAlpha = 1;
        }
    }

    private drawRoad(
        game: Game,
        x: number,
        y: number,
        connected: boolean,
        night: boolean,
    ): void {
        const ctx = this.ctx;
        const palette = game.palette;
        const isRoad = (tx: number, ty: number) =>
            game.map.inBounds(tx, ty) && game.isRoad(game.map.index(tx, ty));
        const snow = game.season.snow;
        const base =
            snow > 0.4 &&
            palette.roadStyle !== 'asphalt' &&
            palette.roadStyle !== 'glow'
                ? mix(palette.road, '#e6edf2', 0.5)
                : palette.road;

        poly(ctx, tile(x, y, 0.5), connected ? base : shade(base, -0.15));

        const edges: [number, number, Point, Point][] = [
            [0, -1, P(x, y, 0.5), P(x + 1, y, 0.5)],
            [1, 0, P(x + 1, y, 0.5), P(x + 1, y + 1, 0.5)],
            [0, 1, P(x + 1, y + 1, 0.5), P(x, y + 1, 0.5)],
            [-1, 0, P(x, y + 1, 0.5), P(x, y, 0.5)],
        ];

        for (const [dx, dy, a, b] of edges) {
            if (!isRoad(x + dx, y + dy)) {
                line(ctx, a, b, palette.roadEdge, 1.4);
            }
        }

        if (palette.roadMark) {
            ctx.setLineDash(palette.roadStyle === 'glow' ? [] : [3, 4]);

            const mark =
                palette.roadStyle === 'glow'
                    ? `${palette.roadMark}`
                    : palette.roadMark;

            if (isRoad(x - 1, y) || isRoad(x + 1, y)) {
                line(
                    ctx,
                    P(x, y + 0.5, 0.6),
                    P(x + 1, y + 0.5, 0.6),
                    mark,
                    palette.roadStyle === 'glow' ? 1.2 : 0.8,
                );
            }

            if (isRoad(x, y - 1) || isRoad(x, y + 1)) {
                line(
                    ctx,
                    P(x + 0.5, y, 0.6),
                    P(x + 0.5, y + 1, 0.6),
                    mark,
                    palette.roadStyle === 'glow' ? 1.2 : 0.8,
                );
            }

            ctx.setLineDash([]);

            if (palette.roadStyle === 'glow' && night) {
                this.glows.push({
                    x: x + 0.5,
                    y: y + 0.5,
                    z: 0,
                    radius: 0.5,
                    color: palette.roadMark,
                });
            }
        } else if (
            palette.roadStyle === 'cobble' ||
            palette.roadStyle === 'paved'
        ) {
            for (let i = 0; i < 3; i++) {
                const [cx, cy] = P(
                    x + 0.2 + hash2(x, y, i) * 0.6,
                    y + 0.2 + hash2(y, x, i) * 0.6,
                    0.6,
                );

                ctx.fillStyle = shade(palette.road, -0.12);
                ctx.fillRect(cx - 1.5, cy - 0.75, 3, 1.5);
            }
        }

        // Street lamps from the Renaissance on, every few tiles.
        if (game.state.epoch >= 1 && connected && hash2(x, y, 9) > 0.78) {
            const lampColor = game.state.epoch >= 3 ? '#fff4d0' : '#ffc46a';
            const top = P(x + 0.15, y + 0.15, 16);

            line(ctx, P(x + 0.15, y + 0.15, 0.5), top, '#3a3a3a', 1);
            ctx.fillStyle = night ? lampColor : '#d8d2c0';
            ctx.fillRect(top[0] - 1.5, top[1] - 2, 3, 3);

            if (night) {
                this.glows.push({
                    x: x + 0.15,
                    y: y + 0.15,
                    z: 16,
                    radius: 1.2,
                    color: lampColor,
                });
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

    private drawRanges(
        def: BuildingDef,
        level: number,
        x: number,
        y: number,
    ): void {
        const ctx = this.ctx;
        const effects = def.levels[Math.max(0, level - 1)].effects;
        const ranges: [number, string][] = [];

        if (effects.aura) {
            ranges.push([effects.aura.radius, '120,220,255']);
        }

        if (effects.boost) {
            ranges.push([effects.boost.radius, '255,220,90']);
        }

        if (effects.pollution) {
            ranges.push([effects.pollution.radius, '160,110,90']);
        }

        if (effects.near) {
            ranges.push([effects.near.radius, '255,240,150']);
        }

        for (const [radius, rgb] of ranges) {
            ctx.setLineDash([5, 4]);
            poly(
                ctx,
                rect(
                    x - radius,
                    y - radius,
                    x + def.size.w + radius,
                    y + def.size.h + radius,
                    0.5,
                ),
                `rgba(${rgb},0.07)`,
                `rgba(${rgb},0.9)`,
                1.4,
            );
            ctx.setLineDash([]);
        }
    }

    private drawOverlaysBelow(game: Game, overlay: Overlay): void {
        const ctx = this.ctx;

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

        const selected = overlay.selectedUid
            ? game.buildings.get(overlay.selectedUid)
            : null;

        if (selected) {
            const def = game.def(selected);

            this.drawRanges(def, selected.level, selected.x, selected.y);
            poly(
                ctx,
                rect(
                    selected.x,
                    selected.y,
                    selected.x + def.size.w,
                    selected.y + def.size.h,
                    0.8,
                ),
                'rgba(255,220,90,0.18)',
                '#ffd75a',
                2,
            );
        }

        if (overlay.ghost) {
            const def = game.content.building(overlay.ghost.type);
            const { x, y, ok } = overlay.ghost;
            const near = def.levels[0].effects.near;

            if (near) {
                for (const [tx, ty] of game.around(
                    x,
                    y,
                    def.size.w,
                    def.size.h,
                    near.radius,
                )) {
                    if (game.map.featureAt(tx, ty) === near.feature) {
                        poly(ctx, tile(tx, ty, 1), 'rgba(255,230,90,0.35)');
                    }
                }
            }

            this.drawRanges(def, 1, x, y);

            for (let ty = y; ty < y + def.size.h; ty++) {
                for (let tx = x; tx < x + def.size.w; tx++) {
                    poly(
                        ctx,
                        tile(tx, ty, 1),
                        ok ? 'rgba(80,220,120,0.4)' : 'rgba(230,60,50,0.45)',
                    );
                }
            }
        }
    }

    private depth(game: Game, building: BuildingState): number {
        const { w, h } = game.def(building).size;

        return building.x + building.y + (w + h) / 2 + building.x * 0.0001;
    }

    private drawObjects(game: Game, overlay: Overlay, night: boolean): void {
        const ctx = this.ctx;
        const map = game.map;
        const season = game.season;
        const palette = game.palette;
        const items: { key: number; draw: () => void }[] = [];
        const emit = (x: number, y: number, z: number, kind: string) =>
            this.emitters.push({ x, y, z, kind });
        const glow = (
            x: number,
            y: number,
            z: number,
            radius: number,
            color: string,
        ) => this.glows.push({ x, y, z, radius, color });

        for (const building of game.buildings.values()) {
            const def = game.def(building);

            if (
                def.render === 'road' ||
                building.uid === overlay.ghost?.moving
            ) {
                continue;
            }

            if (
                !this.visible(
                    building.x + def.size.w / 2 - 0.5,
                    building.y + def.size.h / 2 - 0.5,
                    200,
                )
            ) {
                continue;
            }

            const complete = game.isComplete(building);
            const duration = Math.max(
                0.001,
                building.buildEnd - building.buildStart,
            );
            const progress = complete
                ? 1
                : (game.state.time - building.buildStart) / duration;
            const upgrading = !complete && building.level > 1;
            const parts = upgrading
                ? game.content.level(def, building.level - 1).model.parts
                : game.levelDef(building).model.parts;

            items.push({
                key: this.depth(game, building),
                draw: () => {
                    poly(
                        ctx,
                        rect(
                            building.x + 0.05,
                            building.y + 0.05,
                            building.x + def.size.w + 0.1,
                            building.y + def.size.h + 0.1,
                        ),
                        'rgba(0,0,0,0.12)',
                    );
                    drawModel(parts, {
                        ctx,
                        x: building.x,
                        y: building.y,
                        palette,
                        seed: building.uid * 7 + building.x,
                        time: this.time,
                        night,
                        grow: upgrading
                            ? 1
                            : Math.max(0.15, Math.min(1, progress)),
                        snow: season.snow,
                        treeTint: season.treeTint,
                        emit,
                        light: glow,
                    });

                    if (!complete) {
                        this.scaffold(def, building, upgrading);
                        this.progressBar(
                            def,
                            building,
                            Math.min(1, progress),
                            upgrading,
                        );

                        if (Math.random() < 0.15) {
                            this.burst(
                                building.x + Math.random() * def.size.w,
                                building.y + Math.random() * def.size.h,
                                '#c9a77a',
                                1,
                                'dust',
                            );
                        }
                    }
                },
            });
        }

        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                const feature = map.feature[map.index(x, y)];

                if (!feature || !this.visible(x, y)) {
                    continue;
                }

                if (feature === 1) {
                    for (let i = 0; i < 2; i++) {
                        const ox = 0.25 + hash2(x, y, i + 11) * 0.5;
                        const oy = 0.25 + hash2(x, y, i + 21) * 0.5;

                        items.push({
                            key: x + ox + y + oy,
                            draw: () =>
                                tree(
                                    ctx,
                                    x + ox,
                                    y + oy,
                                    0.85 + hash2(x, y, i + 31) * 0.4,
                                    hash2(x, y, i + 41) > 0.45,
                                    season.treeTint,
                                    season.snow,
                                ),
                        });
                    }
                } else if (feature === 2) {
                    items.push({
                        key: x + y + 1,
                        draw: () => this.rock(x, y, season.snow),
                    });
                } else {
                    items.push({
                        key: x + y + 1,
                        draw: () => this.reeds(x, y),
                    });
                }
            }
        }

        for (const npc of game.npcs.residents) {
            if (
                game.npcs.isVisible(npc) &&
                this.visible(npc.x - 0.5, npc.y - 0.5)
            ) {
                items.push({
                    key: npc.x + npc.y + 0.05,
                    draw: () =>
                        this.drawPerson(
                            game,
                            npc,
                            npc.uid === overlay.selectedNpc,
                            night,
                        ),
                });
            }
        }

        for (const vehicle of game.npcs.vehicles) {
            const fx =
                vehicle.x +
                0.5 +
                (vehicle.nx - vehicle.x) * vehicle.p +
                vehicle.px;
            const fy =
                vehicle.y +
                0.5 +
                (vehicle.ny - vehicle.y) * vehicle.p +
                vehicle.py;

            items.push({
                key: fx + fy + 0.05,
                draw: () =>
                    this.drawVehicle(
                        vehicle.type.vehicle ?? 'cart',
                        vehicle.color,
                        fx,
                        fy,
                        vehicle.nx !== vehicle.x,
                        night,
                    ),
            });
        }

        if (overlay.ghost) {
            const def = game.content.building(overlay.ghost.type);
            const level = overlay.ghost.moving
                ? (game.buildings.get(overlay.ghost.moving)?.level ?? 1)
                : 1;

            if (def.render !== 'road') {
                items.push({
                    key:
                        overlay.ghost.x +
                        overlay.ghost.y +
                        (def.size.w + def.size.h) / 2 +
                        0.01,
                    draw: () => {
                        ctx.globalAlpha = overlay.ghost!.ok ? 0.72 : 0.4;
                        drawModel(game.content.level(def, level).model.parts, {
                            ctx,
                            x: overlay.ghost!.x,
                            y: overlay.ghost!.y,
                            palette,
                            seed: 1,
                            time: this.time,
                            night: false,
                            grow: 1,
                            snow: 0,
                            treeTint: season.treeTint,
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
            const steam = emitter.kind === 'steam';
            const water = emitter.kind === 'water';

            if (Math.random() < (water ? 0.5 : steam ? 0.07 : 0.045)) {
                this.particles.push({
                    x: emitter.x,
                    y: emitter.y,
                    z: emitter.z,
                    vx: water
                        ? (Math.random() - 0.5) * 0.3
                        : 0.05 + Math.random() * 0.08,
                    vy: water
                        ? (Math.random() - 0.5) * 0.3
                        : -0.05 - Math.random() * 0.05,
                    vz: water ? 16 : 12 + Math.random() * 8,
                    life: water ? 0.8 : 3,
                    max: water ? 0.8 : 3,
                    size: steam ? 5 : water ? 1.5 : 3,
                    grow: steam ? 5 : water ? 0 : 3,
                    color: steam
                        ? '235,238,240'
                        : water
                          ? '#9fd8f5'
                          : emitter.kind === 'dust'
                            ? '170,150,120'
                            : '110,108,105',
                    kind: water ? 'water' : 'smoke',
                });
            }
        }
    }

    private rock(x: number, y: number, snow: number): void {
        for (let i = 0; i < 3; i++) {
            const ox = x + 0.2 + hash2(x, y, i) * 0.6;
            const oy = y + 0.2 + hash2(y, x, i + 9) * 0.6;
            const size = 0.12 + hash2(x, y, i + 30) * 0.12;
            const h = 6 + hash2(x, y, i + 40) * 10;

            pyramid(
                this.ctx,
                ox - size,
                oy - size,
                ox + size,
                oy + size,
                0,
                h,
                snow > 0.3 ? '#dfe6ea' : i % 2 ? '#9a958d' : '#aaa59c',
            );
        }
    }

    private reeds(x: number, y: number): void {
        const ctx = this.ctx;

        for (let i = 0; i < 5; i++) {
            const [sx, sy] = P(
                x + 0.15 + hash2(x, y, i) * 0.7,
                y + 0.15 + hash2(y, x, i) * 0.7,
            );
            const sway = Math.sin(this.time * 2 + i + x) * 1.2;

            line(ctx, [sx, sy], [sx + sway, sy - 8], '#6f8a3a', 1);
            ctx.fillStyle = '#7a5a2a';
            ctx.fillRect(sx + sway - 0.8, sy - 10, 1.6, 3);
        }
    }

    private drawPerson(
        game: Game,
        npc: NpcState,
        selected: boolean,
        night: boolean,
    ): void {
        const ctx = this.ctx;
        const type = game.npcs.typeOf(npc);
        const [sx, sy] = P(npc.x, npc.y, 0.5);
        const step = Math.sin((npc.x + npc.y) * 14) * 0.8;
        const body =
            type.body[Math.floor(hash2(npc.uid, 1) * type.body.length)];
        const skin =
            type.skin?.[Math.floor(hash2(npc.uid, 2) * type.skin.length)] ??
            '#f1c9a0';

        if (selected) {
            ctx.strokeStyle = '#ffd75a';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(sx, sy, 5, 2.5, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(sx - 2, sy - 0.5, 4, 1.5);
        ctx.fillStyle = shade(body, -0.25);
        ctx.fillRect(sx - 1.4, sy - 3 + step * 0.3, 1.2, 3);
        ctx.fillRect(sx + 0.2, sy - 3 - step * 0.3, 1.2, 3);
        ctx.fillStyle = body;
        ctx.fillRect(sx - 1.8, sy - 7.5, 3.6, 4.8);
        ctx.fillStyle = skin;
        ctx.beginPath();
        ctx.arc(sx, sy - 9, 1.7, 0, Math.PI * 2);
        ctx.fill();

        if (type.hat) {
            ctx.fillStyle = type.hat;
            ctx.fillRect(sx - 2, sy - 11, 4, 1.4);
        }

        if (type.glow) {
            ctx.fillStyle = type.glow;
            ctx.fillRect(sx - 1.8, sy - 6, 3.6, 0.8);

            if (night) {
                this.glows.push({
                    x: npc.x,
                    y: npc.y,
                    z: 6,
                    radius: 0.35,
                    color: type.glow,
                });
            }
        }
    }

    private drawVehicle(
        kind: 'cart' | 'car' | 'hover',
        color: string,
        fx: number,
        fy: number,
        alongX: boolean,
        night: boolean,
    ): void {
        const ctx = this.ctx;
        const half = kind === 'cart' ? 0.17 : 0.2;
        const across = 0.1;
        const x0 = fx - (alongX ? half : across);
        const x1 = fx + (alongX ? half : across);
        const y0 = fy - (alongX ? across : half);
        const y1 = fy + (alongX ? across : half);

        if (kind === 'cart') {
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
        } else if (kind === 'car') {
            box(ctx, x0, y0, x1, y1, 1, 3.5, color);
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

            if (night) {
                this.glows.push({
                    x: fx,
                    y: fy,
                    z: 2,
                    radius: 0.5,
                    color: '#fff2c0',
                });
            }
        } else {
            const hover = 14 + Math.sin(this.time * 3 + fx) * 2;
            const [shx, shy] = P(fx, fy);

            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.beginPath();
            ctx.ellipse(shx, shy, 6, 3, 0, 0, Math.PI * 2);
            ctx.fill();
            box(ctx, x0, y0, x1, y1, hover, 3, color);
            box(
                ctx,
                x0 + 0.05,
                y0 + 0.05,
                x1 - 0.05,
                y1 - 0.05,
                hover + 3,
                2,
                '#bff3ff',
            );
            this.glows.push({
                x: fx,
                y: fy,
                z: hover,
                radius: 0.4,
                color: '#35e0d0',
            });
        }
    }

    private scaffold(
        def: BuildingDef,
        building: BuildingState,
        upgrading: boolean,
    ): void {
        const ctx = this.ctx;
        const { w, h } = def.size;
        const height = 26 * Math.max(w, h);
        const color = upgrading
            ? 'rgba(200,170,60,0.9)'
            : 'rgba(122,84,44,0.9)';
        const corners: [number, number][] = [
            [building.x + 0.1, building.y + h - 0.1],
            [building.x + w - 0.1, building.y + h - 0.1],
            [building.x + w - 0.1, building.y + 0.1],
        ];

        for (const [x, y] of corners) {
            line(ctx, P(x, y), P(x, y, height), color, 1.2);
        }

        for (let z = 8; z < height; z += 9) {
            line(ctx, P(...corners[0], z), P(...corners[1], z), color, 1);
            line(ctx, P(...corners[1], z), P(...corners[2], z), color, 1);
        }
    }

    private progressBar(
        def: BuildingDef,
        building: BuildingState,
        progress: number,
        upgrading: boolean,
    ): void {
        const ctx = this.ctx;
        const [sx, sy] = P(
            building.x + def.size.w / 2,
            building.y + def.size.h / 2,
            30 * Math.max(def.size.w, def.size.h) + 10,
        );

        ctx.fillStyle = 'rgba(20,20,25,0.7)';
        ctx.fillRect(sx - 16, sy, 32, 5);
        ctx.fillStyle = upgrading ? '#ffd75a' : '#6ad18a';
        ctx.fillRect(sx - 15, sy + 1, 30 * progress, 3);
    }

    private drawWarnings(game: Game): void {
        const ctx = this.ctx;

        ctx.font = '12px system-ui, "Segoe UI Emoji", sans-serif';
        ctx.textAlign = 'center';

        for (const building of game.buildings.values()) {
            const def = game.def(building);
            const status = game.status.get(building.uid);

            if (def.render === 'road' || !status?.complete) {
                continue;
            }

            const effects = game.effects(building);
            const icon = !status.connected
                ? '🚧'
                : status.noPower
                  ? '⚡'
                  : status.starved
                    ? '📦'
                    : effects.jobs && status.efficiency < 0.5
                      ? '👷'
                      : '';

            if (!icon) {
                continue;
            }

            const [sx, sy] = P(
                building.x + def.size.w / 2,
                building.y + def.size.h / 2,
                modelHeight(game.levelDef(building).model.parts) + 14,
            );
            const bob = Math.sin(this.time * 3 + building.uid) * 2;

            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.beginPath();
            ctx.arc(sx, sy + bob - 4, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillText(icon, sx, sy + bob);
        }
    }

    private updateParticles(dt: number): void {
        const ctx = this.ctx;

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

            if (p.kind === 'dust' || p.kind === 'spark' || p.kind === 'water') {
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
            } else {
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.fillRect(
                    sx - p.size / 2,
                    sy - p.size / 2,
                    p.size,
                    p.kind === 'confetti'
                        ? 2 + Math.sin(p.life * 10) * 1.5
                        : p.size,
                );
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

    /**
     * Darkness and colour of the hour: a dark layer with holes punched
     * where windows, lamps and headlights glow, then the glows themselves.
     */
    private drawLighting(light: ReturnType<Game['clock']['light']>): void {
        const ctx = this.ctx;
        const darkness = Math.max(0, 1 - light.level);

        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        if (light.tint && light.tintStrength > 0.02) {
            ctx.globalCompositeOperation = 'soft-light';
            ctx.globalAlpha = light.tintStrength;
            ctx.fillStyle = light.tint;
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }

        if (darkness < 0.03) {
            return;
        }

        const lc = this.lightCanvas.getContext('2d')!;
        const z = this.camera.zoom;

        lc.setTransform(1, 0, 0, 1, 0, 0);
        lc.globalCompositeOperation = 'source-over';
        lc.clearRect(0, 0, this.lightCanvas.width, this.lightCanvas.height);
        lc.fillStyle = `rgba(8, 14, 40, ${Math.min(0.78, darkness * 1.05)})`;
        lc.fillRect(0, 0, this.lightCanvas.width, this.lightCanvas.height);
        lc.globalCompositeOperation = 'destination-out';

        for (const g of this.glows) {
            const [sx, sy] = this.worldToScreen(g.x, g.y, g.z);
            const r = Math.max(6, g.radius * HW * z) * this.dpr;
            const gradient = lc.createRadialGradient(
                sx * this.dpr,
                sy * this.dpr,
                0,
                sx * this.dpr,
                sy * this.dpr,
                r,
            );

            gradient.addColorStop(0, 'rgba(0,0,0,0.85)');
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            lc.fillStyle = gradient;
            lc.fillRect(sx * this.dpr - r, sy * this.dpr - r, r * 2, r * 2);
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(this.lightCanvas, 0, 0);
        ctx.globalCompositeOperation = 'lighter';

        for (const g of this.glows) {
            const [sx, sy] = this.worldToScreen(g.x, g.y, g.z);
            const r = Math.max(4, g.radius * HW * z * 0.6) * this.dpr;
            const gradient = ctx.createRadialGradient(
                sx * this.dpr,
                sy * this.dpr,
                0,
                sx * this.dpr,
                sy * this.dpr,
                r,
            );

            gradient.addColorStop(0, `${g.color}55`);
            gradient.addColorStop(1, `${g.color}00`);
            ctx.fillStyle = gradient;
            ctx.fillRect(sx * this.dpr - r, sy * this.dpr - r, r * 2, r * 2);
        }

        ctx.globalCompositeOperation = 'source-over';
    }

    private drawWeather(game: Game, dt: number): void {
        const ctx = this.ctx;
        const particles = game.weather?.particles;

        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        if (!particles) {
            this.weatherDrops = [];

            return;
        }

        if (particles.kind === 'fog') {
            ctx.fillStyle = `rgba(225, 230, 235, ${0.25 * particles.density})`;
            ctx.fillRect(0, 0, this.width, this.height);

            return;
        }

        const target = Math.floor(
            ((this.width * this.height) / 2600) * particles.density,
        );

        while (this.weatherDrops.length < target) {
            this.weatherDrops.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                s: 0.6 + Math.random() * 0.8,
            });
        }

        this.weatherDrops.length = Math.min(this.weatherDrops.length, target);

        const rain = particles.kind === 'rain';

        ctx.strokeStyle = 'rgba(200, 215, 235, 0.55)';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1;

        for (const drop of this.weatherDrops) {
            if (rain) {
                drop.x -= 120 * dt * drop.s;
                drop.y += 700 * dt * drop.s;
                ctx.beginPath();
                ctx.moveTo(drop.x, drop.y);
                ctx.lineTo(drop.x + 3, drop.y - 12 * drop.s);
                ctx.stroke();
            } else {
                drop.x += Math.sin(this.time + drop.s * 10) * 20 * dt;
                drop.y += 50 * dt * drop.s;
                ctx.beginPath();
                ctx.arc(drop.x, drop.y, 1.4 * drop.s, 0, Math.PI * 2);
                ctx.fill();
            }

            if (drop.y > this.height) {
                drop.y = -10;
                drop.x = Math.random() * (this.width + 100);
            }

            if (drop.x < -10) {
                drop.x = this.width + 10;
            }
        }
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
