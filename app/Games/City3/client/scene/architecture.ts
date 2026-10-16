/**
 * Architectural parts of building models: towers on any plan with
 * facades, prisms, crowns, colonnades, arcades, balconies, pilasters,
 * cornices, battlements, dormers, awnings, stairs, fences, solar panels,
 * chimneys, helipads, neon lines and clocks — and the facades of `floors`.
 *
 * Everything goes into the same merged buckets as the rest of a model
 * (see model.ts). What should glow after dark goes into the windows bucket
 * with a lit colour: dim by day, lit at night like the windows.
 */

import * as THREE from 'three';
import type {
    CrownStyle,
    FacadeStyle,
    ModelPart,
    PlanShape,
} from '../engine/content/types';
import type { Bucket } from './materials';
import {
    FACES,
    W,
    WINDOW_PROUD,
    append,
    box,
    bucketOf,
    faceFrame,
    facePoint,
    faceRect,
    faceStrip,
    num,
    poly,
    shaded,
} from './model';
import type {
    EmitterSpec,
    FaceFrame,
    GeoBucket,
    LightSpec,
    Lit,
    V3,
} from './model';

/** What an architectural part needs from the model being built. */
export interface ArchitectureKit {
    get(name: Bucket): GeoBucket;
    paint(value: string): THREE.Color;
    /** The next window's lit colour and threshold. */
    nextLit(): Lit;
    emitters: EmitterSpec[];
    lights: LightSpec[];
}

type P2 = [number, number];

const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

/** Lights up first thing at dusk and stays on all night. */
function nightGlow(c: THREE.Color): Lit {
    return [c.r, c.g, c.b, 0.02];
}

/* ---------------- Plans ---------------- */

/**
 * The outline of a plan fitted into a w × d box, centred on 0, as points
 * in model coordinates (x east, y south).
 */
export function planOutline(
    plan: PlanShape,
    w: number,
    d: number,
    r = 0,
): P2[] {
    const hx = w / 2;
    const hy = d / 2;
    const small = Math.min(hx, hy);

    switch (plan) {
        case 'ellipse':
            return Array.from({ length: 20 }, (_, i) => {
                const a = (i / 20) * Math.PI * 2;

                return [Math.cos(a) * hx, Math.sin(a) * hy] as P2;
            });

        case 'rounded': {
            const rr = clamp(r || small * 0.45, 0.005, small);
            const corners: [number, number, number][] = [
                [hx - rr, -hy + rr, -Math.PI / 2],
                [hx - rr, hy - rr, 0],
                [-hx + rr, hy - rr, Math.PI / 2],
                [-hx + rr, -hy + rr, Math.PI],
            ];
            const points: P2[] = [];

            for (const [cx, cy, start] of corners) {
                for (let i = 0; i <= 3; i++) {
                    const a = start + (i / 3) * (Math.PI / 2);

                    points.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
                }
            }

            return points;
        }

        case 'chamfer':
        case 'octagon': {
            const c =
                plan === 'octagon'
                    ? small * 0.586
                    : clamp(r || small * 0.3, 0.005, small * 0.95);

            return [
                [-hx + c, -hy],
                [hx - c, -hy],
                [hx, -hy + c],
                [hx, hy - c],
                [hx - c, hy],
                [-hx + c, hy],
                [-hx, hy - c],
                [-hx, -hy + c],
            ];
        }

        case 'tri':
            return [
                [0, -hy],
                [hx, hy],
                [-hx, hy],
            ];

        case 'cross': {
            const a = clamp(r || small * 0.36, 0.01, small * 0.95);

            return [
                [-a, -hy],
                [a, -hy],
                [a, -a],
                [hx, -a],
                [hx, a],
                [a, a],
                [a, hy],
                [-a, hy],
                [-a, a],
                [-hx, a],
                [-hx, -a],
                [-a, -a],
            ];
        }

        default:
            return [
                [-hx, -hy],
                [hx, -hy],
                [hx, hy],
                [-hx, hy],
            ];
    }
}

function signedArea(points: P2[]): number {
    let area = 0;

    for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i];
        const [bx, by] = points[(i + 1) % points.length];

        area += ax * by - bx * ay;
    }

    return area / 2;
}

/** A ring of a plan: scaled, turned (radians) and moved to cx, cy. */
function ring(
    outline: P2[],
    cx: number,
    cy: number,
    scale: number,
    angle: number,
): P2[] {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return outline.map(([x, y]) => [
        cx + (x * c - y * s) * scale,
        cy + (x * s + y * c) * scale,
    ]);
}

/** The frames of a ring's edges, each facing out. */
function edgeFrames(points: P2[]): FaceFrame[] {
    const ccw = signedArea(points) > 0;

    return points.map(([ax, ay], i) => {
        const [bx, by] = points[(i + 1) % points.length];
        const length = Math.hypot(bx - ax, by - ay) || 1e-6;
        const dx = (bx - ax) / length;
        const dy = (by - ay) / length;

        return {
            ox: ax,
            oy: ay,
            dx,
            dy,
            nx: ccw ? dy : -dy,
            ny: ccw ? -dx : dx,
            length,
        };
    });
}

/** Walls between two rings of the same plan. */
function ringWalls(
    bucket: GeoBucket,
    a: P2[],
    za: number,
    b: P2[],
    zb: number,
    c: THREE.Color,
): void {
    const frames = edgeFrames(a);

    for (let i = 0; i < a.length; i++) {
        const j = (i + 1) % a.length;

        poly(
            bucket,
            [
                W(a[i][0], a[i][1], za),
                W(a[j][0], a[j][1], za),
                W(b[j][0], b[j][1], zb),
                W(b[i][0], b[i][1], zb),
            ],
            c,
            [frames[i].nx, frames[i].ny, 0],
        );
    }
}

/** A flat face over a ring (any plan, concave too). */
function ringCap(
    bucket: GeoBucket,
    points: P2[],
    z: number,
    c: THREE.Color,
    up = true,
): void {
    const contour = points.map(([x, y]) => new THREE.Vector2(x, y));
    const triangles = THREE.ShapeUtils.triangulateShape(contour, []);

    for (const [i, j, k] of triangles) {
        poly(
            bucket,
            [
                W(points[i][0], points[i][1], z),
                W(points[j][0], points[j][1], z),
                W(points[k][0], points[k][1], z),
            ],
            c,
            [0, 0, up ? 1 : -1],
        );
    }
}

/** A prism on a ring, narrowing to `taper` at the top. */
function prismOf(
    bucket: GeoBucket,
    outline: P2[],
    cx: number,
    cy: number,
    z0: number,
    z1: number,
    c: THREE.Color,
    taper = 1,
): void {
    const bottom = ring(outline, cx, cy, 1, 0);
    const top = ring(outline, cx, cy, taper, 0);

    ringWalls(bucket, bottom, z0, top, z1, c);
    ringCap(bucket, top, z1, shaded(c, 0.92));

    if (z0 > 0.01) {
        ringCap(bucket, bottom, z0, shaded(c, 0.6), false);
    }
}

/* ---------------- Boxes on faces ---------------- */

/**
 * A box in face coordinates: along the face u0..u1, out of it p0..p1
 * (negative is inside), up z0..z1.
 */
function faceBox(
    bucket: GeoBucket,
    f: FaceFrame,
    u0: number,
    u1: number,
    p0: number,
    p1: number,
    z0: number,
    z1: number,
    c: THREE.Color,
    lit?: Lit,
): void {
    const v = (u: number, p: number, z: number) => facePoint(f, u, z, p);
    const out: V3 = [f.nx, f.ny, 0];
    const back: V3 = [-f.nx, -f.ny, 0];
    const right: V3 = [f.dx, f.dy, 0];
    const left: V3 = [-f.dx, -f.dy, 0];

    poly(
        bucket,
        [v(u0, p1, z0), v(u1, p1, z0), v(u1, p1, z1), v(u0, p1, z1)],
        c,
        out,
        lit,
    );
    poly(
        bucket,
        [v(u0, p0, z0), v(u1, p0, z0), v(u1, p0, z1), v(u0, p0, z1)],
        c,
        back,
        lit,
    );
    poly(
        bucket,
        [v(u0, p0, z0), v(u0, p1, z0), v(u0, p1, z1), v(u0, p0, z1)],
        c,
        left,
        lit,
    );
    poly(
        bucket,
        [v(u1, p0, z0), v(u1, p1, z0), v(u1, p1, z1), v(u1, p0, z1)],
        c,
        right,
        lit,
    );
    poly(
        bucket,
        [v(u0, p0, z1), v(u1, p0, z1), v(u1, p1, z1), v(u0, p1, z1)],
        c,
        [0, 0, 1],
        lit,
    );
    poly(
        bucket,
        [v(u0, p0, z0), v(u1, p0, z0), v(u1, p1, z0), v(u0, p1, z0)],
        c,
        [0, 0, -1],
        lit,
    );
}

/** A box in model coordinates that can light up at night. */
function litBox(
    bucket: GeoBucket,
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    c: THREE.Color,
    lit: Lit,
): void {
    const f: FaceFrame = {
        ox: x0,
        oy: y1,
        dx: 1,
        dy: 0,
        nx: 0,
        ny: 1,
        length: x1 - x0,
    };

    faceBox(bucket, f, 0, x1 - x0, -(y1 - y0), 0, z0, z1, c, lit);
}

/** A thin plate standing out of a face at u (a fin), seen from both sides. */
function fin(
    bucket: GeoBucket,
    f: FaceFrame,
    u: number,
    z0: number,
    z1: number,
    depth: number,
    c: THREE.Color,
): void {
    const points = [
        facePoint(f, u, z0, 0),
        facePoint(f, u, z0, depth),
        facePoint(f, u, z1, depth),
        facePoint(f, u, z1, 0),
    ];

    poly(bucket, points, c, [f.dx, f.dy, 0]);
    poly(bucket, points, shaded(c, 0.85), [-f.dx, -f.dy, 0]);
}

/** A round-topped opening on a face, u0..u1 wide, from z0 to z1. */
function archOpening(
    bucket: GeoBucket,
    f: FaceFrame,
    u0: number,
    u1: number,
    z0: number,
    z1: number,
    proud: number,
    c: THREE.Color,
    lit?: Lit,
): void {
    const radius = Math.min((u1 - u0) / 2, (z1 - z0) * 0.45);
    const spring = z1 - radius;
    const mid = (u0 + u1) / 2;
    const points: V3[] = [
        facePoint(f, u0, z0, proud),
        facePoint(f, u1, z0, proud),
    ];

    for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI;

        points.push(
            facePoint(
                f,
                mid + Math.cos(a) * ((u1 - u0) / 2),
                spring + Math.sin(a) * radius,
                proud,
            ),
        );
    }

    poly(bucket, points, c, [f.nx, f.ny, 0], lit);
}

/* ---------------- Facades ---------------- */

const BAY: Record<FacadeStyle, number> = {
    grid: 0.15,
    glass: 0.12,
    ribbon: 0.14,
    fins: 0.11,
    deco: 0.13,
    brick: 0.16,
    stone: 0.18,
    panel: 0.16,
    timber: 0.2,
};

interface FacadeColors {
    wall: THREE.Color;
    glass: THREE.Color;
    trim: THREE.Color;
}

/**
 * One storey of one wall: windows and the details of the facade style.
 * `shop` makes it a ground floor with big lit shopfronts.
 */
export function facadeStorey(
    kit: ArchitectureKit,
    f: FaceFrame,
    base: number,
    fh: number,
    style: FacadeStyle,
    colors: FacadeColors,
    shop = false,
): void {
    const windows = kit.get('windows');
    const matte = kit.get('matte');
    const { glass, trim } = colors;

    if (f.length < 0.035) {
        return;
    }

    const cols = Math.max(1, Math.floor(f.length / BAY[style] + 0.35));
    const cw = f.length / cols;
    const z = (share: number) => base + fh * share;

    if (shop) {
        for (let col = 0; col < cols; col++) {
            faceRect(
                windows,
                f,
                col * cw + cw * 0.08,
                col * cw + cw * 0.92,
                z(0.06),
                z(0.78),
                WINDOW_PROUD,
                glass,
                kit.nextLit(),
            );
        }

        faceRect(
            matte,
            f,
            0,
            f.length,
            z(0.8),
            z(0.92),
            WINDOW_PROUD * 1.6,
            trim,
        );

        return;
    }

    for (let col = 0; col < cols; col++) {
        const u = col * cw;
        const at = (share: number) => u + cw * share;

        switch (style) {
            case 'glass':
                faceRect(
                    windows,
                    f,
                    at(0.04),
                    at(0.96),
                    z(0.1),
                    z(0.98),
                    WINDOW_PROUD,
                    glass,
                    kit.nextLit(),
                );
                break;

            case 'ribbon':
                faceRect(
                    windows,
                    f,
                    u,
                    u + cw,
                    z(0.38),
                    z(0.9),
                    WINDOW_PROUD,
                    glass,
                    kit.nextLit(),
                );
                break;

            case 'fins':
                faceRect(
                    windows,
                    f,
                    at(0.06),
                    at(0.94),
                    z(0.1),
                    z(0.96),
                    WINDOW_PROUD,
                    glass,
                    kit.nextLit(),
                );
                fin(
                    matte,
                    f,
                    u,
                    base,
                    base + fh,
                    Math.min(0.03, cw * 0.3),
                    trim,
                );
                break;

            case 'deco':
                faceRect(
                    windows,
                    f,
                    at(0.32),
                    at(0.68),
                    z(0.16),
                    z(0.84),
                    WINDOW_PROUD,
                    glass,
                    kit.nextLit(),
                );
                faceRect(
                    matte,
                    f,
                    at(0.32),
                    at(0.68),
                    z(0.84),
                    z(1),
                    WINDOW_PROUD * 0.8,
                    shaded(trim, 0.62),
                );
                faceRect(
                    matte,
                    f,
                    u,
                    at(0.16),
                    base,
                    base + fh,
                    WINDOW_PROUD * 1.8,
                    trim,
                );
                faceRect(
                    matte,
                    f,
                    at(0.84),
                    u + cw,
                    base,
                    base + fh,
                    WINDOW_PROUD * 1.8,
                    trim,
                );
                break;

            case 'brick':
                faceRect(
                    windows,
                    f,
                    at(0.28),
                    at(0.72),
                    z(0.3),
                    z(0.78),
                    WINDOW_PROUD,
                    glass,
                    kit.nextLit(),
                );
                faceRect(
                    matte,
                    f,
                    at(0.23),
                    at(0.77),
                    z(0.25),
                    z(0.3),
                    WINDOW_PROUD * 2,
                    trim,
                );
                faceRect(
                    matte,
                    f,
                    at(0.25),
                    at(0.75),
                    z(0.78),
                    z(0.84),
                    WINDOW_PROUD * 1.6,
                    trim,
                );
                break;

            case 'stone':
                archOpening(
                    windows,
                    f,
                    at(0.3),
                    at(0.7),
                    z(0.24),
                    z(0.86),
                    WINDOW_PROUD,
                    glass,
                    kit.nextLit(),
                );
                faceRect(
                    matte,
                    f,
                    at(0.24),
                    at(0.76),
                    z(0.19),
                    z(0.24),
                    WINDOW_PROUD * 2,
                    trim,
                );
                break;

            case 'panel':
                faceRect(
                    windows,
                    f,
                    at(0.25),
                    at(0.75),
                    z(0.32),
                    z(0.78),
                    WINDOW_PROUD,
                    glass,
                    kit.nextLit(),
                );
                faceRect(
                    matte,
                    f,
                    u,
                    u + cw * 0.03,
                    base,
                    base + fh,
                    WINDOW_PROUD * 0.8,
                    shaded(colors.wall, 0.78),
                );
                faceRect(
                    matte,
                    f,
                    u,
                    u + cw,
                    base,
                    z(0.03),
                    WINDOW_PROUD * 0.8,
                    shaded(colors.wall, 0.78),
                );
                break;

            case 'timber':
                faceRect(
                    windows,
                    f,
                    at(0.3),
                    at(0.7),
                    z(0.34),
                    z(0.72),
                    WINDOW_PROUD,
                    glass,
                    kit.nextLit(),
                );
                faceStrip(
                    matte,
                    f,
                    u + 0.01,
                    base,
                    u + 0.01,
                    base + fh,
                    0.02,
                    0.004,
                    trim,
                );
                faceStrip(
                    matte,
                    f,
                    u,
                    base + 0.01,
                    u + cw,
                    base + 0.01,
                    0.018,
                    0.004,
                    trim,
                );
                faceStrip(
                    matte,
                    f,
                    u,
                    col % 2 ? base : base + fh,
                    at(0.28),
                    z(0.53),
                    0.016,
                    0.004,
                    trim,
                );
                faceStrip(
                    matte,
                    f,
                    at(0.72),
                    z(0.53),
                    u + cw,
                    col % 2 ? base + fh : base,
                    0.016,
                    0.004,
                    trim,
                );
                break;

            default:
                faceRect(
                    windows,
                    f,
                    at(0.22),
                    at(0.78),
                    z(0.28),
                    z(0.78),
                    WINDOW_PROUD,
                    glass,
                    kit.nextLit(),
                );
        }
    }

    if (style === 'glass' || style === 'ribbon') {
        // Slab edge between storeys.
        faceRect(
            matte,
            f,
            0,
            f.length,
            base,
            z(style === 'ribbon' ? 0.06 : 0.1),
            WINDOW_PROUD * 1.4,
            trim,
        );
    }
}

/** A projecting moulding around a box top. */
function cornice(
    bucket: GeoBucket,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    z: number,
    h: number,
    out: number,
    c: THREE.Color,
): void {
    box(
        bucket,
        x0 - out * 0.5,
        y0 - out * 0.5,
        z,
        x1 + out * 0.5,
        y1 + out * 0.5,
        z + h * 0.45,
        shaded(c, 0.9),
        true,
    );
    box(
        bucket,
        x0 - out,
        y0 - out,
        z + h * 0.45,
        x1 + out,
        y1 + out,
        z + h,
        c,
        true,
    );
}

/**
 * `floors` drawn with a facade style, a plinth or a cornice. Plain grid
 * floors keep their old drawing (model.ts).
 */
export function addStyledFloors(
    kit: ArchitectureKit,
    part: Extract<ModelPart, { kind: 'floors' }>,
): void {
    const x0 = num(part.x);
    const y0 = num(part.y);
    const x1 = x0 + num(part.w, 0.5);
    const y1 = y0 + num(part.d, 0.5);
    const z0 = num(part.z);
    const floors = Math.max(1, Math.round(num(part.floors, 1)));
    const fh = Math.max(0.05, num(part.floorHeight, 0.2));
    const top = z0 + floors * fh;
    const walls = kit.get(bucketOf(part.material));
    const wall = kit.paint(part.color);
    const colors: FacadeColors = {
        wall,
        glass: kit.paint(part.window),
        trim: kit.paint(part.band ?? part.cornice ?? 'trim'),
    };
    const style = part.facade ?? 'grid';

    box(walls, x0, y0, z0, x1, y1, top, wall, z0 > 0.01);

    if (part.plinth) {
        box(
            kit.get('matte'),
            x0 - 0.006,
            y0 - 0.006,
            z0,
            x1 + 0.006,
            y1 + 0.006,
            z0 + fh,
            kit.paint(part.plinth),
            z0 > 0.01,
        );
    }

    if (part.band) {
        const band = kit.paint(part.band);

        for (let i = 1; i < floors; i++) {
            const z = z0 + i * fh;

            box(
                walls,
                x0 - 0.008,
                y0 - 0.008,
                z - 0.012,
                x1 + 0.008,
                y1 + 0.008,
                z + 0.006,
                band,
                true,
            );
        }
    }

    for (const face of FACES) {
        const f = faceFrame(face, x0, y0, x1, y1);

        for (let i = 0; i < floors; i++) {
            facadeStorey(
                kit,
                f,
                z0 + i * fh,
                fh,
                style,
                colors,
                i === 0 && Boolean(part.plinth),
            );
        }
    }

    if (part.cornice) {
        cornice(
            kit.get('matte'),
            x0,
            y0,
            x1,
            y1,
            top,
            0.045,
            0.03,
            kit.paint(part.cornice),
        );
    }
}

/* ---------------- The parts ---------------- */

/** Draws an architectural part; false if `part` is not one. */
export function addArchitecture(
    part: ModelPart,
    kit: ArchitectureKit,
): boolean {
    switch (part.kind) {
        case 'tower':
            addTower(kit, part);

            return true;

        case 'prism': {
            const w = num(part.w, 0.5);
            const d = num(part.d, 0.5);
            const z0 = num(part.z);

            prismOf(
                kit.get(bucketOf(part.material)),
                planOutline(part.plan, w, d, num(part.r)),
                num(part.x) + w / 2,
                num(part.y) + d / 2,
                z0,
                z0 + num(part.h, 0.1),
                kit.paint(part.color),
                clamp(num(part.taper, 1), 0, 2),
            );

            return true;
        }

        case 'crown':
            addCrown(kit, part);

            return true;

        case 'columns':
            addColumns(kit, part);

            return true;

        case 'arches': {
            const x0 = num(part.x);
            const y0 = num(part.y);
            const z0 = num(part.z);
            const h = num(part.h, 0.2);
            const count = Math.max(1, Math.round(num(part.count, 3)));
            const c = kit.paint(part.color);
            const opening = kit.paint(part.opening ?? 'window');

            for (const face of part.faces ?? []) {
                const f = faceFrame(
                    face,
                    x0,
                    y0,
                    x0 + num(part.w, 0.5),
                    y0 + num(part.d, 0.5),
                );
                const bay = f.length / count;

                for (let i = 0; i < count; i++) {
                    archOpening(
                        kit.get('windows'),
                        f,
                        i * bay + bay * 0.17,
                        (i + 1) * bay - bay * 0.17,
                        z0,
                        z0 + h * 0.92,
                        WINDOW_PROUD,
                        opening,
                        kit.nextLit(),
                    );
                }

                faceRect(
                    kit.get('matte'),
                    f,
                    0,
                    f.length,
                    z0 + h * 0.92,
                    z0 + h,
                    WINDOW_PROUD * 1.6,
                    c,
                );
            }

            return true;
        }

        case 'balconies': {
            const x0 = num(part.x);
            const y0 = num(part.y);
            const z0 = num(part.z);
            const floors = Math.max(1, Math.round(num(part.floors, 1)));
            const fh = num(part.floorHeight, 0.15);
            const depth = num(part.depth, 0.05);
            const c = kit.paint(part.color);
            const rail = kit.paint(part.rail ?? part.color);

            for (const face of part.faces ?? []) {
                const f = faceFrame(
                    face,
                    x0,
                    y0,
                    x0 + num(part.w, 0.5),
                    y0 + num(part.d, 0.5),
                );
                const cols = Math.max(1, Math.floor(f.length / 0.3));
                const cw = f.length / cols;

                for (let i = 0; i < floors; i++) {
                    const z = z0 + i * fh;

                    for (let col = 0; col < cols; col++) {
                        const u0 = col * cw + cw * 0.12;
                        const u1 = (col + 1) * cw - cw * 0.12;

                        faceBox(
                            kit.get('matte'),
                            f,
                            u0,
                            u1,
                            0,
                            depth,
                            z,
                            z + 0.012,
                            c,
                        );
                        faceBox(
                            kit.get(part.glass ? 'glass' : 'matte'),
                            f,
                            u0,
                            u1,
                            depth - 0.005,
                            depth,
                            z + 0.012,
                            z + 0.058,
                            rail,
                        );
                    }
                }
            }

            return true;
        }

        case 'pilasters': {
            const x0 = num(part.x);
            const y0 = num(part.y);
            const z0 = num(part.z);
            const z1 = z0 + num(part.h, 0.2);
            const count = Math.max(1, Math.round(num(part.count, 4)));
            const c = kit.paint(part.color);
            const matte = kit.get('matte');

            for (const face of part.faces ?? []) {
                const f = faceFrame(
                    face,
                    x0,
                    y0,
                    x0 + num(part.w, 0.5),
                    y0 + num(part.d, 0.5),
                );
                const pw = clamp((f.length / count) * 0.18, 0.016, 0.04);

                for (let i = 0; i < count; i++) {
                    const u =
                        count === 1
                            ? f.length / 2
                            : clamp(
                                  (i * f.length) / (count - 1),
                                  pw,
                                  f.length - pw,
                              );

                    faceBox(
                        matte,
                        f,
                        u - pw / 2,
                        u + pw / 2,
                        0,
                        0.012,
                        z0,
                        z1,
                        c,
                    );
                    faceBox(
                        matte,
                        f,
                        u - pw * 0.8,
                        u + pw * 0.8,
                        0,
                        0.02,
                        z1 - 0.022,
                        z1,
                        shaded(c, 1.05),
                    );
                    faceBox(
                        matte,
                        f,
                        u - pw * 0.75,
                        u + pw * 0.75,
                        0,
                        0.018,
                        z0,
                        z0 + 0.018,
                        shaded(c, 0.92),
                    );
                }
            }

            return true;
        }

        case 'cornice': {
            const x0 = num(part.x);
            const y0 = num(part.y);

            cornice(
                kit.get('matte'),
                x0,
                y0,
                x0 + num(part.w, 0.5),
                y0 + num(part.d, 0.5),
                num(part.z),
                num(part.h, 0.045),
                num(part.out, 0.03),
                kit.paint(part.color),
            );

            return true;
        }

        case 'crenels':
            addCrenels(kit, part);

            return true;

        case 'dormers':
            addDormers(kit, part);

            return true;

        case 'awning':
            addAwning(kit, part);

            return true;

        case 'stairs': {
            const x0 = num(part.x);
            const y0 = num(part.y);
            const f = faceFrame(
                part.face ?? 's',
                x0,
                y0,
                x0 + num(part.w, 0.5),
                y0 + num(part.d, 0.5),
            );
            const steps = Math.max(1, Math.round(num(part.steps, 3)));
            const width = Math.min(f.length, num(part.width, 0.3));
            const height = num(part.height, 0.05);
            const u0 = (f.length - width) / 2;
            const c = kit.paint(part.color);

            for (let i = 0; i < steps; i++) {
                faceBox(
                    kit.get('matte'),
                    f,
                    u0,
                    u0 + width,
                    0,
                    0.035 * (steps - i),
                    (height * i) / steps,
                    (height * (i + 1)) / steps,
                    i % 2 ? c : shaded(c, 0.94),
                );
            }

            return true;
        }

        case 'fence':
            addFence(kit, part);

            return true;

        case 'solar':
            addSolar(kit, part);

            return true;

        case 'chimney': {
            const x = num(part.x);
            const y = num(part.y);
            const z = num(part.z);
            const hw = num(part.w, 0.06) / 2;
            const h = num(part.h, 0.15);
            const c = kit.paint(part.color);

            box(
                kit.get('matte'),
                x - hw,
                y - hw,
                z,
                x + hw,
                y + hw,
                z + h,
                c,
                z > 0.01,
            );
            box(
                kit.get('matte'),
                x - hw * 1.3,
                y - hw * 1.3,
                z + h,
                x + hw * 1.3,
                y + hw * 1.3,
                z + h + 0.02,
                shaded(c, 0.7),
                true,
            );

            if (part.smoke) {
                kit.emitters.push({
                    position: new THREE.Vector3(x, z + h + 0.03, y),
                    type: 'smoke',
                });
            }

            return true;
        }

        case 'helipad':
            addHelipad(kit, part);

            return true;

        case 'neon':
            addNeon(kit, part);

            return true;

        case 'clock':
            addClock(kit, part);

            return true;

        default:
            return false;
    }
}

function addTower(
    kit: ArchitectureKit,
    part: Extract<ModelPart, { kind: 'tower' }>,
): void {
    const w = num(part.w, 0.5);
    const d = num(part.d, 0.5);
    const cx = num(part.x) + w / 2;
    const cy = num(part.y) + d / 2;
    const z0 = num(part.z);
    const floors = clamp(Math.round(num(part.floors, 1)), 1, 160);
    const fh = Math.max(0.05, num(part.floorHeight, 0.15));
    const taper = clamp(num(part.taper, 1), 0.15, 2);
    const twist = (num(part.twist) * Math.PI) / 180;
    const outline = planOutline(part.plan, w, d, num(part.r));
    const walls = kit.get(bucketOf(part.material));
    const wall = kit.paint(part.color);
    const colors: FacadeColors = {
        wall,
        glass: kit.paint(part.window),
        trim: kit.paint(part.trim ?? 'trim'),
    };
    const style = part.facade ?? 'glass';
    const at = (i: number) =>
        ring(
            outline,
            cx,
            cy,
            1 + (taper - 1) * (i / floors),
            twist * (i / floors),
        );
    const top = z0 + floors * fh;
    // A tower that only narrows keeps flat walls: one piece per edge. A
    // twisting one is built in steps.
    const steps = Math.abs(twist) > 1e-3 ? Math.min(floors, 24) : 1;
    let below = at(0);

    if (z0 > 0.01) {
        ringCap(walls, below, z0, shaded(wall, 0.6), false);
    }

    for (let step = 1; step <= steps; step++) {
        const above = at((floors * step) / steps);

        ringWalls(
            walls,
            below,
            z0 + ((top - z0) * (step - 1)) / steps,
            above,
            z0 + ((top - z0) * step) / steps,
            wall,
        );
        below = above;
    }

    for (let i = 0; i < floors; i++) {
        for (const f of edgeFrames(at(i + 0.5))) {
            facadeStorey(kit, f, z0 + i * fh, fh, style, colors);
        }
    }

    ringCap(walls, below, top, kit.paint(part.cap ?? part.trim ?? 'roof'));
    // A parapet band round the top.
    ringWalls(kit.get('matte'), below, top, below, top + 0.025, colors.trim);
}

function addCrown(
    kit: ArchitectureKit,
    part: Extract<ModelPart, { kind: 'crown' }>,
): void {
    const w = num(part.w, 0.5);
    const d = num(part.d, 0.5);
    const cx = num(part.x) + w / 2;
    const cy = num(part.y) + d / 2;
    const z0 = num(part.z);
    const h = num(part.h, 0.2);
    const outline = planOutline(part.plan ?? 'rect', w, d, num(part.r));
    const c = kit.paint(part.color);
    const glow = part.glow ? kit.paint(part.glow) : null;
    const matte = kit.get('matte');
    const style: CrownStyle = part.style ?? 'fins';
    const base = ring(outline, cx, cy, 1, 0);

    switch (style) {
        case 'stepped':
            for (let i = 0; i < 3; i++) {
                const scale = 0.86 - i * 0.18;

                prismOf(
                    matte,
                    outline.map(([x, y]) => [x * scale, y * scale] as P2),
                    cx,
                    cy,
                    z0 + (h * i) / 3,
                    z0 + (h * (i + 1)) / 3,
                    shaded(c, 1 - i * 0.04),
                );
            }

            break;

        case 'spike': {
            const apex = W(cx, cy, z0 + h);

            for (const f of edgeFrames(base)) {
                poly(
                    kit.get('metal'),
                    [
                        facePoint(f, 0, z0, 0),
                        facePoint(f, f.length, z0, 0),
                        apex,
                    ],
                    c,
                    [f.nx, f.ny, Math.min(w, d) / h],
                );
            }

            break;
        }

        case 'halo': {
            const outer = ring(outline, cx, cy, 1.1, 0);
            const inner = ring(outline, cx, cy, 1.02, 0);
            const band = kit.get(glow ? 'windows' : 'matte');
            const zb0 = z0 + h * 0.55;
            const zb1 = z0 + h * 0.72;
            const lit = glow ? nightGlow(glow) : undefined;

            for (const [points, flip] of [
                [outer, false],
                [inner, true],
            ] as [P2[], boolean][]) {
                const frames = edgeFrames(points);

                for (let i = 0; i < points.length; i++) {
                    const j = (i + 1) % points.length;

                    poly(
                        band,
                        [
                            W(points[i][0], points[i][1], zb0),
                            W(points[j][0], points[j][1], zb0),
                            W(points[j][0], points[j][1], zb1),
                            W(points[i][0], points[i][1], zb1),
                        ],
                        c,
                        flip
                            ? [-frames[i].nx, -frames[i].ny, 0]
                            : [frames[i].nx, frames[i].ny, 0],
                        lit,
                    );
                }
            }

            for (const [x, y] of [base[0], base[Math.floor(base.length / 2)]]) {
                box(
                    matte,
                    x - 0.012,
                    y - 0.012,
                    z0,
                    x + 0.012,
                    y + 0.012,
                    zb1,
                    c,
                );
            }

            break;
        }

        default: {
            for (const f of edgeFrames(base)) {
                const count = Math.max(1, Math.round(f.length / 0.07));

                for (let i = 0; i <= count; i++) {
                    fin(matte, f, (i * f.length) / count, z0, z0 + h, 0.025, c);
                }
            }

            ringWalls(matte, base, z0 + h - 0.03, base, z0 + h, c);
        }
    }

    if (glow && style !== 'halo') {
        const glowRing = ring(outline, cx, cy, 1.01, 0);
        const top = style === 'spike' ? z0 + 0.02 : z0 + h;

        for (const f of edgeFrames(glowRing)) {
            faceRect(
                kit.get('windows'),
                f,
                0,
                f.length,
                top - 0.014,
                top,
                0.004,
                shaded(glow, 0.7),
                nightGlow(glow),
            );
        }
    }

    if (glow) {
        kit.lights.push({
            position: new THREE.Vector3(cx, z0 + h, cy),
            radius: Math.max(0.4, Math.min(w, d)),
            color: glow.clone(),
        });
    }
}

function addColumns(
    kit: ArchitectureKit,
    part: Extract<ModelPart, { kind: 'columns' }>,
): void {
    const x0 = num(part.x);
    const y0 = num(part.y);
    const f = faceFrame(
        part.face ?? 's',
        x0,
        y0,
        x0 + num(part.w, 0.5),
        y0 + num(part.d, 0.5),
    );
    const z0 = num(part.z);
    const h = num(part.h, 0.25);
    const count = Math.max(2, Math.round(num(part.count, 4)));
    const c = kit.paint(part.color);
    const margin = Math.min(0.05, f.length * 0.08);
    const radius = clamp(
        ((f.length - margin * 2) / count) * 0.17,
        0.012,
        0.045,
    );
    const depth = num(part.depth, radius * 3 + 0.04);
    const matte = kit.get('matte');
    const matrix = new THREE.Matrix4();
    const entablature = Math.max(0.03, h * 0.12);

    // Podium step and the beam on top.
    faceBox(
        matte,
        f,
        0,
        f.length,
        0,
        depth + 0.025,
        z0,
        z0 + 0.022,
        shaded(c, 0.9),
    );
    faceBox(
        matte,
        f,
        0,
        f.length,
        -0.002,
        depth + 0.012,
        z0 + h - entablature,
        z0 + h,
        c,
    );

    for (let i = 0; i < count; i++) {
        const u = margin + ((f.length - margin * 2) * (i + 0.5)) / count;
        const shaft = h - entablature - 0.022;
        const p = facePoint(f, u, z0 + 0.022 + shaft / 2, depth - radius);

        matrix.makeTranslation(p[0], p[1], p[2]);
        append(
            matte,
            new THREE.CylinderGeometry(radius * 0.86, radius, shaft, 10),
            matrix,
            c,
        );
        faceBox(
            matte,
            f,
            u - radius * 1.3,
            u + radius * 1.3,
            depth - radius * 2.3,
            depth + radius * 0.3,
            z0 + h - entablature - 0.016,
            z0 + h - entablature,
            shaded(c, 1.05),
        );
    }

    if (part.pediment) {
        const pc = kit.paint(part.pediment);
        const zt = z0 + h;
        const rise = Math.min(0.22, f.length * 0.2);
        const front = depth + 0.012;
        const v = (u: number, z: number, p: number) => facePoint(f, u, z, p);

        poly(
            matte,
            [
                v(0, zt, front),
                v(f.length, zt, front),
                v(f.length / 2, zt + rise, front),
            ],
            c,
            [f.nx, f.ny, 0],
        );
        poly(
            matte,
            [
                v(-0.01, zt, front + 0.01),
                v(f.length / 2, zt + rise + 0.012, front + 0.01),
                v(f.length / 2, zt + rise + 0.012, -0.002),
                v(-0.01, zt, -0.002),
            ],
            pc,
            [-f.dx * rise, -f.dy * rise, f.length / 2],
        );
        poly(
            matte,
            [
                v(f.length + 0.01, zt, front + 0.01),
                v(f.length / 2, zt + rise + 0.012, front + 0.01),
                v(f.length / 2, zt + rise + 0.012, -0.002),
                v(f.length + 0.01, zt, -0.002),
            ],
            pc,
            [f.dx * rise, f.dy * rise, f.length / 2],
        );
    }
}

function addCrenels(
    kit: ArchitectureKit,
    part: Extract<ModelPart, { kind: 'crenels' }>,
): void {
    const x0 = num(part.x);
    const y0 = num(part.y);
    const z0 = num(part.z);
    const h = num(part.h, 0.08);
    const c = kit.paint(part.color);
    const matte = kit.get('matte');
    const t = 0.035;
    const wall = z0 + h * 0.5;

    for (const face of FACES) {
        const f = faceFrame(
            face,
            x0,
            y0,
            x0 + num(part.w, 0.5),
            y0 + num(part.d, 0.5),
        );
        const count = Math.max(3, Math.round(f.length / 0.07) | 1);
        const step = f.length / count;

        faceBox(matte, f, 0, f.length, -t, 0.006, z0, wall, c);

        for (let i = 0; i < count; i += 2) {
            faceBox(
                matte,
                f,
                i * step,
                (i + 1) * step,
                -t,
                0.006,
                wall,
                z0 + h,
                shaded(c, 1.04),
            );
        }
    }
}

function addDormers(
    kit: ArchitectureKit,
    part: Extract<ModelPart, { kind: 'dormers' }>,
): void {
    const x0 = num(part.x);
    const y0 = num(part.y);
    const f = faceFrame(
        part.face ?? 's',
        x0,
        y0,
        x0 + num(part.w, 0.5),
        y0 + num(part.d, 0.5),
    );
    const z = num(part.z);
    const h = num(part.h, 0.08);
    const count = Math.max(1, Math.round(num(part.count, 2)));
    const c = kit.paint(part.color);
    const roof = kit.paint(part.roof);
    const glass = kit.paint(part.window ?? 'window');
    const matte = kit.get('matte');
    const inset = 0.05;
    const deep = 0.14;
    const width = Math.min(0.13, (f.length / count) * 0.55);

    for (let i = 0; i < count; i++) {
        const uc = (f.length * (i + 0.5)) / count;
        const u0 = uc - width / 2;
        const u1 = uc + width / 2;
        const top = z + h;
        const rise = width * 0.45;
        const v = (u: number, zz: number, p: number) => facePoint(f, u, zz, p);

        faceBox(matte, f, u0, u1, -inset - deep, -inset, z, top, c);
        poly(
            matte,
            [v(u0, top, -inset), v(u1, top, -inset), v(uc, top + rise, -inset)],
            c,
            [f.nx, f.ny, 0],
        );
        poly(
            matte,
            [
                v(u0 - 0.01, top, -inset + 0.012),
                v(uc, top + rise + 0.01, -inset + 0.012),
                v(uc, top + rise + 0.01, -inset - deep),
                v(u0 - 0.01, top, -inset - deep),
            ],
            roof,
            [-f.dx * rise, -f.dy * rise, width / 2],
        );
        poly(
            matte,
            [
                v(u1 + 0.01, top, -inset + 0.012),
                v(uc, top + rise + 0.01, -inset + 0.012),
                v(uc, top + rise + 0.01, -inset - deep),
                v(u1 + 0.01, top, -inset - deep),
            ],
            roof,
            [f.dx * rise, f.dy * rise, width / 2],
        );
        faceRect(
            kit.get('windows'),
            f,
            u0 + width * 0.2,
            u1 - width * 0.2,
            z + h * 0.18,
            z + h * 0.85,
            -inset + 0.004,
            glass,
            kit.nextLit(),
        );
    }
}

function addAwning(
    kit: ArchitectureKit,
    part: Extract<ModelPart, { kind: 'awning' }>,
): void {
    const x0 = num(part.x);
    const y0 = num(part.y);
    const f = faceFrame(
        part.face ?? 's',
        x0,
        y0,
        x0 + num(part.w, 0.5),
        y0 + num(part.d, 0.5),
    );
    const z = num(part.z, 0.2);
    const depth = num(part.depth, 0.1);
    const drop = depth * 0.55;
    const a = kit.paint(part.color);
    const b = part.stripe ? kit.paint(part.stripe) : shaded(a, 0.85);
    const matte = kit.get('matte');
    const stripes = Math.max(2, Math.round(f.length / 0.05));
    const step = f.length / stripes;
    const up: V3 = [f.nx * drop, f.ny * drop, depth];

    for (let i = 0; i < stripes; i++) {
        const u0 = i * step;
        const u1 = u0 + step;
        const c = i % 2 ? b : a;
        const points = [
            facePoint(f, u0, z, 0),
            facePoint(f, u1, z, 0),
            facePoint(f, u1, z - drop, depth),
            facePoint(f, u0, z - drop, depth),
        ];

        poly(matte, points, c, up);
        poly(matte, points, shaded(c, 0.6), [-up[0], -up[1], -up[2]]);
        faceRect(matte, f, u0, u1, z - drop - 0.028, z - drop, depth, c);
    }
}

function addFence(
    kit: ArchitectureKit,
    part: Extract<ModelPart, { kind: 'fence' }>,
): void {
    const x0 = num(part.x);
    const y0 = num(part.y);
    const h = num(part.h, 0.07);
    const c = kit.paint(part.color);
    const matte = kit.get('matte');

    for (const face of FACES) {
        const f = faceFrame(
            face,
            x0,
            y0,
            x0 + num(part.w, 1),
            y0 + num(part.d, 1),
        );
        const gap = part.gate === face ? Math.min(0.26, f.length * 0.4) : 0;
        const spans: [number, number][] = gap
            ? [
                  [0, (f.length - gap) / 2],
                  [(f.length + gap) / 2, f.length],
              ]
            : [[0, f.length]];

        for (const [u0, u1] of spans) {
            if (part.solid) {
                faceBox(matte, f, u0, u1, -0.028, 0, 0, h, c);
                faceBox(
                    matte,
                    f,
                    u0,
                    u1,
                    -0.034,
                    0.006,
                    h,
                    h + 0.012,
                    shaded(c, 0.9),
                );
                continue;
            }

            const posts = Math.max(1, Math.round((u1 - u0) / 0.12));

            for (let i = 0; i <= posts; i++) {
                const u = u0 + ((u1 - u0) * i) / posts;

                faceBox(
                    matte,
                    f,
                    u - 0.007,
                    u + 0.007,
                    -0.014,
                    0,
                    0,
                    h,
                    shaded(c, 0.85),
                );
            }

            faceBox(
                matte,
                f,
                u0,
                u1,
                -0.011,
                -0.004,
                h * 0.4,
                h * 0.4 + 0.01,
                c,
            );
            faceBox(
                matte,
                f,
                u0,
                u1,
                -0.011,
                -0.004,
                h * 0.82,
                h * 0.82 + 0.01,
                c,
            );
        }
    }
}

function addSolar(
    kit: ArchitectureKit,
    part: Extract<ModelPart, { kind: 'solar' }>,
): void {
    const x0 = num(part.x);
    const y0 = num(part.y);
    const w = num(part.w, 0.5);
    const d = num(part.d, 0.5);
    const z = num(part.z) + 0.015;
    const rows = Math.max(1, Math.round(num(part.rows, 2)));
    const panel = kit.paint(part.color ?? '#1f3b63');
    const frame = kit.paint('metal');
    const row = d / rows;
    const cols = Math.max(1, Math.round(w / 0.22));
    const cw = w / cols;

    for (let r = 0; r < rows; r++) {
        const ya = y0 + r * row + row * 0.1;
        const yb = ya + row * 0.7;
        const rise = row * 0.32;

        for (let col = 0; col < cols; col++) {
            const xa = x0 + col * cw + 0.006;
            const xb = x0 + (col + 1) * cw - 0.006;

            poly(
                kit.get('metal'),
                [
                    W(xa, ya, z + rise),
                    W(xb, ya, z + rise),
                    W(xb, yb, z),
                    W(xa, yb, z),
                ],
                panel,
                [0, rise, yb - ya],
            );
            box(
                kit.get('matte'),
                xa,
                ya,
                z - 0.015,
                xa + 0.01,
                ya + 0.01,
                z + rise,
                frame,
            );
            box(
                kit.get('matte'),
                xb - 0.01,
                ya,
                z - 0.015,
                xb,
                ya + 0.01,
                z + rise,
                frame,
            );
        }
    }
}

function addHelipad(
    kit: ArchitectureKit,
    part: Extract<ModelPart, { kind: 'helipad' }>,
): void {
    const x = num(part.x);
    const y = num(part.y);
    const z = num(part.z);
    const r = num(part.r, 0.2);
    const matrix = new THREE.Matrix4().makeTranslation(x, z + 0.012, y);
    const white = kit.paint('#f2f2f2');
    const amber = kit.paint('#ffc14d');
    const top = z + 0.026;
    const s = r * 0.42;

    append(
        kit.get('matte'),
        new THREE.CylinderGeometry(r, r, 0.024, 28),
        matrix,
        kit.paint('#3a4048'),
    );
    box(
        kit.get('matte'),
        x - s * 0.62,
        y - s,
        top - 0.002,
        x - s * 0.42,
        y + s,
        top,
        white,
    );
    box(
        kit.get('matte'),
        x + s * 0.42,
        y - s,
        top - 0.002,
        x + s * 0.62,
        y + s,
        top,
        white,
    );
    box(
        kit.get('matte'),
        x - s * 0.42,
        y - s * 0.1,
        top - 0.002,
        x + s * 0.42,
        y + s * 0.1,
        top,
        white,
    );

    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const lx = x + Math.cos(a) * r * 0.92;
        const ly = y + Math.sin(a) * r * 0.92;

        litBox(
            kit.get('windows'),
            lx - 0.01,
            ly - 0.01,
            top - 0.004,
            lx + 0.01,
            ly + 0.01,
            top + 0.008,
            amber,
            nightGlow(amber),
        );
    }
}

function addNeon(
    kit: ArchitectureKit,
    part: Extract<ModelPart, { kind: 'neon' }>,
): void {
    const x0 = num(part.x);
    const y0 = num(part.y);
    const x1 = x0 + num(part.w, 0.5);
    const y1 = y0 + num(part.d, 0.5);
    const z0 = num(part.z);
    const h = num(part.h, 0.3);
    const c = kit.paint(part.color);
    const day = shaded(c, 0.75);
    const lit = nightGlow(c);
    const bucket = kit.get('windows');
    const t = 0.009;
    const rings = Math.max(0, Math.round(num(part.rings, 1)));

    if (part.corners !== false) {
        for (const [x, y] of [
            [x0, y0],
            [x1, y0],
            [x1, y1],
            [x0, y1],
        ]) {
            litBox(bucket, x - t, y - t, z0, x + t, y + t, z0 + h, day, lit);
        }
    }

    for (let k = 1; k <= rings; k++) {
        const z = z0 + (h * k) / rings;

        litBox(bucket, x0 - t, y0 - t, z - t, x1 + t, y0 + t, z, day, lit);
        litBox(bucket, x0 - t, y1 - t, z - t, x1 + t, y1 + t, z, day, lit);
        litBox(bucket, x0 - t, y0 - t, z - t, x0 + t, y1 + t, z, day, lit);
        litBox(bucket, x1 - t, y0 - t, z - t, x1 + t, y1 + t, z, day, lit);
    }
}

function addClock(
    kit: ArchitectureKit,
    part: Extract<ModelPart, { kind: 'clock' }>,
): void {
    const x0 = num(part.x);
    const y0 = num(part.y);
    const f = faceFrame(
        part.face ?? 's',
        x0,
        y0,
        x0 + num(part.w, 0.5),
        y0 + num(part.d, 0.5),
    );
    const z = num(part.z, 0.3);
    const r = num(part.r, 0.06);
    const u = f.length / 2;
    const dial = kit.paint(part.color ?? '#f3ecd8');
    const rim = kit.paint('#3b3a36');
    const segments = 20;
    const disk: V3[] = [];
    const point = (a: number, radius: number, proud: number) =>
        facePoint(f, u + Math.cos(a) * radius, z + Math.sin(a) * radius, proud);

    for (let i = 0; i < segments; i++) {
        disk.push(point((i / segments) * Math.PI * 2, r, 0.012));
    }

    poly(
        kit.get('windows'),
        disk,
        dial,
        [f.nx, f.ny, 0],
        [1, 0.92, 0.72, 0.05],
    );

    for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        const b = ((i + 1) / segments) * Math.PI * 2;

        poly(
            kit.get('matte'),
            [
                point(a, r, 0.014),
                point(b, r, 0.014),
                point(b, r * 1.18, 0.014),
                point(a, r * 1.18, 0.014),
            ],
            rim,
            [f.nx, f.ny, 0],
        );
    }

    faceStrip(kit.get('matte'), f, u, z, u, z + r * 0.78, r * 0.09, 0.016, rim);
    faceStrip(
        kit.get('matte'),
        f,
        u,
        z,
        u + r * 0.55,
        z - r * 0.2,
        r * 0.1,
        0.016,
        rim,
    );
}
