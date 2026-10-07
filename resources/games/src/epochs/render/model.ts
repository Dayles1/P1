/**
 * Draws a building from its model in the content files: a list of parts
 * (boxes, roofs, windows, cylinders, flags, lights, …) in tile units
 * relative to the building's corner. Colours are palette keys of the
 * current era ("wall", "roof", "walls" = a wall colour picked per
 * building) or plain #hex values.
 */

import type { ModelPart, Palette } from '../engine/content/types';
import { hash2 } from '../engine/core/random';
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

export interface ModelContext {
    ctx: Ctx;
    /** World position of the building's corner. */
    x: number;
    y: number;
    palette: Palette;
    /** Stable per building: picks wall variants and lit windows. */
    seed: number;
    time: number;
    night: boolean;
    /** 0..1 while under construction — walls rise with it. */
    grow: number;
    snow: number;
    treeTint: string;
    emit?: (x: number, y: number, z: number, kind: string) => void;
    light?: (
        x: number,
        y: number,
        z: number,
        radius: number,
        color: string,
    ) => void;
}

export function resolveColor(
    color: string,
    palette: Palette,
    seed: number,
): string {
    if (color.startsWith('#')) {
        return color;
    }

    if (color === 'walls') {
        const walls = palette.walls?.length ? palette.walls : [palette.wall];

        return walls[Math.floor(hash2(seed, 7) * walls.length)];
    }

    const value = palette[color];

    return typeof value === 'string' ? value : '#ff00ff';
}

export function tree(
    ctx: Ctx,
    x: number,
    y: number,
    scale: number,
    conifer: boolean,
    tint: string,
    snow = 0,
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

            if (snow > 0.2) {
                poly(
                    ctx,
                    [
                        [sx - w * 0.45, base - 5 * scale],
                        [sx + w * 0.45, base - 5 * scale],
                        [sx, base - 9 * scale],
                    ],
                    'rgba(245,250,255,0.9)',
                );
            }
        }
    } else {
        ctx.fillStyle = tint;
        ctx.beginPath();
        ctx.arc(sx, sy - 13 * scale, 7.5 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = shade(tint, 0.18);
        ctx.beginPath();
        ctx.arc(sx - 2 * scale, sy - 15 * scale, 4.5 * scale, 0, Math.PI * 2);
        ctx.fill();

        if (snow > 0.2) {
            ctx.fillStyle = 'rgba(245,250,255,0.85)';
            ctx.beginPath();
            ctx.arc(sx, sy - 17 * scale, 5 * scale, Math.PI, 0);
            ctx.fill();
        }
    }
}

export function drawModel(parts: ModelPart[], m: ModelContext): void {
    const { ctx, x: ox, y: oy, palette, seed, grow } = m;
    const color = (c: string) => resolveColor(c, palette, seed);
    const roofsVisible = grow >= 0.65;

    for (const part of parts) {
        switch (part.kind) {
            case 'ground':
                poly(
                    ctx,
                    rect(
                        ox + part.x,
                        oy + part.y,
                        ox + part.x + part.w,
                        oy + part.y + part.d,
                        0.4,
                    ),
                    color(part.color),
                );
                break;

            case 'field': {
                poly(
                    ctx,
                    rect(
                        ox + part.x,
                        oy + part.y,
                        ox + part.x + part.w,
                        oy + part.y + part.d,
                        0.3,
                    ),
                    '#8a6a3e',
                );

                const crop = m.snow > 0.3 ? '#e9eef2' : color(part.color);

                for (let i = 0; i < part.rows; i++) {
                    const y0 = oy + part.y + (i * part.d) / part.rows + 0.03;
                    const y1 = y0 + part.d / part.rows - 0.06;

                    poly(
                        ctx,
                        rect(
                            ox + part.x + 0.04,
                            y0,
                            ox + part.x + part.w - 0.04,
                            y1,
                            1.5 * grow,
                        ),
                        i % 2 ? shade(crop, -0.08) : crop,
                    );
                }

                break;
            }

            case 'box': {
                const c = color(part.color);

                box(
                    ctx,
                    ox + part.x,
                    oy + part.y,
                    ox + part.x + part.w,
                    oy + part.y + part.d,
                    part.z * grow,
                    part.h * grow,
                    c,
                );

                if (m.snow > 0.3 && grow >= 1) {
                    poly(
                        ctx,
                        rect(
                            ox + part.x,
                            oy + part.y,
                            ox + part.x + part.w,
                            oy + part.y + part.d,
                            part.z + part.h + 0.5,
                        ),
                        'rgba(240,246,250,0.85)',
                    );
                }

                break;
            }

            case 'roof': {
                if (!roofsVisible) {
                    break;
                }

                const c = color(part.color);
                const x0 = ox + part.x;
                const y0 = oy + part.y;
                const x1 = x0 + part.w;
                const y1 = y0 + part.d;
                const z = part.z * grow;
                const roofColor = m.snow > 0.3 ? shade('#eef4f8', -0.04) : c;

                if (part.shape === 'gable') {
                    const axis =
                        part.axis ?? (hash2(seed, 2) > 0.5 ? 'x' : 'y');

                    gable(
                        ctx,
                        x0,
                        y0,
                        x1,
                        y1,
                        z,
                        part.h,
                        roofColor,
                        color('walls'),
                        axis,
                    );
                } else if (part.shape === 'pyramid') {
                    pyramid(ctx, x0, y0, x1, y1, z, part.h, roofColor);
                } else if (part.shape === 'flat') {
                    box(ctx, x0, y0, x1, y1, z, part.h, shade(c, 0.05));
                } else if (part.shape === 'dome') {
                    dome(ctx, (x0 + x1) / 2, (y0 + y1) / 2, part.w / 2, z, c);
                } else if (part.shape === 'cone') {
                    cone(
                        ctx,
                        (x0 + x1) / 2,
                        (y0 + y1) / 2,
                        part.w / 2,
                        z,
                        part.h,
                        roofColor,
                    );
                } else if (part.shape === 'sawtooth') {
                    const teeth = Math.max(2, Math.round(part.w / 0.22));

                    for (let i = 0; i < teeth; i++) {
                        const a = x0 + (i * part.w) / teeth;

                        gable(
                            ctx,
                            a,
                            y0,
                            a + part.w / teeth,
                            y1,
                            z,
                            part.h,
                            roofColor,
                            color('walls'),
                            'y',
                        );
                    }
                }

                break;
            }

            case 'windows': {
                const lit = palette.lit;
                const base = color(part.color);

                windows(
                    ctx,
                    part.face,
                    ox + part.x,
                    oy + part.y,
                    ox + part.x + part.w,
                    oy + part.y + part.d,
                    part.z * grow,
                    part.h * grow,
                    Math.max(1, Math.round(part.rows * grow)),
                    part.cols,
                    (row, col) => {
                        const on =
                            m.night &&
                            hash2(
                                seed * 31 + row,
                                col + (part.face === 'left' ? 0 : 50),
                                3,
                            ) > 0.45;
                        const c = on ? lit : base;

                        return part.face === 'right'
                            ? shade(c, on ? -0.05 : -0.2)
                            : c;
                    },
                );

                if (m.night && m.light && grow >= 1) {
                    m.light(
                        ox + part.x + part.w / 2,
                        oy + part.y + part.d / 2,
                        part.z + part.h / 2,
                        Math.max(part.w, part.d) * 0.6,
                        lit,
                    );
                }

                break;
            }

            case 'door':
                if (grow >= 0.3) {
                    door(
                        ctx,
                        part.face,
                        ox + part.x,
                        oy + part.y,
                        ox + part.x + part.w,
                        oy + part.y + part.d,
                        0,
                        part.width,
                        part.height * grow,
                        color(part.color),
                    );
                }

                break;

            case 'beams': {
                const c = color(part.color);
                const from = part.face === 'left' ? ox + part.x : oy + part.y;
                const span = part.face === 'left' ? part.w : part.d;
                const h = part.h * grow;

                for (let i = 0; i <= part.count; i++) {
                    const at = from + (i * span) / part.count;
                    const a =
                        part.face === 'left'
                            ? P(at, oy + part.y + part.d, part.z)
                            : P(ox + part.x + part.w, at, part.z);
                    const b =
                        part.face === 'left'
                            ? P(at, oy + part.y + part.d, part.z + h)
                            : P(ox + part.x + part.w, at, part.z + h);

                    line(ctx, a, b, c, 1.2);
                }

                const mid = part.z + h / 2;

                if (part.face === 'left') {
                    line(
                        ctx,
                        P(ox + part.x, oy + part.y + part.d, mid),
                        P(ox + part.x + part.w, oy + part.y + part.d, mid),
                        c,
                        1.2,
                    );
                } else {
                    line(
                        ctx,
                        P(ox + part.x + part.w, oy + part.y, mid),
                        P(ox + part.x + part.w, oy + part.y + part.d, mid),
                        c,
                        1.2,
                    );
                }

                break;
            }

            case 'cylinder':
                cylinder(
                    ctx,
                    ox + part.x,
                    oy + part.y,
                    part.r,
                    part.z * grow,
                    part.h * grow,
                    color(part.color),
                    part.taper ?? 1,
                );
                break;

            case 'flag':
                if (grow >= 1) {
                    flag(
                        ctx,
                        ox + part.x,
                        oy + part.y,
                        part.z,
                        part.h,
                        color(part.color),
                        m.time,
                    );
                }

                break;

            case 'pole': {
                const base = P(ox + part.x, oy + part.y, part.z * grow);
                const top = P(
                    ox + part.x,
                    oy + part.y,
                    (part.z + part.h) * grow,
                );

                line(ctx, base, top, color(part.color), 1.6);

                if (
                    part.blink &&
                    grow >= 1 &&
                    Math.sin(m.time * 3 + seed) > 0
                ) {
                    ctx.fillStyle = color(part.blink);
                    ctx.fillRect(top[0] - 1.5, top[1] - 1.5, 3, 3);
                    m.light?.(
                        ox + part.x,
                        oy + part.y,
                        part.z + part.h,
                        0.3,
                        color(part.blink),
                    );
                }

                break;
            }

            case 'emitter':
                if (grow >= 1) {
                    m.emit?.(ox + part.x, oy + part.y, part.z, part.type);
                }

                break;

            case 'light':
                if (grow >= 1) {
                    if (m.night) {
                        m.light?.(
                            ox + part.x,
                            oy + part.y,
                            part.z,
                            part.radius,
                            color(part.color),
                        );
                    }

                    const [sx, sy] = P(ox + part.x, oy + part.y, part.z);

                    ctx.fillStyle = color(part.color);
                    ctx.globalAlpha = m.night ? 1 : 0.6;
                    ctx.beginPath();
                    ctx.arc(sx, sy, 1.6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }

                break;

            case 'tree':
                if (grow >= 0.5) {
                    tree(
                        ctx,
                        ox + part.x,
                        oy + part.y,
                        part.scale,
                        part.conifer,
                        m.treeTint,
                        m.snow,
                    );
                }

                break;

            case 'blades': {
                if (grow < 1) {
                    break;
                }

                const [hx, hy] = P(ox + part.x, oy + part.y, part.z);
                const spin = m.time * part.speed;
                const sail = color(part.color);

                for (let i = 0; i < 4; i++) {
                    const a = spin + (i * Math.PI) / 2;
                    const ex = hx + Math.cos(a) * part.r;
                    const ey = hy + Math.sin(a) * part.r;
                    const px = Math.cos(a + Math.PI / 2) * 3.5;
                    const py = Math.sin(a + Math.PI / 2) * 3.5;

                    line(ctx, [hx, hy], [ex, ey], '#5e3d22', 1.5);
                    poly(
                        ctx,
                        [
                            [hx + (ex - hx) * 0.3, hy + (ey - hy) * 0.3],
                            [ex, ey],
                            [ex + px, ey + py],
                            [
                                hx + (ex - hx) * 0.3 + px,
                                hy + (ey - hy) * 0.3 + py,
                            ],
                        ],
                        sail,
                    );
                }

                break;
            }
        }
    }
}

/** Rough height of a model in pixels — for picking and labels. */
export function modelHeight(parts: ModelPart[]): number {
    let top = 12;

    for (const part of parts) {
        if ('z' in part && 'h' in part) {
            top = Math.max(top, part.z + part.h);
        } else if ('z' in part) {
            top = Math.max(top, part.z);
        }
    }

    return top;
}
