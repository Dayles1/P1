/**
 * Isometric projection and the small drawing primitives everything else
 * is built from. World units are tiles; `z` is height in pixels.
 */

export const HW = 32;
export const HH = 16;

export type Ctx = CanvasRenderingContext2D;
export type Point = [number, number];

export function P(x: number, y: number, z = 0): Point {
    return [(x - y) * HW, (x + y) * HH - z];
}

export function poly(
    ctx: Ctx,
    points: Point[],
    fill: string,
    stroke?: string,
    lineWidth = 1,
): void {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);

    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
    }

    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}

export function line(
    ctx: Ctx,
    a: Point,
    b: Point,
    color: string,
    width = 1,
): void {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
}

const shadeCache = new Map<string, string>();

/** Lightens (amount > 0) or darkens (amount < 0) a #rrggbb colour. */
export function shade(hex: string, amount: number): string {
    const key = hex + amount;
    const cached = shadeCache.get(key);

    if (cached) {
        return cached;
    }

    const value = parseInt(hex.slice(1), 16);
    const mix = (channel: number) =>
        Math.round(
            amount >= 0
                ? channel + (255 - channel) * amount
                : channel * (1 + amount),
        );
    const r = mix((value >> 16) & 255);
    const g = mix((value >> 8) & 255);
    const b = mix(value & 255);
    const result = `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;

    shadeCache.set(key, result);

    return result;
}

export function tile(x: number, y: number, z = 0): Point[] {
    return [P(x, y, z), P(x + 1, y, z), P(x + 1, y + 1, z), P(x, y + 1, z)];
}

export function rect(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    z = 0,
): Point[] {
    return [P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)];
}

/** A prism; only the three faces the camera sees are drawn. */
export function box(
    ctx: Ctx,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    z: number,
    h: number,
    color: string,
    top = shade(color, 0.18),
): void {
    poly(
        ctx,
        [P(x0, y1, z), P(x1, y1, z), P(x1, y1, z + h), P(x0, y1, z + h)],
        color,
    );
    poly(
        ctx,
        [P(x1, y0, z), P(x1, y1, z), P(x1, y1, z + h), P(x1, y0, z + h)],
        shade(color, -0.22),
    );
    poly(ctx, rect(x0, y0, x1, y1, z + h), top);
}

/** A pitched roof whose ridge runs along x (axis 'x') or y. */
export function gable(
    ctx: Ctx,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    z: number,
    rh: number,
    color: string,
    wall: string,
    axis: 'x' | 'y' = 'x',
): void {
    const o = 0.06;

    if (axis === 'x') {
        const ym = (y0 + y1) / 2;

        poly(
            ctx,
            [
                P(x0 - o, y0 - o, z),
                P(x1 + o, y0 - o, z),
                P(x1 + o, ym, z + rh),
                P(x0 - o, ym, z + rh),
            ],
            shade(color, -0.12),
        );
        poly(
            ctx,
            [P(x1, y0, z), P(x1, y1, z), P(x1, ym, z + rh)],
            shade(wall, -0.22),
        );
        poly(
            ctx,
            [
                P(x0 - o, ym, z + rh),
                P(x1 + o, ym, z + rh),
                P(x1 + o, y1 + o, z),
                P(x0 - o, y1 + o, z),
            ],
            color,
        );
        line(
            ctx,
            P(x0 - o, ym, z + rh),
            P(x1 + o, ym, z + rh),
            shade(color, -0.3),
        );
    } else {
        const xm = (x0 + x1) / 2;

        poly(
            ctx,
            [
                P(x0 - o, y0 - o, z),
                P(xm, y0 - o, z + rh),
                P(xm, y1 + o, z + rh),
                P(x0 - o, y1 + o, z),
            ],
            shade(color, -0.12),
        );
        poly(ctx, [P(x0, y1, z), P(x1, y1, z), P(xm, y1, z + rh)], wall);
        poly(
            ctx,
            [
                P(xm, y0 - o, z + rh),
                P(x1 + o, y0 - o, z),
                P(x1 + o, y1 + o, z),
                P(xm, y1 + o, z + rh),
            ],
            shade(color, -0.25),
        );
        line(
            ctx,
            P(xm, y0 - o, z + rh),
            P(xm, y1 + o, z + rh),
            shade(color, -0.35),
        );
    }
}

export function pyramid(
    ctx: Ctx,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    z: number,
    rh: number,
    color: string,
): void {
    const apex = P((x0 + x1) / 2, (y0 + y1) / 2, z + rh);

    poly(ctx, [P(x0, y0, z), P(x1, y0, z), apex], shade(color, -0.1));
    poly(ctx, [P(x0, y0, z), P(x0, y1, z), apex], shade(color, -0.1));
    poly(ctx, [P(x0, y1, z), P(x1, y1, z), apex], color);
    poly(ctx, [P(x1, y0, z), P(x1, y1, z), apex], shade(color, -0.25));
}

/** An upright cylinder of radius `r` tiles, tapered to `topScale` at the top. */
export function cylinder(
    ctx: Ctx,
    cx: number,
    cy: number,
    r: number,
    z: number,
    h: number,
    color: string,
    topScale = 1,
): void {
    const [sx, sy] = P(cx, cy, z);
    const rx = r * HW * Math.SQRT2;
    const ry = r * HH * Math.SQRT2;
    const tx = rx * topScale;
    const ty = ry * topScale;
    const gradient = ctx.createLinearGradient(sx - rx, 0, sx + rx, 0);

    gradient.addColorStop(0, shade(color, 0.05));
    gradient.addColorStop(0.45, color);
    gradient.addColorStop(1, shade(color, -0.3));

    ctx.beginPath();
    ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI);
    ctx.lineTo(sx - tx, sy - h);
    ctx.ellipse(sx, sy - h, tx, ty, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(sx, sy - h, tx, ty, 0, 0, Math.PI * 2);
    ctx.fillStyle = shade(color, 0.15);
    ctx.fill();
}

export function cone(
    ctx: Ctx,
    cx: number,
    cy: number,
    r: number,
    z: number,
    h: number,
    color: string,
): void {
    const [sx, sy] = P(cx, cy, z);
    const rx = r * HW * Math.SQRT2;
    const ry = r * HH * Math.SQRT2;
    const gradient = ctx.createLinearGradient(sx - rx, 0, sx + rx, 0);

    gradient.addColorStop(0, shade(color, 0.08));
    gradient.addColorStop(1, shade(color, -0.3));
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI);
    ctx.lineTo(sx, sy - h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
}

export function dome(
    ctx: Ctx,
    cx: number,
    cy: number,
    r: number,
    z: number,
    color: string,
): void {
    const [sx, sy] = P(cx, cy, z);
    const rx = r * HW * Math.SQRT2;
    const gradient = ctx.createRadialGradient(
        sx - rx * 0.3,
        sy - rx * 0.6,
        1,
        sx,
        sy,
        rx * 1.2,
    );

    gradient.addColorStop(0, shade(color, 0.35));
    gradient.addColorStop(1, shade(color, -0.25));
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx, rx * 0.5, 0, 0, Math.PI);
    ctx.ellipse(sx, sy, rx, rx, 0, 0, Math.PI, true);
    ctx.fillStyle = gradient;
    ctx.fill();
}

/**
 * Windows on a visible wall: 'left' is the wall along x at y = y1, 'right'
 * the wall along y at x = x1.
 */
export function windows(
    ctx: Ctx,
    face: 'left' | 'right',
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    z: number,
    h: number,
    rows: number,
    cols: number,
    color: string | ((row: number, col: number) => string),
): void {
    const from = face === 'left' ? x0 : y0;
    const to = face === 'left' ? x1 : y1;
    const span = to - from;
    const cellW = span / cols;
    const cellH = h / rows;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const a = from + cellW * (col + 0.28);
            const b = from + cellW * (col + 0.72);
            const lo = z + cellH * row + cellH * 0.25;
            const hi = z + cellH * row + cellH * 0.75;
            const fill = typeof color === 'function' ? color(row, col) : color;
            const points: Point[] =
                face === 'left'
                    ? [P(a, y1, lo), P(b, y1, lo), P(b, y1, hi), P(a, y1, hi)]
                    : [P(x1, a, lo), P(x1, b, lo), P(x1, b, hi), P(x1, a, hi)];

            poly(
                ctx,
                points,
                face === 'right' && typeof color === 'string'
                    ? shade(fill, -0.2)
                    : fill,
            );
        }
    }
}

/** A door (or arch) in the middle of a visible wall. */
export function door(
    ctx: Ctx,
    face: 'left' | 'right',
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    z: number,
    width: number,
    height: number,
    color: string,
): void {
    const from = face === 'left' ? x0 : y0;
    const to = face === 'left' ? x1 : y1;
    const mid = (from + to) / 2;
    const a = mid - width / 2;
    const b = mid + width / 2;
    const points: Point[] =
        face === 'left'
            ? [
                  P(a, y1, z),
                  P(b, y1, z),
                  P(b, y1, z + height),
                  P(a, y1, z + height),
              ]
            : [
                  P(x1, a, z),
                  P(x1, b, z),
                  P(x1, b, z + height),
                  P(x1, a, z + height),
              ];

    poly(ctx, points, color);
}

export function flag(
    ctx: Ctx,
    x: number,
    y: number,
    z: number,
    h: number,
    color: string,
    t: number,
): void {
    const base = P(x, y, z);
    const top: Point = [base[0], base[1] - h];
    const wave = Math.sin(t * 4 + x * 3) * 2;

    line(ctx, base, top, '#4a3b2c', 1.2);
    poly(
        ctx,
        [top, [top[0] + 12, top[1] + 3 + wave], [top[0], top[1] + 7]],
        color,
    );
}
