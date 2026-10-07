/**
 * One drawing per building shape. Every drawing reads the era's style and
 * the building's level, so upgrading or entering a new era visibly
 * changes it: more floors, chimneys, flags, new materials.
 */

import type { BuildingDef } from '../engine/data';
import { tileHash } from '../engine/map';
import type { Building } from '../engine/sim';
import {
    P,
    box,
    cone,
    cylinder,
    dome,
    door,
    flag,
    gable,
    line,
    poly,
    pyramid,
    rect,
    shade,
    windows,
} from './iso';
import type { Ctx } from './iso';
import type { EpochStyle } from './style';

export interface DrawInfo {
    b: Building;
    def: BuildingDef;
    epoch: number;
    style: EpochStyle;
    /** Seconds, for animation. */
    t: number;
    /** 0..1 while under construction: walls rise with it. */
    grow: number;
    emit: (x: number, y: number, z: number, kind: 'smoke' | 'steam') => void;
    /** Direction of the water a harbour faces. */
    water?: [number, number];
    ctx: Ctx;
}

function wallOf(info: DrawInfo): string {
    const { style, b } = info;

    return style.walls
        ? style.walls[Math.floor(tileHash(b.x, b.y, 7) * style.walls.length)]
        : style.wall;
}

function lit(info: DrawInfo, salt: number): string {
    const night = info.epoch >= 6;

    return night && tileHash(info.b.x * 31 + salt, info.b.y, 3) > 0.55
        ? info.style.lit
        : info.style.window;
}

function roofFor(
    info: DrawInfo,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    z: number,
    rh: number,
    wall: string,
): void {
    if (info.grow < 0.65) {
        return;
    }

    if (info.style.flatRoofs) {
        box(
            info.ctx,
            x0 - 0.03,
            y0 - 0.03,
            x1 + 0.03,
            y1 + 0.03,
            z,
            2,
            shade(info.style.roof, 0.1),
        );

        return;
    }

    const axis = tileHash(info.b.x, info.b.y, 2) > 0.5 ? 'x' : 'y';

    gable(info.ctx, x0, y0, x1, y1, z, rh, info.style.roof, wall, axis);
}

function house(info: DrawInfo): void {
    const { ctx, b, def, grow, epoch } = info;
    const big = def.id === 'stone_house';
    const wall =
        big && epoch < 5
            ? epoch >= 2
                ? '#b0a89c'
                : info.style.wall
            : wallOf(info);
    const level = b.level;
    const x0 = b.x + (big ? 0.16 : 0.22);
    const y0 = b.y + (big ? 0.16 : 0.22);
    const x1 = b.x + (big ? 0.84 : 0.78);
    const y1 = b.y + (big ? 0.84 : 0.78);
    const h = ((big ? 20 : 11) + (level - 1) * (big ? 7 : 5)) * grow;

    if (level >= 2 && !big) {
        box(
            ctx,
            b.x + 0.55,
            b.y + 0.12,
            b.x + 0.9,
            b.y + 0.45,
            0,
            8 * grow,
            shade(wall, -0.05),
        );
        roofFor(
            info,
            b.x + 0.55,
            b.y + 0.12,
            b.x + 0.9,
            b.y + 0.45,
            8 * grow,
            6,
            wall,
        );
    }

    box(ctx, x0, y0, x1, y1, 0, h, wall);

    if (epoch <= 1 && !big) {
        // Log walls.
        for (let i = 1; i < 4; i++) {
            line(
                ctx,
                P(x0, y1, (h * i) / 4),
                P(x1, y1, (h * i) / 4),
                shade(wall, -0.18),
            );
        }
    }

    const floors = Math.max(1, Math.round(h / 11));

    windows(
        ctx,
        'left',
        x0,
        y0,
        x1,
        y1,
        2,
        h - 3,
        floors,
        big ? 2 : 1,
        (row, col) => lit(info, row * 3 + col),
    );
    windows(
        ctx,
        'right',
        x0,
        y0,
        x1,
        y1,
        2,
        h - 3,
        floors,
        big ? 2 : 1,
        (row, col) => shade(lit(info, row * 5 + col + 9), -0.15),
    );
    door(
        ctx,
        'left',
        x0,
        y0,
        x1,
        y1,
        0,
        0.14,
        Math.min(7, h * 0.55),
        info.style.trim,
    );

    roofFor(info, x0, y0, x1, y1, h, big ? 12 : 9, wall);

    if (level >= 3 && grow >= 1 && !info.style.flatRoofs) {
        box(
            ctx,
            x0 + 0.08,
            y0 + 0.1,
            x0 + 0.2,
            y0 + 0.22,
            h,
            12,
            shade(wall, -0.25),
        );
        info.emit(x0 + 0.14, y0 + 0.16, h + 13, 'smoke');
    }
}

function tower(info: DrawInfo): void {
    const { ctx, b, def, grow, epoch } = info;
    const size = def.size;
    const kind = def.id;
    const floors =
        kind === 'tenement'
            ? 3 + b.level
            : kind === 'apartment'
              ? 5 + b.level * 2
              : 12 + b.level * 5;
    const floorH = kind === 'skyscraper' ? 6.5 : 8;
    const wall =
        kind === 'tenement'
            ? epoch >= 7
                ? '#a65a42'
                : wallOf(info)
            : kind === 'apartment'
              ? '#d6d3cb'
              : '#7fb6d8';
    const inset = size === 2 ? 0.25 : 0.12;
    const x0 = b.x + inset;
    const y0 = b.y + inset;
    const x1 = b.x + size - inset;
    const y1 = b.y + size - inset;
    const h = floors * floorH * grow;

    box(ctx, x0, y0, x1, y1, 0, h, wall);

    const cols = size === 2 ? 6 : 3;
    const rows = Math.max(1, Math.floor(h / floorH));

    if (kind === 'skyscraper') {
        for (let row = 0; row < rows; row += 1) {
            const z = row * floorH;

            poly(
                ctx,
                [
                    P(x0, y1, z + 1),
                    P(x1, y1, z + 1),
                    P(x1, y1, z + floorH - 1),
                    P(x0, y1, z + floorH - 1),
                ],
                row % 2 ? '#a6d4ec' : '#94c7e3',
            );
            poly(
                ctx,
                [
                    P(x1, y0, z + 1),
                    P(x1, y1, z + 1),
                    P(x1, y1, z + floorH - 1),
                    P(x1, y0, z + floorH - 1),
                ],
                row % 2 ? '#6c9fbe' : '#5f93b3',
            );
        }

        // Lit floors at random.
        windows(ctx, 'left', x0, y0, x1, y1, 0, h, rows, cols, (row, col) =>
            tileHash(b.x * 13 + row, b.y + col, 5) > 0.82
                ? info.style.lit
                : 'rgba(0,0,0,0)',
        );
    } else {
        windows(ctx, 'left', x0, y0, x1, y1, 0, h, rows, cols, (row, col) =>
            lit(info, row * 7 + col),
        );
        windows(ctx, 'right', x0, y0, x1, y1, 0, h, rows, cols, (row, col) =>
            shade(lit(info, row * 11 + col + 3), -0.2),
        );
    }

    door(ctx, 'left', x0, y0, x1, y1, 0, 0.16, 6, shade(wall, -0.45));

    if (grow < 1) {
        return;
    }

    if (kind === 'tenement') {
        box(ctx, x0 - 0.03, y0 - 0.03, x1 + 0.03, y1 + 0.03, h, 2, '#4a4a4f');
        box(
            ctx,
            x0 + 0.1,
            y0 + 0.1,
            x0 + 0.24,
            y0 + 0.24,
            h + 2,
            10,
            '#6b3326',
        );
        info.emit(x0 + 0.17, y0 + 0.17, h + 13, 'smoke');
    } else if (kind === 'apartment') {
        box(ctx, x0 - 0.02, y0 - 0.02, x1 + 0.02, y1 + 0.02, h, 2, '#8d8f94');
        box(
            ctx,
            x0 + 0.15,
            y0 + 0.15,
            x0 + 0.4,
            y0 + 0.35,
            h + 2,
            6,
            '#9fa2a8',
        );
    } else {
        box(ctx, x0 + 0.3, y0 + 0.3, x1 - 0.3, y1 - 0.3, h, 10, '#5d7e95');
        line(
            ctx,
            P((x0 + x1) / 2, (y0 + y1) / 2, h + 10),
            P((x0 + x1) / 2, (y0 + y1) / 2, h + 34),
            '#d9e2e8',
            1.5,
        );

        const blink = Math.sin(info.t * 3) > 0 ? '#ff4a4a' : '#7a1a1a';
        const [sx, sy] = P((x0 + x1) / 2, (y0 + y1) / 2, h + 34);

        ctx.fillStyle = blink;
        ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
    }
}

function center(info: DrawInfo): void {
    const { ctx, b, grow, epoch, style, t } = info;
    const x0 = b.x + 0.2;
    const y0 = b.y + 0.2;
    const x1 = b.x + 1.8;
    const y1 = b.y + 1.8;

    poly(
        ctx,
        rect(b.x + 0.05, b.y + 0.05, b.x + 1.95, b.y + 1.95),
        style.plaza,
    );

    if (epoch <= 1) {
        const h = (epoch === 0 ? 14 : 18) * grow;

        box(
            ctx,
            b.x + 0.3,
            b.y + 0.45,
            b.x + 1.7,
            b.y + 1.55,
            0,
            h,
            style.wall,
        );
        windows(
            ctx,
            'left',
            b.x + 0.3,
            b.y + 0.45,
            b.x + 1.7,
            b.y + 1.55,
            2,
            h - 4,
            1,
            4,
            style.window,
        );
        door(
            ctx,
            'left',
            b.x + 0.3,
            b.y + 0.45,
            b.x + 1.7,
            b.y + 1.55,
            0,
            0.22,
            9,
            style.trim,
        );
        gable(
            ctx,
            b.x + 0.3,
            b.y + 0.45,
            b.x + 1.7,
            b.y + 1.55,
            h,
            18,
            style.roof,
            style.wall,
            'x',
        );
        flag(ctx, b.x + 1.75, b.y + 1.7, 0, 34, style.flag, t);

        // Bonfire.
        const [fx, fy] = P(b.x + 0.35, b.y + 1.75);

        ctx.fillStyle = `rgba(255,${140 + Math.sin(t * 9) * 40},40,0.9)`;
        ctx.beginPath();
        ctx.ellipse(fx, fy - 3, 3, 4 + Math.sin(t * 11), 0, 0, Math.PI * 2);
        ctx.fill();

        return;
    }

    if (epoch <= 4) {
        const wall = epoch >= 3 ? '#cfc6b4' : '#aaa39a';
        const h = (26 + epoch * 3) * grow;

        box(
            ctx,
            x0 + 0.1,
            y0 + 0.1,
            x1 - 0.1,
            y1 - 0.1,
            0,
            h * 0.55,
            shade(wall, -0.05),
        );
        box(
            ctx,
            b.x + 0.65,
            b.y + 0.65,
            b.x + 1.35,
            b.y + 1.35,
            h * 0.55,
            h * 0.7,
            wall,
        );
        windows(
            ctx,
            'left',
            b.x + 0.65,
            b.y + 0.65,
            b.x + 1.35,
            b.y + 1.35,
            h * 0.55,
            h * 0.6,
            2,
            2,
            style.window,
        );
        windows(
            ctx,
            'right',
            b.x + 0.65,
            b.y + 0.65,
            b.x + 1.35,
            b.y + 1.35,
            h * 0.55,
            h * 0.6,
            2,
            2,
            style.window,
        );
        door(
            ctx,
            'left',
            x0 + 0.1,
            y0 + 0.1,
            x1 - 0.1,
            y1 - 0.1,
            0,
            0.3,
            11,
            '#3b2b20',
        );

        if (grow >= 0.65) {
            pyramid(
                ctx,
                b.x + 0.62,
                b.y + 0.62,
                b.x + 1.38,
                b.y + 1.38,
                h * 1.25,
                18,
                style.roof,
            );

            for (const [cx, cy] of [
                [x0 + 0.15, y0 + 0.15],
                [x1 - 0.15, y0 + 0.15],
                [x0 + 0.15, y1 - 0.15],
                [x1 - 0.15, y1 - 0.15],
            ]) {
                cylinder(ctx, cx, cy, 0.17, 0, h * 0.8, wall);
                cone(ctx, cx, cy, 0.2, h * 0.8, 14, style.roof);
            }

            flag(ctx, b.x + 1, b.y + 1, h * 1.25 + 18, 16, style.flag, t);
        }

        return;
    }

    if (epoch === 5) {
        const wall = '#efe6d2';
        const h = 24 * grow;

        box(ctx, x0, y0 + 0.3, x1, y1 - 0.3, 0, h, wall);
        windows(
            ctx,
            'left',
            x0,
            y0 + 0.3,
            x1,
            y1 - 0.3,
            2,
            h - 4,
            2,
            7,
            style.window,
        );
        windows(
            ctx,
            'right',
            x0,
            y0 + 0.3,
            x1,
            y1 - 0.3,
            2,
            h - 4,
            2,
            3,
            style.window,
        );

        if (grow >= 0.65) {
            box(
                ctx,
                x0 - 0.02,
                y0 + 0.28,
                x1 + 0.02,
                y1 - 0.28,
                h,
                3,
                '#c7b99a',
            );
            cylinder(ctx, b.x + 1, b.y + 1, 0.38, h + 3, 8, wall);
            dome(ctx, b.x + 1, b.y + 1, 0.38, h + 11, '#5f8f7e');
            flag(ctx, b.x + 1, b.y + 1, h + 30, 14, style.flag, t);
        }

        return;
    }

    // City hall with a clock tower; glass in the megalopolis.
    const glass = epoch >= 8;
    const wall = glass ? '#9fcbe3' : epoch === 6 ? '#a8573f' : '#d9d5cc';
    const h = (glass ? 34 : 26) * grow;

    box(ctx, x0, y0 + 0.25, x1, y1 - 0.25, 0, h, wall);
    windows(
        ctx,
        'left',
        x0,
        y0 + 0.25,
        x1,
        y1 - 0.25,
        2,
        h - 4,
        glass ? 5 : 3,
        8,
        (r, c) => lit(info, r * 9 + c),
    );
    windows(
        ctx,
        'right',
        x0,
        y0 + 0.25,
        x1,
        y1 - 0.25,
        2,
        h - 4,
        glass ? 5 : 3,
        3,
        (r, c) => lit(info, r * 4 + c + 40),
    );
    door(
        ctx,
        'left',
        x0,
        y0 + 0.25,
        x1,
        y1 - 0.25,
        0,
        0.3,
        10,
        shade(wall, -0.5),
    );

    if (grow < 0.65) {
        return;
    }

    if (glass) {
        box(ctx, b.x + 0.7, b.y + 0.6, b.x + 1.3, b.y + 1.2, h, 46, '#7fb0cf');
        windows(
            ctx,
            'left',
            b.x + 0.7,
            b.y + 0.6,
            b.x + 1.3,
            b.y + 1.2,
            h,
            46,
            8,
            3,
            (r, c) => (tileHash(r, c, 9) > 0.6 ? style.lit : '#5d8fb0'),
        );
        line(
            ctx,
            P(b.x + 1, b.y + 0.9, h + 46),
            P(b.x + 1, b.y + 0.9, h + 70),
            '#e6eef3',
            1.5,
        );
        flag(ctx, b.x + 1.75, b.y + 1.75, 0, 30, style.flag, t);
    } else {
        box(
            ctx,
            x0 - 0.02,
            y0 + 0.23,
            x1 + 0.02,
            y1 - 0.23,
            h,
            3,
            shade(wall, -0.2),
        );
        box(ctx, b.x + 0.75, b.y + 0.75, b.x + 1.25, b.y + 1.25, h, 30, wall);
        pyramid(
            ctx,
            b.x + 0.72,
            b.y + 0.72,
            b.x + 1.28,
            b.y + 1.28,
            h + 30,
            16,
            style.roof,
        );

        const [cx, cy] = P(b.x + 1, b.y + 1.25, h + 22);

        ctx.fillStyle = '#f4efe1';
        ctx.beginPath();
        ctx.arc(cx - 4, cy, 4, 0, Math.PI * 2);
        ctx.fill();
        line(
            ctx,
            [cx - 4, cy],
            [cx - 4 + Math.cos(t / 2) * 3, cy + Math.sin(t / 2) * 3],
            '#222',
            1,
        );
        flag(ctx, b.x + 1, b.y + 1, h + 46, 14, style.flag, t);
    }
}

function farm(info: DrawInfo): void {
    const { ctx, b, grow, style, epoch } = info;
    const rows = 7;
    const crop = style.crop;

    poly(ctx, rect(b.x + 0.05, b.y + 0.05, b.x + 1.95, b.y + 1.95), '#8a6a3e');

    for (let i = 0; i < rows; i++) {
        const y0 = b.y + 0.1 + (i * 1.8) / rows;
        const y1 = y0 + 1.8 / rows - 0.06;
        const grown = Math.min(1, grow * 1.4 + (i % 2) * 0.1);
        const color = i % 2 ? shade(crop, -0.08) : crop;

        poly(
            ctx,
            rect(b.x + 0.1, y0, b.x + (i < 3 ? 1.05 : 1.9), y1, 2 * grown),
            color,
        );
    }

    if (grow < 0.3) {
        return;
    }

    const barnWall = epoch >= 6 ? '#a35a46' : '#a0482f';
    const h = (12 + b.level * 3) * grow;

    box(ctx, b.x + 1.15, b.y + 0.12, b.x + 1.85, b.y + 0.8, 0, h, barnWall);
    door(
        ctx,
        'left',
        b.x + 1.15,
        b.y + 0.12,
        b.x + 1.85,
        b.y + 0.8,
        0,
        0.25,
        8,
        '#5b2a1c',
    );
    gable(
        ctx,
        b.x + 1.15,
        b.y + 0.12,
        b.x + 1.85,
        b.y + 0.8,
        h,
        10,
        epoch >= 7 ? '#6d7177' : '#7b3d2b',
        barnWall,
        'y',
    );

    if (b.level >= 2) {
        cylinder(ctx, b.x + 0.35, b.y + 1.7, 0.12, 0, 6, '#e0c25a');
        cone(ctx, b.x + 0.35, b.y + 1.7, 0.13, 6, 6, '#d1b04a');
    }

    if (b.level >= 3) {
        const silo = epoch >= 6 ? '#b9bfc6' : '#c9b48a';

        cylinder(ctx, b.x + 1.75, b.y + 1.05, 0.16, 0, 28, silo);
        dome(ctx, b.x + 1.75, b.y + 1.05, 0.16, 28, shade(silo, -0.1));
    }
}

function greenhouse(info: DrawInfo): void {
    const { ctx, b, grow } = info;

    poly(ctx, rect(b.x + 0.05, b.y + 0.05, b.x + 1.95, b.y + 1.95), '#9aa39a');

    for (let i = 0; i < 3; i++) {
        const y0 = b.y + 0.15 + i * 0.6;

        ctx.globalAlpha = 0.85;
        box(
            ctx,
            b.x + 0.15,
            y0,
            b.x + 1.85,
            y0 + 0.45,
            0,
            10 * grow,
            '#bfe6d8',
            '#e3f6ef',
        );
        poly(
            ctx,
            rect(b.x + 0.2, y0 + 0.05, b.x + 1.8, y0 + 0.4, 1),
            '#4f9a4a',
        );
        ctx.globalAlpha = 1;
    }
}

function lumber(info: DrawInfo): void {
    const { ctx, b, grow, style } = info;
    const h = (10 + b.level * 2) * grow;

    box(ctx, b.x + 0.15, b.y + 0.15, b.x + 0.6, b.y + 0.6, 0, h, style.wall);
    roofFor(
        info,
        b.x + 0.15,
        b.y + 0.15,
        b.x + 0.6,
        b.y + 0.6,
        h,
        7,
        style.wall,
    );

    const logs = 2 + b.level;

    for (let i = 0; i < logs; i++) {
        const z = Math.floor(i / 2) * 3;
        const y = b.y + 0.68 + (i % 2) * 0.12;

        box(ctx, b.x + 0.2, y, b.x + 0.85, y + 0.1, z, 3, '#8a5a2b', '#c99a64');
    }

    // Saw blade.
    const [sx, sy] = P(b.x + 0.8, b.y + 0.35, 6);

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(info.t * 4);
    ctx.fillStyle = '#c8ccd2';
    ctx.beginPath();

    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;

        ctx.lineTo(Math.cos(a) * 5, Math.sin(a) * 5);
        ctx.lineTo(Math.cos(a + 0.4) * 3.5, Math.sin(a + 0.4) * 3.5);
    }

    ctx.fill();
    ctx.restore();
}

function quarry(info: DrawInfo): void {
    const { ctx, b, grow } = info;

    poly(ctx, rect(b.x + 0.08, b.y + 0.08, b.x + 0.92, b.y + 0.92), '#7d776f');
    poly(
        ctx,
        rect(b.x + 0.25, b.y + 0.25, b.x + 0.75, b.y + 0.75, -4),
        '#5d5852',
    );

    for (let i = 0; i < 2 + b.level; i++) {
        const ox = tileHash(b.x, b.y, i) * 0.55;
        const oy = tileHash(b.y, b.x, i + 4) * 0.55;

        box(
            ctx,
            b.x + 0.15 + ox,
            b.y + 0.15 + oy,
            b.x + 0.32 + ox,
            b.y + 0.3 + oy,
            0,
            5 * grow,
            '#c4bfb6',
        );
    }

    if (b.level >= 3) {
        line(
            ctx,
            P(b.x + 0.85, b.y + 0.85),
            P(b.x + 0.85, b.y + 0.85, 30),
            '#6b4a2b',
            2,
        );
        line(
            ctx,
            P(b.x + 0.85, b.y + 0.85, 30),
            P(b.x + 0.4, b.y + 0.4, 26),
            '#6b4a2b',
            2,
        );
        line(
            ctx,
            P(b.x + 0.4, b.y + 0.4, 26),
            P(b.x + 0.4, b.y + 0.4, 10 + Math.sin(info.t) * 4),
            '#333',
            1,
        );
    }
}

function mine(info: DrawInfo): void {
    const { ctx, b, grow } = info;

    poly(ctx, rect(b.x + 0.08, b.y + 0.08, b.x + 0.92, b.y + 0.92), '#857b6c');
    box(
        ctx,
        b.x + 0.2,
        b.y + 0.15,
        b.x + 0.8,
        b.y + 0.55,
        0,
        12 * grow,
        '#6f655a',
    );
    door(
        ctx,
        'left',
        b.x + 0.2,
        b.y + 0.15,
        b.x + 0.8,
        b.y + 0.55,
        0,
        0.26,
        9,
        '#1d1915',
    );
    gable(
        ctx,
        b.x + 0.2,
        b.y + 0.15,
        b.x + 0.8,
        b.y + 0.55,
        12 * grow,
        6,
        '#5a4632',
        '#6f655a',
        'x',
    );
    line(
        ctx,
        P(b.x + 0.45, b.y + 0.55),
        P(b.x + 0.45, b.y + 1),
        '#4b3b2b',
        1.5,
    );
    line(
        ctx,
        P(b.x + 0.55, b.y + 0.55),
        P(b.x + 0.55, b.y + 1),
        '#4b3b2b',
        1.5,
    );

    const cart = 0.6 + (Math.sin(info.t * 0.8) + 1) * 0.15;

    box(
        ctx,
        b.x + 0.42,
        b.y + cart,
        b.x + 0.58,
        b.y + cart + 0.12,
        0,
        4,
        '#6b6b6b',
    );
    box(
        ctx,
        b.x + 0.44,
        b.y + cart + 0.02,
        b.x + 0.56,
        b.y + cart + 0.1,
        4,
        2,
        '#e3c25b',
    );
}

function well(info: DrawInfo): void {
    const { ctx, b, epoch, t } = info;

    if (epoch >= 5) {
        cylinder(ctx, b.x + 0.5, b.y + 0.5, 0.36, 0, 4, '#c9c3b6');
        ctx.beginPath();

        const [sx, sy] = P(b.x + 0.5, b.y + 0.5, 4);

        ctx.ellipse(sx, sy, 15, 7.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#5bb0dc';
        ctx.fill();
        cylinder(ctx, b.x + 0.5, b.y + 0.5, 0.06, 4, 10, '#c9c3b6');

        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + t;
            const [jx, jy] = P(
                b.x + 0.5 + Math.cos(a) * 0.15,
                b.y + 0.5 + Math.sin(a) * 0.15,
                14 + Math.sin(t * 4 + i) * 2,
            );

            ctx.fillStyle = 'rgba(200,235,255,0.8)';
            ctx.fillRect(jx - 1, jy - 1, 2, 2);
        }

        return;
    }

    cylinder(
        ctx,
        b.x + 0.5,
        b.y + 0.5,
        0.2,
        0,
        6,
        epoch >= 2 ? '#a9a39a' : '#8b7f6f',
    );
    line(
        ctx,
        P(b.x + 0.32, b.y + 0.5, 6),
        P(b.x + 0.32, b.y + 0.5, 18),
        '#5e3d22',
        1.5,
    );
    line(
        ctx,
        P(b.x + 0.68, b.y + 0.5, 6),
        P(b.x + 0.68, b.y + 0.5, 18),
        '#5e3d22',
        1.5,
    );
    pyramid(
        ctx,
        b.x + 0.25,
        b.y + 0.3,
        b.x + 0.75,
        b.y + 0.7,
        17,
        7,
        info.style.roof,
    );
}

function warehouse(info: DrawInfo): void {
    const { ctx, b, grow, style } = info;
    const wall = wallOf(info);
    const h = (12 + b.level * 4) * grow;

    box(ctx, b.x + 0.1, b.y + 0.18, b.x + 0.9, b.y + 0.82, 0, h, wall);
    door(
        ctx,
        'left',
        b.x + 0.1,
        b.y + 0.18,
        b.x + 0.9,
        b.y + 0.82,
        0,
        0.36,
        Math.min(10, h * 0.7),
        shade(style.trim, -0.2),
    );
    roofFor(info, b.x + 0.1, b.y + 0.18, b.x + 0.9, b.y + 0.82, h, 9, wall);

    if (grow >= 1) {
        box(
            ctx,
            b.x + 0.62,
            b.y + 0.84,
            b.x + 0.8,
            b.y + 0.98,
            0,
            5,
            '#9b7444',
        );
    }
}

function market(info: DrawInfo): void {
    const { ctx, b, grow, style, epoch } = info;

    poly(
        ctx,
        rect(b.x + 0.05, b.y + 0.05, b.x + 1.95, b.y + 1.95),
        style.plaza,
    );

    if (epoch >= 7) {
        const h = (14 + b.level * 4) * grow;

        box(ctx, b.x + 0.2, b.y + 0.2, b.x + 1.8, b.y + 1.8, 0, h, '#e6e2da');
        poly(
            ctx,
            [
                P(b.x + 0.2, b.y + 1.8, 2),
                P(b.x + 1.8, b.y + 1.8, 2),
                P(b.x + 1.8, b.y + 1.8, h - 4),
                P(b.x + 0.2, b.y + 1.8, h - 4),
            ],
            '#86c1e0',
        );
        box(
            ctx,
            b.x + 0.15,
            b.y + 0.15,
            b.x + 1.85,
            b.y + 1.85,
            h,
            3,
            '#d64545',
        );

        return;
    }

    const colors = ['#d64545', '#3f7fd6', '#e0a530', '#4aa35a'];
    const stalls = 2 + b.level;

    for (let i = 0; i < stalls; i++) {
        const x = b.x + 0.2 + (i % 3) * 0.55;
        const y = b.y + 0.25 + Math.floor(i / 3) * 0.8;
        const h = 8 * grow;

        box(ctx, x, y, x + 0.4, y + 0.4, 0, h, '#a8784a');

        if (grow >= 0.65) {
            const color = colors[(i + b.x) % colors.length];

            poly(
                ctx,
                [
                    P(x - 0.05, y - 0.05, h + 5),
                    P(x + 0.45, y - 0.05, h + 5),
                    P(x + 0.45, y + 0.45, h),
                    P(x - 0.05, y + 0.45, h),
                ],
                color,
            );
            poly(
                ctx,
                [
                    P(x + 0.12, y - 0.05, h + 5),
                    P(x + 0.22, y - 0.05, h + 5),
                    P(x + 0.22, y + 0.45, h),
                    P(x + 0.12, y + 0.45, h),
                ],
                '#f6f0e4',
            );
        }
    }

    if (b.level >= 3 && epoch >= 3) {
        cylinder(ctx, b.x + 1.6, b.y + 1.6, 0.15, 0, 3, '#c9c3b6');
    }
}

function chapel(info: DrawInfo): void {
    const { ctx, b, grow, style, epoch } = info;
    const wall = epoch >= 2 ? '#d6cfc2' : '#c9b79a';
    const h = (12 + b.level * 3) * grow;

    box(ctx, b.x + 0.2, b.y + 0.3, b.x + 0.8, b.y + 0.85, 0, h, wall);
    windows(
        ctx,
        'right',
        b.x + 0.2,
        b.y + 0.3,
        b.x + 0.8,
        b.y + 0.85,
        3,
        h - 5,
        1,
        2,
        '#5a7fa6',
    );
    gable(
        ctx,
        b.x + 0.2,
        b.y + 0.3,
        b.x + 0.8,
        b.y + 0.85,
        h,
        10,
        style.roof,
        wall,
        'y',
    );

    if (grow >= 0.65) {
        const th = h + 10 + b.level * 4;

        box(ctx, b.x + 0.38, b.y + 0.1, b.x + 0.62, b.y + 0.34, 0, th, wall);
        pyramid(
            ctx,
            b.x + 0.36,
            b.y + 0.08,
            b.x + 0.64,
            b.y + 0.36,
            th,
            16,
            style.roof,
        );
        line(
            ctx,
            P(b.x + 0.5, b.y + 0.22, th + 16),
            P(b.x + 0.5, b.y + 0.22, th + 23),
            '#d9b84a',
            1.5,
        );
    }
}

function cathedral(info: DrawInfo): void {
    const { ctx, b, grow, style } = info;
    const wall = '#d9d1c1';
    const h = (24 + b.level * 4) * grow;

    box(ctx, b.x + 0.45, b.y + 0.55, b.x + 1.55, b.y + 1.9, 0, h, wall);
    windows(
        ctx,
        'right',
        b.x + 0.45,
        b.y + 0.55,
        b.x + 1.55,
        b.y + 1.9,
        4,
        h - 8,
        1,
        4,
        '#5a7fa6',
    );
    gable(
        ctx,
        b.x + 0.45,
        b.y + 0.55,
        b.x + 1.55,
        b.y + 1.9,
        h,
        18,
        style.roof,
        wall,
        'y',
    );

    if (grow < 0.65) {
        return;
    }

    for (const x of [0.3, 1.3]) {
        const th = h + 26;

        box(ctx, b.x + x, b.y + 0.15, b.x + x + 0.42, b.y + 0.55, 0, th, wall);
        windows(
            ctx,
            'left',
            b.x + x,
            b.y + 0.15,
            b.x + x + 0.42,
            b.y + 0.55,
            10,
            th - 16,
            3,
            1,
            '#4a4a55',
        );
        pyramid(
            ctx,
            b.x + x - 0.02,
            b.y + 0.13,
            b.x + x + 0.44,
            b.y + 0.57,
            th,
            30,
            style.roof,
        );
    }

    const [rx, ry] = P(b.x + 1, b.y + 0.55, h - 6);

    ctx.fillStyle = '#c94f6d';
    ctx.beginPath();
    ctx.arc(rx, ry, 5, 0, Math.PI * 2);
    ctx.fill();
}

function school(info: DrawInfo): void {
    const { ctx, b, grow, style } = info;
    const wall = wallOf(info);
    const h = (13 + b.level * 4) * grow;

    box(ctx, b.x + 0.12, b.y + 0.2, b.x + 0.88, b.y + 0.8, 0, h, wall);
    windows(
        ctx,
        'left',
        b.x + 0.12,
        b.y + 0.2,
        b.x + 0.88,
        b.y + 0.8,
        2,
        h - 3,
        Math.max(1, b.level - 1),
        3,
        (r, c) => lit(info, r + c * 2),
    );
    door(
        ctx,
        'left',
        b.x + 0.12,
        b.y + 0.2,
        b.x + 0.88,
        b.y + 0.8,
        0,
        0.14,
        7,
        style.trim,
    );
    roofFor(info, b.x + 0.12, b.y + 0.2, b.x + 0.88, b.y + 0.8, h, 10, wall);

    if (grow >= 1) {
        box(
            ctx,
            b.x + 0.42,
            b.y + 0.42,
            b.x + 0.58,
            b.y + 0.58,
            h + 6,
            8,
            shade(wall, 0.05),
        );
        pyramid(
            ctx,
            b.x + 0.4,
            b.y + 0.4,
            b.x + 0.6,
            b.y + 0.6,
            h + 14,
            7,
            style.roof,
        );
    }
}

function university(info: DrawInfo): void {
    const { ctx, b, grow } = info;
    const wall = '#e7dfcd';
    const h = (20 + b.level * 4) * grow;

    box(ctx, b.x + 0.15, b.y + 0.3, b.x + 1.85, b.y + 1.7, 0, h, wall);
    windows(
        ctx,
        'left',
        b.x + 0.15,
        b.y + 0.3,
        b.x + 1.85,
        b.y + 1.7,
        2,
        h - 4,
        2,
        8,
        (r, c) => lit(info, r * 8 + c),
    );
    windows(
        ctx,
        'right',
        b.x + 0.15,
        b.y + 0.3,
        b.x + 1.85,
        b.y + 1.7,
        2,
        h - 4,
        2,
        5,
        (r, c) => lit(info, r * 5 + c + 20),
    );

    for (let i = 0; i < 6; i++) {
        const x = b.x + 0.65 + i * 0.14;

        line(ctx, P(x, b.y + 1.78, 0), P(x, b.y + 1.78, h - 2), '#f6f1e6', 2);
    }

    if (grow >= 0.65) {
        box(
            ctx,
            b.x + 0.13,
            b.y + 0.28,
            b.x + 1.87,
            b.y + 1.72,
            h,
            3,
            '#cfc4ad',
        );
        cylinder(ctx, b.x + 1, b.y + 1, 0.3, h + 3, 6, wall);
        dome(ctx, b.x + 1, b.y + 1, 0.3, h + 9, '#5f8f7e');
    }
}

function mill(info: DrawInfo): void {
    const { ctx, b, grow, style, t } = info;
    const wall = '#d8cbb0';
    const h = (22 + b.level * 3) * grow;

    box(ctx, b.x + 0.25, b.y + 0.25, b.x + 0.75, b.y + 0.75, 0, h, wall);
    door(
        ctx,
        'left',
        b.x + 0.25,
        b.y + 0.25,
        b.x + 0.75,
        b.y + 0.75,
        0,
        0.14,
        7,
        style.trim,
    );
    pyramid(
        ctx,
        b.x + 0.22,
        b.y + 0.22,
        b.x + 0.78,
        b.y + 0.78,
        h,
        12,
        style.roof,
    );

    if (grow < 1) {
        return;
    }

    const [hx, hy] = P(b.x + 0.5, b.y + 0.8, h - 3);
    const spin = t * (1 + b.level * 0.4);

    for (let i = 0; i < 4; i++) {
        const a = spin + (i * Math.PI) / 2;
        const ex = hx + Math.cos(a) * 20;
        const ey = hy + Math.sin(a) * 20;
        const px = Math.cos(a + Math.PI / 2) * 3.5;
        const py = Math.sin(a + Math.PI / 2) * 3.5;

        line(ctx, [hx, hy], [ex, ey], '#5e3d22', 1.5);
        poly(
            ctx,
            [
                [hx + (ex - hx) * 0.3, hy + (ey - hy) * 0.3],
                [ex, ey],
                [ex + px, ey + py],
                [hx + (ex - hx) * 0.3 + px, hy + (ey - hy) * 0.3 + py],
            ],
            'rgba(245,238,220,0.92)',
        );
    }
}

function smithy(info: DrawInfo): void {
    const { ctx, b, def, grow, style } = info;
    const wall = def.id === 'workshop' ? wallOf(info) : shade(style.wall, -0.1);
    const h = (11 + b.level * 3) * grow;

    box(ctx, b.x + 0.15, b.y + 0.15, b.x + 0.85, b.y + 0.75, 0, h, wall);
    door(
        ctx,
        'left',
        b.x + 0.15,
        b.y + 0.15,
        b.x + 0.85,
        b.y + 0.75,
        0,
        0.22,
        8,
        '#2a1d14',
    );
    roofFor(info, b.x + 0.15, b.y + 0.15, b.x + 0.85, b.y + 0.75, h, 8, wall);

    if (def.id === 'workshop' && grow >= 0.65) {
        poly(
            ctx,
            [
                P(b.x + 0.2, b.y + 0.75, h * 0.7),
                P(b.x + 0.8, b.y + 0.75, h * 0.7),
                P(b.x + 0.8, b.y + 0.95, h * 0.45),
                P(b.x + 0.2, b.y + 0.95, h * 0.45),
            ],
            '#3f7fd6',
        );
    }

    if (grow >= 1) {
        box(
            ctx,
            b.x + 0.62,
            b.y + 0.2,
            b.x + 0.76,
            b.y + 0.34,
            h,
            10,
            '#5f564c',
        );
        info.emit(b.x + 0.69, b.y + 0.27, h + 11, 'smoke');

        // Forge glow.
        const [gx, gy] = P(b.x + 0.5, b.y + 0.75, 3);

        ctx.fillStyle = `rgba(255,${110 + Math.sin(info.t * 7) * 30},30,0.85)`;
        ctx.fillRect(gx - 2, gy - 3, 4, 3);
    }
}

function factory(info: DrawInfo): void {
    const { ctx, b, def, grow, style } = info;
    const modern = def.id === 'factory';
    const wall = modern ? '#8f4a36' : '#b38763';
    const h = (16 + b.level * 4) * grow;
    const x0 = b.x + 0.15;
    const y0 = b.y + 0.15;
    const x1 = b.x + 1.85;
    const y1 = b.y + 1.5;

    box(ctx, x0, y0, x1, y1, 0, h, wall);
    windows(ctx, 'left', x0, y0, x1, y1, 2, h - 4, 1, 6, (r, c) =>
        lit(info, c + 70),
    );
    windows(ctx, 'right', x0, y0, x1, y1, 2, h - 4, 1, 4, '#3a3530');
    door(ctx, 'left', x0, y0, x1, y1, 0, 0.35, 10, '#2c2622');

    if (grow < 0.65) {
        return;
    }

    for (let i = 0; i < 4; i++) {
        const a = x0 + (i * (x1 - x0)) / 4;

        gable(
            ctx,
            a,
            y0,
            a + (x1 - x0) / 4,
            y1,
            h,
            8,
            modern ? '#4a4a50' : style.roof,
            wall,
            'y',
        );
    }

    const stacks = modern ? 1 + b.level : 1;

    for (let i = 0; i < stacks; i++) {
        const cx = b.x + 0.4 + i * 0.4;
        const cy = b.y + 1.72;
        const sh = modern ? 46 + i * 4 : 30;

        cylinder(ctx, cx, cy, 0.09, 0, sh, modern ? '#7a3b2c' : '#8f6b4f');
        info.emit(cx, cy, sh + 2, 'smoke');
    }
}

function barracks(info: DrawInfo): void {
    const { ctx, b, grow, style, epoch, t } = info;

    if (epoch >= 7) {
        const h = (18 + b.level * 4) * grow;

        box(ctx, b.x + 0.2, b.y + 0.3, b.x + 1.8, b.y + 1.7, 0, h, '#dfe3e8');
        poly(
            ctx,
            [
                P(b.x + 0.2, b.y + 1.7, h * 0.55),
                P(b.x + 1.8, b.y + 1.7, h * 0.55),
                P(b.x + 1.8, b.y + 1.7, h * 0.7),
                P(b.x + 0.2, b.y + 1.7, h * 0.7),
            ],
            '#2f5fbf',
        );
        windows(
            ctx,
            'left',
            b.x + 0.2,
            b.y + 0.3,
            b.x + 1.8,
            b.y + 1.7,
            2,
            h * 0.5,
            1,
            6,
            style.window,
        );
        box(
            ctx,
            b.x + 0.18,
            b.y + 0.28,
            b.x + 1.82,
            b.y + 1.72,
            h,
            2,
            '#9aa3ad',
        );

        const [lx, ly] = P(b.x + 1, b.y + 1, h + 4);

        ctx.fillStyle = Math.sin(t * 6) > 0 ? '#3a7bff' : '#ff3a3a';
        ctx.fillRect(lx - 2, ly - 2, 4, 3);

        return;
    }

    const wall = epoch >= 2 ? '#9d968c' : style.wall;
    const h = (14 + b.level * 3) * grow;

    box(
        ctx,
        b.x + 0.15,
        b.y + 0.15,
        b.x + 1.85,
        b.y + 1.85,
        0,
        h * 0.6,
        shade(wall, -0.08),
    );
    box(ctx, b.x + 0.5, b.y + 0.5, b.x + 1.5, b.y + 1.5, 0, h, wall);
    door(
        ctx,
        'left',
        b.x + 0.15,
        b.y + 0.15,
        b.x + 1.85,
        b.y + 1.85,
        0,
        0.3,
        9,
        '#2b2420',
    );

    if (grow < 0.65) {
        return;
    }

    for (let i = 0; i < 5; i++) {
        const x = b.x + 0.5 + i * 0.22;

        box(ctx, x, b.y + 1.38, x + 0.1, b.y + 1.5, h, 4, wall);
        box(
            ctx,
            b.x + 1.38,
            b.y + 0.5 + i * 0.22,
            b.x + 1.5,
            b.y + 0.6 + i * 0.22,
            h,
            4,
            wall,
        );
    }

    flag(ctx, b.x + 1, b.y + 1, h, 20, style.flag, t);
}

function hall(info: DrawInfo): void {
    const { ctx, b, grow, style, t } = info;
    const wall = wallOf(info);
    const h = (20 + b.level * 4) * grow;

    box(ctx, b.x + 0.15, b.y + 0.35, b.x + 1.85, b.y + 1.65, 0, h, wall);
    windows(
        ctx,
        'left',
        b.x + 0.15,
        b.y + 0.35,
        b.x + 1.85,
        b.y + 1.65,
        2,
        h - 3,
        2,
        7,
        (r, c) => lit(info, r * 7 + c + 90),
    );
    windows(
        ctx,
        'right',
        b.x + 0.15,
        b.y + 0.35,
        b.x + 1.85,
        b.y + 1.65,
        2,
        h - 3,
        2,
        4,
        (r, c) => lit(info, r * 4 + c + 60),
    );
    door(
        ctx,
        'left',
        b.x + 0.15,
        b.y + 0.35,
        b.x + 1.85,
        b.y + 1.65,
        0,
        0.3,
        10,
        style.trim,
    );

    if (grow < 0.65) {
        return;
    }

    roofFor(info, b.x + 0.15, b.y + 0.35, b.x + 1.85, b.y + 1.65, h, 12, wall);
    box(ctx, b.x + 0.78, b.y + 0.78, b.x + 1.22, b.y + 1.22, h, 34, wall);
    pyramid(
        ctx,
        b.x + 0.75,
        b.y + 0.75,
        b.x + 1.25,
        b.y + 1.25,
        h + 34,
        18,
        style.roof,
    );

    const [cx, cy] = P(b.x + 1, b.y + 1.22, h + 26);

    ctx.fillStyle = '#f6f0de';
    ctx.beginPath();
    ctx.arc(cx - 3.5, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    line(
        ctx,
        [cx - 3.5, cy],
        [cx - 3.5 + Math.cos(t / 3) * 3, cy + Math.sin(t / 3) * 3],
        '#222',
        1,
    );
}

function harbor(info: DrawInfo): void {
    const { ctx, b, grow, t } = info;
    const [dx, dy] = info.water ?? [1, 0];

    poly(
        ctx,
        rect(b.x + 0.05, b.y + 0.05, b.x + 1.95, b.y + 1.95, 2),
        '#9c7a52',
    );

    for (let i = 0; i < 8; i++) {
        line(
            ctx,
            P(b.x + 0.05, b.y + 0.05 + i * 0.24, 2),
            P(b.x + 1.95, b.y + 0.05 + i * 0.24, 2),
            '#7d5f3e',
            0.8,
        );
    }

    box(
        ctx,
        b.x + 0.15,
        b.y + 0.15,
        b.x + 0.95,
        b.y + 0.85,
        2,
        12 * grow,
        '#b07a4f',
    );
    gable(
        ctx,
        b.x + 0.15,
        b.y + 0.15,
        b.x + 0.95,
        b.y + 0.85,
        2 + 12 * grow,
        8,
        info.style.roof,
        '#b07a4f',
        'x',
    );

    if (grow < 1) {
        return;
    }

    line(
        ctx,
        P(b.x + 1.6, b.y + 1.4, 2),
        P(b.x + 1.6, b.y + 1.4, 36),
        '#5e3d22',
        2,
    );
    line(
        ctx,
        P(b.x + 1.6, b.y + 1.4, 36),
        P(b.x + 1.6 + dx * 0.9, b.y + 1.4 + dy * 0.9, 30),
        '#5e3d22',
        2,
    );

    const bob = Math.sin(t * 1.5) * 1.5;
    const bx = b.x + 1 + dx * 1.6;
    const by = b.y + 1 + dy * 1.6;

    poly(
        ctx,
        [
            P(bx - 0.4, by - 0.15, bob),
            P(bx + 0.4, by - 0.15, bob),
            P(bx + 0.5, by, bob),
            P(bx + 0.4, by + 0.15, bob),
            P(bx - 0.4, by + 0.15, bob),
        ],
        '#6b4423',
    );
    line(ctx, P(bx, by, bob), P(bx, by, bob + 26), '#4a3b2c', 1.5);
    poly(
        ctx,
        [P(bx, by, bob + 24), P(bx + 0.35, by, bob + 8), P(bx, by, bob + 8)],
        '#f3ead6',
    );
}

function trading(info: DrawInfo): void {
    const { ctx, b, grow, style } = info;
    const wall = info.epoch >= 7 ? '#e3e0d8' : '#efe3c6';
    const h = (26 + b.level * 6) * grow;

    box(ctx, b.x + 0.25, b.y + 0.25, b.x + 1.75, b.y + 1.6, 0, h, wall);
    windows(
        ctx,
        'left',
        b.x + 0.25,
        b.y + 0.25,
        b.x + 1.75,
        b.y + 1.6,
        2,
        h - 6,
        3,
        6,
        (r, c) => lit(info, r * 6 + c + 120),
    );
    windows(
        ctx,
        'right',
        b.x + 0.25,
        b.y + 0.25,
        b.x + 1.75,
        b.y + 1.6,
        2,
        h - 6,
        3,
        5,
        (r, c) => lit(info, r * 5 + c + 150),
    );

    for (let i = 0; i < 6; i++) {
        const x = b.x + 0.4 + i * 0.25;

        line(
            ctx,
            P(x, b.y + 1.78, 0),
            P(x, b.y + 1.78, h * 0.5),
            '#fbf6ea',
            2.5,
        );
    }

    if (grow >= 0.65) {
        poly(
            ctx,
            [
                P(b.x + 0.3, b.y + 1.8, h * 0.5),
                P(b.x + 1.7, b.y + 1.8, h * 0.5),
                P(b.x + 1, b.y + 1.8, h * 0.5 + 10),
            ],
            '#f1e8d2',
        );
        box(
            ctx,
            b.x + 0.23,
            b.y + 0.23,
            b.x + 1.77,
            b.y + 1.62,
            h,
            3,
            style.trim,
        );
    }
}

function park(info: DrawInfo): void {
    const { ctx, b, epoch } = info;

    poly(
        ctx,
        rect(b.x + 0.04, b.y + 0.04, b.x + 0.96, b.y + 0.96, 0.5),
        '#5f9d45',
    );
    poly(
        ctx,
        rect(b.x + 0.44, b.y + 0.04, b.x + 0.56, b.y + 0.96, 1),
        '#d8c9a3',
    );
    poly(
        ctx,
        rect(b.x + 0.04, b.y + 0.44, b.x + 0.96, b.y + 0.56, 1),
        '#d8c9a3',
    );

    for (const [ox, oy] of [
        [0.22, 0.22],
        [0.78, 0.22],
        [0.22, 0.78],
        [0.78, 0.78],
    ]) {
        tree(
            ctx,
            b.x + ox,
            b.y + oy,
            0.8 + b.level * 0.15,
            tileHash(b.x, b.y, ox * 10 + oy) > 0.5,
        );
    }

    if (epoch >= 6 && b.level >= 2) {
        cylinder(ctx, b.x + 0.5, b.y + 0.5, 0.1, 0, 3, '#c9c3b6');
    }
}

function station(info: DrawInfo): void {
    const { ctx, b, grow, t } = info;
    const wall = '#a65a42';
    const h = (18 + b.level * 3) * grow;

    line(ctx, P(b.x - 0.5, b.y + 1.65), P(b.x + 2.5, b.y + 1.65), '#3b3b3b', 2);
    line(ctx, P(b.x - 0.5, b.y + 1.85), P(b.x + 2.5, b.y + 1.85), '#3b3b3b', 2);
    box(ctx, b.x + 0.15, b.y + 0.2, b.x + 1.85, b.y + 1.3, 0, h, wall);
    windows(
        ctx,
        'left',
        b.x + 0.15,
        b.y + 0.2,
        b.x + 1.85,
        b.y + 1.3,
        2,
        h - 4,
        1,
        7,
        (r, c) => lit(info, c + 200),
    );

    if (grow >= 0.65) {
        gable(
            ctx,
            b.x + 0.1,
            b.y + 0.15,
            b.x + 1.9,
            b.y + 1.35,
            h,
            12,
            '#7f9aa8',
            wall,
            'x',
        );
        box(ctx, b.x + 0.85, b.y + 0.5, b.x + 1.15, b.y + 0.8, h, 22, wall);
        pyramid(
            ctx,
            b.x + 0.83,
            b.y + 0.48,
            b.x + 1.17,
            b.y + 0.82,
            h + 22,
            10,
            '#3f3f44',
        );

        const tx = ((t * 0.25) % 4) - 1;

        box(
            ctx,
            b.x + tx,
            b.y + 1.6,
            b.x + tx + 0.7,
            b.y + 1.9,
            0,
            9,
            '#2f3e57',
        );
        box(
            ctx,
            b.x + tx - 0.75,
            b.y + 1.6,
            b.x + tx - 0.05,
            b.y + 1.9,
            0,
            9,
            '#7a2e2e',
        );
        info.emit(b.x + tx + 0.6, b.y + 1.75, 14, 'steam');
    }
}

function power(info: DrawInfo): void {
    const { ctx, b, grow } = info;
    const h = (16 + b.level * 3) * grow;

    box(ctx, b.x + 0.15, b.y + 0.9, b.x + 1.2, b.y + 1.85, 0, h, '#9ea3a8');
    windows(
        ctx,
        'left',
        b.x + 0.15,
        b.y + 0.9,
        b.x + 1.2,
        b.y + 1.85,
        2,
        h - 4,
        1,
        3,
        '#3c4650',
    );
    cylinder(ctx, b.x + 1.35, b.y + 0.6, 0.48, 0, 46 * grow, '#d8d6d0', 0.72);

    if (grow >= 1) {
        info.emit(b.x + 1.35, b.y + 0.6, 48, 'steam');
        cylinder(ctx, b.x + 0.4, b.y + 0.35, 0.08, 0, 50, '#b3473a');
        info.emit(b.x + 0.4, b.y + 0.35, 52, 'smoke');
    }
}

function solar(info: DrawInfo): void {
    const { ctx, b, grow } = info;

    poly(ctx, rect(b.x + 0.05, b.y + 0.05, b.x + 1.95, b.y + 1.95), '#b7c4b0');

    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            const x = b.x + 0.15 + i * 0.6;
            const y = b.y + 0.15 + j * 0.6;

            poly(
                ctx,
                [
                    P(x, y, 8 * grow),
                    P(x + 0.45, y, 8 * grow),
                    P(x + 0.45, y + 0.45, 2),
                    P(x, y + 0.45, 2),
                ],
                '#24508a',
                '#7fb0e6',
                0.6,
            );
        }
    }
}

function hospital(info: DrawInfo): void {
    const { ctx, b, grow } = info;
    const h = (26 + b.level * 6) * grow;

    box(ctx, b.x + 0.2, b.y + 0.2, b.x + 1.8, b.y + 1.8, 0, h, '#f2f2ef');
    windows(
        ctx,
        'left',
        b.x + 0.2,
        b.y + 0.2,
        b.x + 1.8,
        b.y + 1.8,
        2,
        h - 4,
        4,
        6,
        (r, c) => (tileHash(r, c, 3) > 0.5 ? '#9fd1ec' : '#6fa9cc'),
    );
    windows(
        ctx,
        'right',
        b.x + 0.2,
        b.y + 0.2,
        b.x + 1.8,
        b.y + 1.8,
        2,
        h - 4,
        4,
        6,
        '#6fa9cc',
    );

    if (grow >= 1) {
        poly(
            ctx,
            rect(b.x + 0.85, b.y + 0.55, b.x + 1.15, b.y + 1.45, h + 0.5),
            '#d93a3a',
        );
        poly(
            ctx,
            rect(b.x + 0.55, b.y + 0.85, b.x + 1.45, b.y + 1.15, h + 0.5),
            '#d93a3a',
        );
    }
}

function office(info: DrawInfo): void {
    const { ctx, b, def, grow } = info;

    if (def.id === 'tech_park') {
        for (const [x, y, hh] of [
            [0.15, 0.15, 40],
            [1.05, 0.95, 28],
        ]) {
            const h = (hh + b.level * 8) * grow;

            box(
                ctx,
                b.x + x,
                b.y + y,
                b.x + x + 0.8,
                b.y + y + 0.8,
                0,
                h,
                '#9fd4cf',
            );
            windows(
                ctx,
                'left',
                b.x + x,
                b.y + y,
                b.x + x + 0.8,
                b.y + y + 0.8,
                0,
                h,
                Math.floor(h / 6),
                4,
                (r, c) =>
                    tileHash(r, c + x * 10, 4) > 0.7 ? '#e9fffb' : '#6fb3ad',
            );
        }

        dome(ctx, b.x + 0.5, b.y + 1.5, 0.3, 0, '#c9e8ff');

        return;
    }

    const floors = 12 + b.level * 5;
    const h = floors * 6 * grow;
    const x0 = b.x + 0.3;
    const y0 = b.y + 0.3;
    const x1 = b.x + 1.7;
    const y1 = b.y + 1.7;

    box(ctx, x0, y0, x1, y1, 0, h, '#5a87a6');

    for (let row = 0; row < Math.floor(h / 6); row++) {
        poly(
            ctx,
            [
                P(x0, y1, row * 6 + 1),
                P(x1, y1, row * 6 + 1),
                P(x1, y1, row * 6 + 5),
                P(x0, y1, row * 6 + 5),
            ],
            tileHash(b.x + row, b.y, 6) > 0.75 ? '#e8f6ff' : '#8ec2e2',
        );
        poly(
            ctx,
            [
                P(x1, y0, row * 6 + 1),
                P(x1, y1, row * 6 + 1),
                P(x1, y1, row * 6 + 5),
                P(x1, y0, row * 6 + 5),
            ],
            '#5e95b8',
        );
    }

    if (grow >= 1) {
        box(ctx, x0 + 0.3, y0 + 0.3, x1 - 0.3, y1 - 0.3, h, 8, '#41657e');
    }
}

export function tree(
    ctx: Ctx,
    x: number,
    y: number,
    scale: number,
    conifer: boolean,
): void {
    const [sx, sy] = P(x, y);

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 7 * scale, 3.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(sx - 1.2 * scale, sy - 8 * scale, 2.4 * scale, 8 * scale);

    if (conifer) {
        for (let i = 0; i < 3; i++) {
            const w = (8 - i * 2) * scale;
            const base = sy - (6 + i * 5) * scale;

            poly(
                ctx,
                [
                    [sx - w, base],
                    [sx + w, base],
                    [sx, base - 9 * scale],
                ],
                i % 2 ? '#2f6b3a' : '#357a40',
            );
        }
    } else {
        ctx.fillStyle = '#3f8a3e';
        ctx.beginPath();
        ctx.arc(sx, sy - 13 * scale, 7.5 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#56a24c';
        ctx.beginPath();
        ctx.arc(sx - 2 * scale, sy - 15 * scale, 4.5 * scale, 0, Math.PI * 2);
        ctx.fill();
    }
}

export function rock(ctx: Ctx, x: number, y: number, seed: number): void {
    for (let i = 0; i < 3; i++) {
        const ox = x + 0.2 + tileHash(x, y, seed + i) * 0.6;
        const oy = y + 0.2 + tileHash(y, x, seed + i + 9) * 0.6;
        const size = 0.12 + tileHash(x, y, i + 30) * 0.12;
        const h = 6 + tileHash(x, y, i + 40) * 10;

        pyramid(
            ctx,
            ox - size,
            oy - size,
            ox + size,
            oy + size,
            0,
            h,
            i % 2 ? '#9a958d' : '#aaa59c',
        );
    }
}

const SHAPES: Record<string, (info: DrawInfo) => void> = {
    house,
    tower,
    center,
    farm,
    greenhouse,
    lumber,
    quarry,
    mine,
    well,
    warehouse,
    market,
    chapel,
    cathedral,
    school,
    university,
    mill,
    smithy,
    factory,
    barracks,
    hall,
    harbor,
    trading,
    park,
    station,
    power,
    solar,
    hospital,
    office,
};

export function drawBuilding(ctx: Ctx, info: Omit<DrawInfo, 'ctx'>): void {
    const draw = SHAPES[info.def.shape];

    if (!draw) {
        return;
    }

    const full: DrawInfo = { ...info, ctx };
    const size = info.def.size;

    // Soft shadow under every building.
    poly(
        ctx,
        rect(
            info.b.x + 0.05,
            info.b.y + 0.05,
            info.b.x + size + 0.12,
            info.b.y + size + 0.12,
        ),
        'rgba(0,0,0,0.12)',
    );

    draw(full);

    if (info.grow < 1) {
        scaffold(ctx, full);
    }
}

function scaffold(ctx: Ctx, info: DrawInfo): void {
    const { b, def } = info;
    const s = def.size;
    const h = 26 * s;
    const color = 'rgba(122,84,44,0.9)';
    const corners: [number, number][] = [
        [b.x + 0.1, b.y + s - 0.1],
        [b.x + s - 0.1, b.y + s - 0.1],
        [b.x + s - 0.1, b.y + 0.1],
    ];

    for (const [x, y] of corners) {
        line(ctx, P(x, y), P(x, y, h), color, 1.2);
    }

    for (let z = 8; z < h; z += 9) {
        line(
            ctx,
            P(corners[0][0], corners[0][1], z),
            P(corners[1][0], corners[1][1], z),
            color,
            1,
        );
        line(
            ctx,
            P(corners[1][0], corners[1][1], z),
            P(corners[2][0], corners[2][1], z),
            color,
            1,
        );
    }
}
