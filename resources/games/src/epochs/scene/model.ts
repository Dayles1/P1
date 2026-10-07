/**
 * Turns a building model from the content files (a list of ModelPart) into
 * three.js geometry. Static parts are merged into one non-indexed geometry
 * per material bucket (matte, metal, glass, glow, windows, foliage, flag)
 * with vertex colours; moving parts (blades, spinning rings, blinking
 * lights) come out as separate specs; emitters and lights as points.
 *
 * Model coordinates: x east, y south, z up, in tiles from the building's
 * corner. Local three.js coordinates: X = x, Y = z, Z = y.
 */

import * as THREE from 'three';
import type {
    Face,
    Material,
    ModelPart,
    Palette,
    RoofShape,
} from '../engine/content/types';
import { color, hash3, resolveColor } from './colors';
import type { Bucket, MaterialSet } from './materials';
import { BUCKETS } from './materials';

type V3 = [number, number, number];
type Lit = [number, number, number, number];

export interface ModelOptions {
    /** Index into palette.walls for "walls". */
    wallIndex: number;
    /** Varies which windows are lit at night. */
    seed: number;
    /** Replaces the shape of every roof part (blueprints). */
    roof?: RoofShape | null;
}

export interface AnimatedSpec {
    kind: 'spin' | 'blink';
    geometry: THREE.BufferGeometry;
    bucket: Bucket;
    /** Pivot in local coordinates. */
    pivot: THREE.Vector3;
    /** Orientation of the pivot frame. */
    orient: THREE.Euler;
    /** The pivot-frame axis it spins around. */
    axis: 'x' | 'y' | 'z';
    /** Turns per second (spin) or blinks per second (blink). */
    speed: number;
}

export interface EmitterSpec {
    position: THREE.Vector3;
    type: 'smoke' | 'steam' | 'dust' | 'water' | 'sparks';
}

export interface LightSpec {
    position: THREE.Vector3;
    radius: number;
    color: THREE.Color;
}

/** Everything a model turns into; geometries are owned by this object. */
export interface ModelGeometry {
    buckets: Partial<Record<Bucket, THREE.BufferGeometry>>;
    animated: AnimatedSpec[];
    emitters: EmitterSpec[];
    lights: LightSpec[];
    /** Local bounds of everything. */
    bounds: THREE.Box3;
    height: number;
    dispose(): void;
}

const WINDOW_PROUD = 0.006;
const ZERO_LIT: Lit = [0, 0, 0, 2];

class GeoBucket {
    readonly position: number[] = [];
    readonly normal: number[] = [];
    readonly color: number[] = [];
    readonly lit: number[] = [];
    readonly wave: number[] = [];

    constructor(readonly name: Bucket) {}

    get empty(): boolean {
        return this.position.length === 0;
    }

    vertex(p: V3, n: V3, c: THREE.Color, lit: Lit = ZERO_LIT, wave = 0): void {
        this.position.push(p[0], p[1], p[2]);
        this.normal.push(n[0], n[1], n[2]);
        this.color.push(c.r, c.g, c.b);

        if (this.name === 'windows') {
            this.lit.push(lit[0], lit[1], lit[2], lit[3]);
        }

        if (this.name === 'flag') {
            this.wave.push(wave);
        }
    }

    toGeometry(): THREE.BufferGeometry {
        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(this.position, 3),
        );
        geometry.setAttribute(
            'normal',
            new THREE.Float32BufferAttribute(this.normal, 3),
        );
        geometry.setAttribute(
            'color',
            new THREE.Float32BufferAttribute(this.color, 3),
        );

        if (this.name === 'windows') {
            geometry.setAttribute(
                'aLit',
                new THREE.Float32BufferAttribute(this.lit, 4),
            );
        }

        if (this.name === 'flag') {
            geometry.setAttribute(
                'aWave',
                new THREE.Float32BufferAttribute(this.wave, 1),
            );
        }

        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();

        return geometry;
    }
}

/** Model coordinates (x east, y south, z up) → local three.js coordinates. */
function W(x: number, y: number, z: number): V3 {
    return [x, z, y];
}

/** Newell's normal of a polygon. */
function polygonNormal(points: V3[]): V3 {
    let nx = 0;
    let ny = 0;
    let nz = 0;

    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];

        nx += (a[1] - b[1]) * (a[2] + b[2]);
        ny += (a[2] - b[2]) * (a[0] + b[0]);
        nz += (a[0] - b[0]) * (a[1] + b[1]);
    }

    const length = Math.hypot(nx, ny, nz) || 1;

    return [nx / length, ny / length, nz / length];
}

/**
 * Adds a convex polygon (local coordinates) facing `outward` (a direction in
 * model coordinates): the winding is fixed up to face it.
 */
function poly(
    bucket: GeoBucket,
    points: V3[],
    c: THREE.Color,
    outward: V3,
    lit?: Lit,
): void {
    let list = points;
    let n = polygonNormal(list);
    const out = W(outward[0], outward[1], outward[2]);

    if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) {
        list = [...points].reverse();
        n = [-n[0], -n[1], -n[2]];
    }

    for (let i = 1; i < list.length - 1; i++) {
        bucket.vertex(list[0], n, c, lit);
        bucket.vertex(list[i], n, c, lit);
        bucket.vertex(list[i + 1], n, c, lit);
    }
}

/** A box in model coordinates. */
function box(
    bucket: GeoBucket,
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    c: THREE.Color,
    bottom = false,
): void {
    poly(
        bucket,
        [W(x0, y0, z1), W(x1, y0, z1), W(x1, y1, z1), W(x0, y1, z1)],
        c,
        [0, 0, 1],
    );

    if (bottom) {
        poly(
            bucket,
            [W(x0, y0, z0), W(x1, y0, z0), W(x1, y1, z0), W(x0, y1, z0)],
            c,
            [0, 0, -1],
        );
    }

    poly(
        bucket,
        [W(x0, y0, z0), W(x1, y0, z0), W(x1, y0, z1), W(x0, y0, z1)],
        c,
        [0, -1, 0],
    );
    poly(
        bucket,
        [W(x0, y1, z0), W(x1, y1, z0), W(x1, y1, z1), W(x0, y1, z1)],
        c,
        [0, 1, 0],
    );
    poly(
        bucket,
        [W(x0, y0, z0), W(x0, y1, z0), W(x0, y1, z1), W(x0, y0, z1)],
        c,
        [-1, 0, 0],
    );
    poly(
        bucket,
        [W(x1, y0, z0), W(x1, y1, z0), W(x1, y1, z1), W(x1, y0, z1)],
        c,
        [1, 0, 0],
    );
}

/** Appends a three.js geometry (transformed) with one colour. */
function append(
    bucket: GeoBucket,
    source: THREE.BufferGeometry,
    matrix: THREE.Matrix4,
    c: THREE.Color,
): void {
    const geometry = (
        source.index ? source.toNonIndexed() : source.clone()
    ).applyMatrix4(matrix);

    if (!geometry.getAttribute('normal')) {
        geometry.computeVertexNormals();
    }

    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');

    for (let i = 0; i < position.count; i++) {
        bucket.vertex(
            [position.getX(i), position.getY(i), position.getZ(i)],
            [normal.getX(i), normal.getY(i), normal.getZ(i)],
            c,
        );
    }

    geometry.dispose();

    if (geometry !== source) {
        source.dispose();
    }
}

interface FaceFrame {
    ox: number;
    oy: number;
    dx: number;
    dy: number;
    nx: number;
    ny: number;
    length: number;
}

function faceFrame(
    face: Face,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
): FaceFrame {
    switch (face) {
        case 'n':
            return {
                ox: x0,
                oy: y0,
                dx: 1,
                dy: 0,
                nx: 0,
                ny: -1,
                length: x1 - x0,
            };
        case 's':
            return {
                ox: x0,
                oy: y1,
                dx: 1,
                dy: 0,
                nx: 0,
                ny: 1,
                length: x1 - x0,
            };
        case 'w':
            return {
                ox: x0,
                oy: y0,
                dx: 0,
                dy: 1,
                nx: -1,
                ny: 0,
                length: y1 - y0,
            };
        default:
            return {
                ox: x1,
                oy: y0,
                dx: 0,
                dy: 1,
                nx: 1,
                ny: 0,
                length: y1 - y0,
            };
    }
}

function facePoint(f: FaceFrame, u: number, z: number, proud: number): V3 {
    return W(f.ox + f.dx * u + f.nx * proud, f.oy + f.dy * u + f.ny * proud, z);
}

/** A rectangle lying on a face, slightly in front of it. */
function faceRect(
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
    poly(
        bucket,
        [
            facePoint(f, u0, z0, proud),
            facePoint(f, u1, z0, proud),
            facePoint(f, u1, z1, proud),
            facePoint(f, u0, z1, proud),
        ],
        c,
        [f.nx, f.ny, 0],
        lit,
    );
}

/** A strip between two face points (u, z), `width` wide. */
function faceStrip(
    bucket: GeoBucket,
    f: FaceFrame,
    u0: number,
    z0: number,
    u1: number,
    z1: number,
    width: number,
    proud: number,
    c: THREE.Color,
): void {
    const du = u1 - u0;
    const dz = z1 - z0;
    const length = Math.hypot(du, dz) || 1;
    const pu = (-dz / length) * (width / 2);
    const pz = (du / length) * (width / 2);

    poly(
        bucket,
        [
            facePoint(f, u0 + pu, z0 + pz, proud),
            facePoint(f, u1 + pu, z1 + pz, proud),
            facePoint(f, u1 - pu, z1 - pz, proud),
            facePoint(f, u0 - pu, z0 - pz, proud),
        ],
        c,
        [f.nx, f.ny, 0],
    );
}

function bucketOf(material: Material | undefined): Bucket {
    switch (material) {
        case 'glass':
            return 'glass';
        case 'metal':
            return 'metal';
        case 'glow':
            return 'glow';
        default:
            return 'matte';
    }
}

function shaded(c: THREE.Color, factor: number): THREE.Color {
    return c.clone().multiplyScalar(factor);
}

const FACES: Face[] = ['n', 'e', 's', 'w'];

function num(value: unknown, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
}

/** Builds the geometry of a model with a palette. */
export function buildModel(
    parts: ModelPart[],
    palette: Palette,
    options: ModelOptions,
): ModelGeometry {
    const buckets = new Map<Bucket, GeoBucket>();
    const get = (name: Bucket): GeoBucket => {
        let bucket = buckets.get(name);

        if (!bucket) {
            bucket = new GeoBucket(name);
            buckets.set(name, bucket);
        }

        return bucket;
    };
    const paint = (value: string): THREE.Color =>
        color(resolveColor(value, palette, options.wallIndex));
    const litColor = color(
        typeof palette.lit === 'string' ? palette.lit : '#ffd27a',
    );
    let windowIndex = 0;
    const nextLit = (): Lit => [
        litColor.r,
        litColor.g,
        litColor.b,
        // 0.02..1: some windows light up early, some never at all.
        0.02 + hash3(windowIndex++, options.seed, 911) * 0.98,
    ];
    const animated: AnimatedSpec[] = [];
    const emitters: EmitterSpec[] = [];
    const lights: LightSpec[] = [];
    const matrix = new THREE.Matrix4();

    for (const part of parts) {
        switch (part.kind) {
            case 'box': {
                box(
                    get(bucketOf(part.material)),
                    num(part.x),
                    num(part.y),
                    num(part.z),
                    num(part.x) + num(part.w, 0.1),
                    num(part.y) + num(part.d, 0.1),
                    num(part.z) + num(part.h, 0.1),
                    paint(part.color),
                    num(part.z) > 0.01,
                );
                break;
            }

            case 'roof':
                addRoof(
                    get(bucketOf(part.material)),
                    part,
                    options.roof ?? part.shape,
                    options.roof != null && options.roof !== part.shape,
                    paint(part.color),
                    paint('walls'),
                );
                break;

            case 'floors':
                addFloors(
                    get(bucketOf(part.material)),
                    get('windows'),
                    part,
                    paint,
                    nextLit,
                );
                break;

            case 'windows': {
                const x0 = num(part.x);
                const y0 = num(part.y);
                const x1 = x0 + num(part.w, 0.1);
                const y1 = y0 + num(part.d, 0.1);
                const rows = Math.max(1, Math.round(num(part.rows, 1)));
                const cols = Math.max(1, Math.round(num(part.cols, 1)));
                const z0 = num(part.z);
                const h = num(part.h, 0.1);
                const c = paint(part.color);

                for (const face of part.faces ?? []) {
                    const f = faceFrame(face, x0, y0, x1, y1);
                    const cw = f.length / cols;
                    const ch = h / rows;

                    for (let row = 0; row < rows; row++) {
                        for (let col = 0; col < cols; col++) {
                            faceRect(
                                get('windows'),
                                f,
                                col * cw + cw * 0.2,
                                col * cw + cw * 0.8,
                                z0 + row * ch + ch * 0.18,
                                z0 + row * ch + ch * 0.82,
                                WINDOW_PROUD,
                                c,
                                nextLit(),
                            );
                        }
                    }
                }

                break;
            }

            case 'door': {
                const x0 = num(part.x);
                const y0 = num(part.y);
                const f = faceFrame(
                    part.face ?? 's',
                    x0,
                    y0,
                    x0 + num(part.w, 0.1),
                    y0 + num(part.d, 0.1),
                );
                const width = Math.min(f.length, num(part.width, 0.08));
                const u = (f.length - width) / 2;
                const height = num(part.height, 0.12);
                const c = paint(part.color);

                faceRect(
                    get('matte'),
                    f,
                    u - 0.012,
                    u + width + 0.012,
                    0,
                    height + 0.012,
                    WINDOW_PROUD * 0.6,
                    shaded(c, 0.6),
                );
                faceRect(
                    get('matte'),
                    f,
                    u,
                    u + width,
                    0,
                    height,
                    WINDOW_PROUD * 1.4,
                    c,
                );
                break;
            }

            case 'beams': {
                const x0 = num(part.x);
                const y0 = num(part.y);
                const x1 = x0 + num(part.w, 0.1);
                const y1 = y0 + num(part.d, 0.1);
                const z0 = num(part.z);
                const z1 = z0 + num(part.h, 0.1);
                const count = Math.max(1, Math.round(num(part.count, 2)));
                const c = paint(part.color);
                const width = 0.022;
                const proud = 0.004;

                for (const face of part.faces ?? []) {
                    const f = faceFrame(face, x0, y0, x1, y1);
                    const bucket = get('matte');

                    for (let i = 0; i <= count; i++) {
                        const u = Math.min(
                            f.length - width / 2,
                            Math.max(width / 2, (i * f.length) / count),
                        );

                        faceStrip(bucket, f, u, z0, u, z1, width, proud, c);

                        if (i < count) {
                            const next = ((i + 1) * f.length) / count;

                            if (i % 2 === 0) {
                                faceStrip(
                                    bucket,
                                    f,
                                    u,
                                    z0,
                                    next,
                                    (z0 + z1) / 2,
                                    width * 0.8,
                                    proud,
                                    c,
                                );
                            } else {
                                faceStrip(
                                    bucket,
                                    f,
                                    u,
                                    (z0 + z1) / 2,
                                    next,
                                    z0,
                                    width * 0.8,
                                    proud,
                                    c,
                                );
                            }
                        }
                    }

                    faceStrip(
                        bucket,
                        f,
                        0,
                        z0 + width / 2,
                        f.length,
                        z0 + width / 2,
                        width,
                        proud,
                        c,
                    );
                    faceStrip(
                        bucket,
                        f,
                        0,
                        (z0 + z1) / 2,
                        f.length,
                        (z0 + z1) / 2,
                        width,
                        proud,
                        c,
                    );
                    faceStrip(
                        bucket,
                        f,
                        0,
                        z1 - width / 2,
                        f.length,
                        z1 - width / 2,
                        width,
                        proud,
                        c,
                    );
                }

                break;
            }

            case 'ground':
                box(
                    get('matte'),
                    num(part.x),
                    num(part.y),
                    0,
                    num(part.x) + num(part.w, 1),
                    num(part.y) + num(part.d, 1),
                    0.014,
                    paint(part.color),
                );
                break;

            case 'field': {
                const x0 = num(part.x);
                const y0 = num(part.y);
                const w = num(part.w, 1);
                const d = num(part.d, 1);
                const rows = Math.max(1, Math.round(num(part.rows, 4)));
                const crop = paint(part.color);
                const bucket = get('matte');

                box(bucket, x0, y0, 0, x0 + w, y0 + d, 0.01, color('#7d5d36'));

                for (let i = 0; i < rows; i++) {
                    const a = y0 + (i * d) / rows + d / rows / 5;
                    const b = y0 + ((i + 1) * d) / rows - d / rows / 5;

                    box(
                        bucket,
                        x0 + 0.03,
                        a,
                        0.01,
                        x0 + w - 0.03,
                        b,
                        0.055,
                        i % 2 ? shaded(crop, 0.88) : crop,
                    );
                }

                break;
            }

            case 'cylinder': {
                const r = num(part.r, 0.1);
                const h = num(part.h, 0.1);
                const geometry = new THREE.CylinderGeometry(
                    r * Math.max(0, num(part.taper, 1)),
                    r,
                    h,
                    Math.max(3, Math.round(num(part.segments, 14))),
                );

                matrix.makeTranslation(
                    num(part.x),
                    num(part.z) + h / 2,
                    num(part.y),
                );
                append(
                    get(bucketOf(part.material)),
                    geometry,
                    matrix,
                    paint(part.color),
                );
                break;
            }

            case 'sphere': {
                const r = num(part.r, 0.1);
                const geometry = part.half
                    ? new THREE.SphereGeometry(
                          r,
                          16,
                          6,
                          0,
                          Math.PI * 2,
                          0,
                          Math.PI / 2,
                      )
                    : new THREE.SphereGeometry(r, 16, 10);

                matrix.makeTranslation(num(part.x), num(part.z), num(part.y));
                append(
                    get(bucketOf(part.material)),
                    geometry,
                    matrix,
                    paint(part.color),
                );
                break;
            }

            case 'torus': {
                const geometry = new THREE.TorusGeometry(
                    num(part.r, 0.2),
                    num(part.tube, 0.03),
                    8,
                    28,
                );
                const pivot = new THREE.Vector3(
                    num(part.x),
                    num(part.z),
                    num(part.y),
                );

                if (part.spin) {
                    geometry.rotateX(Math.PI / 2 - 0.3);
                    animated.push({
                        kind: 'spin',
                        geometry: colorize(geometry, paint(part.color)),
                        bucket: bucketOf(part.material),
                        pivot,
                        orient: new THREE.Euler(),
                        axis: 'y',
                        speed: part.spin,
                    });
                } else {
                    geometry.rotateX(Math.PI / 2);
                    matrix.makeTranslation(pivot.x, pivot.y, pivot.z);
                    append(
                        get(bucketOf(part.material)),
                        geometry,
                        matrix,
                        paint(part.color),
                    );
                }

                break;
            }

            case 'flag':
                addFlag(get('metal'), get('flag'), part, paint(part.color));
                break;

            case 'pole': {
                const h = num(part.h, 0.3);
                const geometry = new THREE.CylinderGeometry(0.008, 0.012, h, 6);

                matrix.makeTranslation(
                    num(part.x),
                    num(part.z) + h / 2,
                    num(part.y),
                );
                append(get('metal'), geometry, matrix, paint(part.color));

                if (part.blink) {
                    animated.push({
                        kind: 'blink',
                        geometry: colorize(
                            new THREE.SphereGeometry(0.022, 8, 6),
                            paint(part.blink),
                        ),
                        bucket: 'glow',
                        pivot: new THREE.Vector3(
                            num(part.x),
                            num(part.z) + h + 0.01,
                            num(part.y),
                        ),
                        orient: new THREE.Euler(),
                        axis: 'y',
                        speed: 0.8,
                    });
                    lights.push({
                        position: new THREE.Vector3(
                            num(part.x),
                            num(part.z) + h + 0.01,
                            num(part.y),
                        ),
                        radius: 0.12,
                        color: paint(part.blink).clone(),
                    });
                }

                break;
            }

            case 'emitter':
                emitters.push({
                    position: new THREE.Vector3(
                        num(part.x),
                        num(part.z),
                        num(part.y),
                    ),
                    type: part.type ?? 'smoke',
                });
                break;

            case 'light': {
                const c = paint(part.color);
                const geometry = new THREE.SphereGeometry(0.026, 8, 6);

                matrix.makeTranslation(num(part.x), num(part.z), num(part.y));
                append(get('glow'), geometry, matrix, c);
                lights.push({
                    position: new THREE.Vector3(
                        num(part.x),
                        num(part.z),
                        num(part.y),
                    ),
                    radius: Math.max(0.1, num(part.radius, 0.4)),
                    color: c.clone(),
                });
                break;
            }

            case 'tree':
                addTree(
                    get('matte'),
                    get('foliage'),
                    num(part.x),
                    num(part.y),
                    num(part.scale, 1),
                    Boolean(part.conifer),
                    0,
                );
                break;

            case 'blades': {
                const r = num(part.r, 0.3);
                const axis = part.axis ?? 'y';
                const orient =
                    axis === 'x'
                        ? new THREE.Euler(0, Math.PI / 2, 0)
                        : axis === 'z'
                          ? new THREE.Euler(-Math.PI / 2, 0, 0)
                          : new THREE.Euler();

                animated.push({
                    kind: 'spin',
                    geometry: bladesGeometry(r, paint(part.color)),
                    bucket: 'matte',
                    pivot: new THREE.Vector3(
                        num(part.x),
                        num(part.z),
                        num(part.y),
                    ),
                    orient,
                    axis: 'z',
                    speed: num(part.speed, 0.3),
                });
                break;
            }
        }
    }

    const result: Partial<Record<Bucket, THREE.BufferGeometry>> = {};
    const bounds = new THREE.Box3();

    for (const name of BUCKETS) {
        const bucket = buckets.get(name);

        if (bucket && !bucket.empty) {
            result[name] = bucket.toGeometry();
            bounds.union(result[name]!.boundingBox!);
        }
    }

    for (const spec of animated) {
        spec.geometry.computeBoundingSphere();
        const radius = spec.geometry.boundingSphere?.radius ?? 0.1;

        bounds.union(
            new THREE.Box3(
                spec.pivot.clone().subScalar(radius),
                spec.pivot.clone().addScalar(radius),
            ),
        );
    }

    for (const emitter of emitters) {
        bounds.expandByPoint(emitter.position);
    }

    if (bounds.isEmpty()) {
        bounds.set(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0.1, 1));
    }

    return {
        buckets: result,
        animated,
        emitters,
        lights,
        bounds,
        height: Math.max(0.05, bounds.max.y),
        dispose(): void {
            for (const geometry of Object.values(result)) {
                geometry.dispose();
            }

            for (const spec of animated) {
                spec.geometry.dispose();
            }
        },
    };
}

/** Gives a geometry a flat vertex colour (non-indexed copy). */
function colorize(
    source: THREE.BufferGeometry,
    c: THREE.Color,
): THREE.BufferGeometry {
    const geometry = source.index ? source.toNonIndexed() : source;

    if (geometry !== source) {
        source.dispose();
    }

    const count = geometry.getAttribute('position').count;
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return geometry;
}

function bladesGeometry(r: number, sail: THREE.Color): THREE.BufferGeometry {
    const bucket = new GeoBucket('matte');
    const wood = color('#5e3d22');
    const matrix = new THREE.Matrix4();

    append(
        bucket,
        new THREE.CylinderGeometry(r * 0.08, r * 0.08, 0.05, 8).rotateX(
            Math.PI / 2,
        ),
        matrix,
        wood,
    );

    for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const spar = new THREE.BoxGeometry(r, r * 0.045, 0.012);

        spar.translate(r / 2, 0, 0.02);
        spar.rotateZ(angle);
        append(bucket, spar, matrix, wood);

        const blade = new THREE.BoxGeometry(r * 0.72, r * 0.2, 0.008);

        blade.translate(r * 0.6, r * 0.12, 0.026);
        blade.rotateZ(angle);
        append(bucket, blade, matrix, sail);
    }

    return bucket.toGeometry();
}

/** A tree (also used by models): trunk in `trunk`, crown in `crown`. */
export function addTree(
    trunk: GeoBucket,
    crown: GeoBucket,
    x: number,
    y: number,
    scale: number,
    conifer: boolean,
    variant: number,
): void {
    const matrix = new THREE.Matrix4();
    const h = 0.45 * scale;

    matrix.makeTranslation(x, h * 0.15, y);
    append(
        trunk,
        new THREE.CylinderGeometry(0.018 * scale, 0.026 * scale, h * 0.3, 5),
        matrix,
        color('#6b4a2b'),
    );

    if (conifer) {
        const green = color(variant > 0.5 ? '#2f6b3a' : '#357a40');

        for (let i = 0; i < 3; i++) {
            const r = (0.13 - i * 0.03) * scale;
            const ch = h * 0.38;

            matrix.makeTranslation(x, h * (0.22 + i * 0.22) + ch / 2, y);
            append(trunk, new THREE.ConeGeometry(r, ch, 7), matrix, green);
        }
    } else {
        const tone = new THREE.Color(1, 1, 1).multiplyScalar(
            0.85 + variant * 0.25,
        );

        matrix.compose(
            new THREE.Vector3(x, h * 0.62, y),
            new THREE.Quaternion(),
            new THREE.Vector3(1, 0.9, 1),
        );
        append(
            crown,
            new THREE.IcosahedronGeometry(0.15 * scale, 0),
            matrix,
            tone,
        );
        matrix.makeTranslation(x + 0.05 * scale, h * 0.78, y - 0.03 * scale);
        append(
            crown,
            new THREE.IcosahedronGeometry(0.09 * scale, 0),
            matrix,
            tone.clone().multiplyScalar(1.08),
        );
    }
}

function addFloors(
    walls: GeoBucket,
    windows: GeoBucket,
    part: Extract<ModelPart, { kind: 'floors' }>,
    paint: (value: string) => THREE.Color,
    nextLit: () => Lit,
): void {
    const x0 = num(part.x);
    const y0 = num(part.y);
    const x1 = x0 + num(part.w, 0.5);
    const y1 = y0 + num(part.d, 0.5);
    const z0 = num(part.z);
    const floors = Math.max(1, Math.round(num(part.floors, 1)));
    const fh = Math.max(0.05, num(part.floorHeight, 0.2));
    const top = z0 + floors * fh;
    const wall = paint(part.color);
    const glass = paint(part.window);

    box(walls, x0, y0, z0, x1, y1, top, wall, z0 > 0.01);

    if (part.band) {
        const band = paint(part.band);
        const out = 0.008;

        for (let i = 1; i <= floors; i++) {
            const z = z0 + i * fh;

            box(
                walls,
                x0 - out,
                y0 - out,
                z - 0.012,
                x1 + out,
                y1 + out,
                z + 0.006,
                band,
                true,
            );
        }
    }

    for (const face of FACES) {
        const f = faceFrame(face, x0, y0, x1, y1);
        const cols = Math.max(1, Math.floor(f.length / 0.15));
        const cw = f.length / cols;

        for (let i = 0; i < floors; i++) {
            const base = z0 + i * fh;

            for (let col = 0; col < cols; col++) {
                faceRect(
                    windows,
                    f,
                    col * cw + cw * 0.22,
                    col * cw + cw * 0.78,
                    base + fh * 0.28,
                    base + fh * 0.78,
                    WINDOW_PROUD,
                    glass,
                    nextLit(),
                );
            }
        }
    }
}

function addFlag(
    pole: GeoBucket,
    cloth: GeoBucket,
    part: Extract<ModelPart, { kind: 'flag' }>,
    c: THREE.Color,
): void {
    const x = num(part.x);
    const y = num(part.y);
    const z = num(part.z);
    const h = Math.max(0.1, num(part.h, 0.3));
    const matrix = new THREE.Matrix4().makeTranslation(x, z + h / 2, y);

    append(
        pole,
        new THREE.CylinderGeometry(0.006, 0.008, h, 6),
        matrix,
        color('#8a8a8a'),
    );

    const fw = Math.max(0.09, h * 0.38);
    const fh = fw * 0.62;
    const segments = 6;
    const top = z + h - 0.01;
    const n: V3 = [0, 0, 1];
    const point = (i: number, j: number): V3 =>
        W(x + (i / segments) * fw, y, top - (j / 2) * fh);

    for (let i = 0; i < segments; i++) {
        for (let j = 0; j < 2; j++) {
            const a = point(i, j);
            const b = point(i + 1, j);
            const cc = point(i + 1, j + 1);
            const d = point(i, j + 1);
            const wa = i / segments;
            const wb = (i + 1) / segments;

            cloth.vertex(a, n, c, undefined, wa);
            cloth.vertex(b, n, c, undefined, wb);
            cloth.vertex(cc, n, c, undefined, wb);
            cloth.vertex(a, n, c, undefined, wa);
            cloth.vertex(cc, n, c, undefined, wb);
            cloth.vertex(d, n, c, undefined, wa);
        }
    }
}

function addRoof(
    bucket: GeoBucket,
    part: Extract<ModelPart, { kind: 'roof' }>,
    shape: RoofShape,
    overridden: boolean,
    c: THREE.Color,
    wall: THREE.Color,
): void {
    const o = Math.max(0, num(part.overhang, 0));
    const X0 = num(part.x) - o;
    const Y0 = num(part.y) - o;
    const X1 = num(part.x) + num(part.w, 0.5) + o;
    const Y1 = num(part.y) + num(part.d, 0.5) + o;
    const Z = num(part.z);
    let H = num(part.h, 0.1);
    const Xm = (X0 + X1) / 2;
    const Ym = (Y0 + Y1) / 2;
    const width = X1 - X0;
    const depth = Y1 - Y0;
    const axis = part.axis ?? (width >= depth ? 'x' : 'y');
    const under = shaded(c, 0.55);

    if (overridden && shape !== 'flat') {
        H = Math.max(H, Math.min(width, depth) * 0.42);
    }

    const underside = () =>
        poly(
            bucket,
            [W(X0, Y0, Z), W(X1, Y0, Z), W(X1, Y1, Z), W(X0, Y1, Z)],
            under,
            [0, 0, -1],
        );

    switch (shape) {
        case 'flat': {
            const h = Math.max(0.025, Math.min(H, 0.08));

            box(bucket, X0, Y0, Z, X1, Y1, Z + h, c, true);

            if (width > 0.4 && depth > 0.4) {
                const lip = 0.025;
                const top = Z + h + 0.03;
                const trim = shaded(c, 0.85);

                box(bucket, X0, Y0, Z + h, X1, Y0 + lip, top, trim);
                box(bucket, X0, Y1 - lip, Z + h, X1, Y1, top, trim);
                box(bucket, X0, Y0, Z + h, X0 + lip, Y1, top, trim);
                box(bucket, X1 - lip, Y0, Z + h, X1, Y1, top, trim);
            }

            break;
        }

        case 'gable':
            gable(bucket, X0, Y0, X1, Y1, Z, H, axis, c, wall);
            underside();
            break;

        case 'hip':
            hip(bucket, X0, Y0, X1, Y1, Z, H, axis, c);
            underside();
            break;

        case 'pyramid':
            hip(bucket, X0, Y0, X1, Y1, Z, H, 'x', c, true);
            underside();
            break;

        case 'mansard': {
            const inset = Math.min(width, depth) * 0.2;
            const zm = Z + H * 0.65;
            const corners: [number, number, number, number][] = [
                [X0, Y0, X0 + inset, Y0 + inset],
                [X1, Y0, X1 - inset, Y0 + inset],
                [X1, Y1, X1 - inset, Y1 - inset],
                [X0, Y1, X0 + inset, Y1 - inset],
            ];

            for (let i = 0; i < 4; i++) {
                const [ax, ay, aix, aiy] = corners[i];
                const [bx, by, bix, biy] = corners[(i + 1) % 4];
                const mx = (ax + bx) / 2 - Xm;
                const my = (ay + by) / 2 - Ym;

                poly(
                    bucket,
                    [
                        W(ax, ay, Z),
                        W(bx, by, Z),
                        W(bix, biy, zm),
                        W(aix, aiy, zm),
                    ],
                    c,
                    [mx, my, Math.min(width, depth) * 0.1],
                );
            }

            hip(
                bucket,
                X0 + inset,
                Y0 + inset,
                X1 - inset,
                Y1 - inset,
                zm,
                H * 0.35,
                axis,
                shaded(c, 0.92),
            );
            underside();
            break;
        }

        case 'dome': {
            const geometry = new THREE.SphereGeometry(
                1,
                20,
                8,
                0,
                Math.PI * 2,
                0,
                Math.PI / 2,
            );
            const matrix = new THREE.Matrix4().compose(
                new THREE.Vector3(Xm, Z, Ym),
                new THREE.Quaternion(),
                new THREE.Vector3(
                    width / 2,
                    H > 0.02 ? H : Math.min(width, depth) / 2,
                    depth / 2,
                ),
            );

            append(bucket, geometry, matrix, c);
            break;
        }

        case 'cone': {
            const geometry = new THREE.CylinderGeometry(0, 1, 1, 16);
            const matrix = new THREE.Matrix4().compose(
                new THREE.Vector3(Xm, Z + Math.max(H, 0.05) / 2, Ym),
                new THREE.Quaternion(),
                new THREE.Vector3(width / 2, Math.max(H, 0.05), depth / 2),
            );

            append(bucket, geometry, matrix, c);
            break;
        }

        case 'shed':
            shed(bucket, X0, Y0, X1, Y1, Z, H, axis, c, wall);
            underside();
            break;

        case 'sawtooth': {
            const along = axis === 'x' ? depth : width;
            const teeth = Math.max(2, Math.round(along / 0.3));
            const step = along / teeth;
            const glass = color('#9fc7de');

            for (let i = 0; i < teeth; i++) {
                if (axis === 'x') {
                    const a = Y0 + i * step;

                    sawTooth(bucket, X0, a, X1, a + step, Z, H, 'x', c, glass);
                } else {
                    const a = X0 + i * step;

                    sawTooth(bucket, a, Y0, a + step, Y1, Z, H, 'y', c, glass);
                }
            }

            underside();
            break;
        }
    }
}

function gable(
    bucket: GeoBucket,
    X0: number,
    Y0: number,
    X1: number,
    Y1: number,
    Z: number,
    H: number,
    axis: 'x' | 'y',
    c: THREE.Color,
    wall: THREE.Color,
): void {
    const top = Z + H;

    if (axis === 'x') {
        const Ym = (Y0 + Y1) / 2;

        poly(
            bucket,
            [W(X0, Y0, Z), W(X1, Y0, Z), W(X1, Ym, top), W(X0, Ym, top)],
            c,
            [0, -H, Ym - Y0],
        );
        poly(
            bucket,
            [W(X0, Y1, Z), W(X1, Y1, Z), W(X1, Ym, top), W(X0, Ym, top)],
            c,
            [0, H, Y1 - Ym],
        );
        poly(
            bucket,
            [W(X0, Y0, Z), W(X0, Y1, Z), W(X0, Ym, top)],
            wall,
            [-1, 0, 0],
        );
        poly(
            bucket,
            [W(X1, Y0, Z), W(X1, Y1, Z), W(X1, Ym, top)],
            wall,
            [1, 0, 0],
        );
    } else {
        const Xm = (X0 + X1) / 2;

        poly(
            bucket,
            [W(X0, Y0, Z), W(X0, Y1, Z), W(Xm, Y1, top), W(Xm, Y0, top)],
            c,
            [-H, 0, Xm - X0],
        );
        poly(
            bucket,
            [W(X1, Y0, Z), W(X1, Y1, Z), W(Xm, Y1, top), W(Xm, Y0, top)],
            c,
            [H, 0, X1 - Xm],
        );
        poly(
            bucket,
            [W(X0, Y0, Z), W(X1, Y0, Z), W(Xm, Y0, top)],
            wall,
            [0, -1, 0],
        );
        poly(
            bucket,
            [W(X0, Y1, Z), W(X1, Y1, Z), W(Xm, Y1, top)],
            wall,
            [0, 1, 0],
        );
    }
}

function hip(
    bucket: GeoBucket,
    X0: number,
    Y0: number,
    X1: number,
    Y1: number,
    Z: number,
    H: number,
    axis: 'x' | 'y',
    c: THREE.Color,
    pyramid = false,
): void {
    const top = Z + H;
    const Xm = (X0 + X1) / 2;
    const Ym = (Y0 + Y1) / 2;
    let ax: number;
    let ay: number;
    let bx: number;
    let by: number;

    if (pyramid) {
        ax = bx = Xm;
        ay = by = Ym;
    } else if (axis === 'x') {
        const inset = Math.min((Y1 - Y0) / 2, (X1 - X0) / 2);

        ax = X0 + inset;
        bx = X1 - inset;
        ay = by = Ym;
    } else {
        const inset = Math.min((Y1 - Y0) / 2, (X1 - X0) / 2);

        ay = Y0 + inset;
        by = Y1 - inset;
        ax = bx = Xm;
    }

    // Ridge from a (west / north end) to b (east / south end).
    const side = (points: V3[], outward: V3) => {
        const unique = points.filter(
            (p, i) =>
                points.findIndex(
                    (q) =>
                        Math.abs(q[0] - p[0]) < 1e-6 &&
                        Math.abs(q[1] - p[1]) < 1e-6 &&
                        Math.abs(q[2] - p[2]) < 1e-6,
                ) === i,
        );

        if (unique.length >= 3) {
            poly(bucket, unique, c, outward);
        }
    };
    const slope = H;

    if (axis === 'x' || pyramid) {
        side(
            [W(X0, Y0, Z), W(X1, Y0, Z), W(bx, by, top), W(ax, ay, top)],
            [0, -slope, Ym - Y0 || 1],
        );
        side(
            [W(X0, Y1, Z), W(X1, Y1, Z), W(bx, by, top), W(ax, ay, top)],
            [0, slope, Y1 - Ym || 1],
        );
        side(
            [W(X0, Y0, Z), W(X0, Y1, Z), W(ax, ay, top)],
            [-slope, 0, ax - X0 || 1],
        );
        side(
            [W(X1, Y0, Z), W(X1, Y1, Z), W(bx, by, top)],
            [slope, 0, X1 - bx || 1],
        );
    } else {
        side(
            [W(X0, Y0, Z), W(X0, Y1, Z), W(bx, by, top), W(ax, ay, top)],
            [-slope, 0, Xm - X0 || 1],
        );
        side(
            [W(X1, Y0, Z), W(X1, Y1, Z), W(bx, by, top), W(ax, ay, top)],
            [slope, 0, X1 - Xm || 1],
        );
        side(
            [W(X0, Y0, Z), W(X1, Y0, Z), W(ax, ay, top)],
            [0, -slope, ay - Y0 || 1],
        );
        side(
            [W(X0, Y1, Z), W(X1, Y1, Z), W(bx, by, top)],
            [0, slope, Y1 - by || 1],
        );
    }
}

function shed(
    bucket: GeoBucket,
    X0: number,
    Y0: number,
    X1: number,
    Y1: number,
    Z: number,
    H: number,
    axis: 'x' | 'y',
    c: THREE.Color,
    wall: THREE.Color,
): void {
    const top = Z + H;

    if (axis === 'x') {
        // High along the north edge, sloping down to the south.
        poly(
            bucket,
            [W(X0, Y0, top), W(X1, Y0, top), W(X1, Y1, Z), W(X0, Y1, Z)],
            c,
            [0, H, Y1 - Y0],
        );
        poly(
            bucket,
            [W(X0, Y0, Z), W(X1, Y0, Z), W(X1, Y0, top), W(X0, Y0, top)],
            wall,
            [0, -1, 0],
        );
        poly(
            bucket,
            [W(X0, Y0, Z), W(X0, Y1, Z), W(X0, Y0, top)],
            wall,
            [-1, 0, 0],
        );
        poly(
            bucket,
            [W(X1, Y0, Z), W(X1, Y1, Z), W(X1, Y0, top)],
            wall,
            [1, 0, 0],
        );
    } else {
        // High along the west edge, sloping down to the east.
        poly(
            bucket,
            [W(X0, Y0, top), W(X0, Y1, top), W(X1, Y1, Z), W(X1, Y0, Z)],
            c,
            [H, 0, X1 - X0],
        );
        poly(
            bucket,
            [W(X0, Y0, Z), W(X0, Y1, Z), W(X0, Y1, top), W(X0, Y0, top)],
            wall,
            [-1, 0, 0],
        );
        poly(
            bucket,
            [W(X0, Y0, Z), W(X1, Y0, Z), W(X0, Y0, top)],
            wall,
            [0, -1, 0],
        );
        poly(
            bucket,
            [W(X0, Y1, Z), W(X1, Y1, Z), W(X0, Y1, top)],
            wall,
            [0, 1, 0],
        );
    }
}

/** One tooth: a glazed vertical face on the near edge and a slope down. */
function sawTooth(
    bucket: GeoBucket,
    X0: number,
    Y0: number,
    X1: number,
    Y1: number,
    Z: number,
    H: number,
    axis: 'x' | 'y',
    c: THREE.Color,
    glass: THREE.Color,
): void {
    const top = Z + H;

    if (axis === 'x') {
        poly(
            bucket,
            [W(X0, Y0, Z), W(X1, Y0, Z), W(X1, Y0, top), W(X0, Y0, top)],
            glass,
            [0, -1, 0],
        );
        poly(
            bucket,
            [W(X0, Y0, top), W(X1, Y0, top), W(X1, Y1, Z), W(X0, Y1, Z)],
            c,
            [0, H, Y1 - Y0],
        );
        poly(
            bucket,
            [W(X0, Y0, Z), W(X0, Y1, Z), W(X0, Y0, top)],
            c,
            [-1, 0, 0],
        );
        poly(
            bucket,
            [W(X1, Y0, Z), W(X1, Y1, Z), W(X1, Y0, top)],
            c,
            [1, 0, 0],
        );
    } else {
        poly(
            bucket,
            [W(X0, Y0, Z), W(X0, Y1, Z), W(X0, Y1, top), W(X0, Y0, top)],
            glass,
            [-1, 0, 0],
        );
        poly(
            bucket,
            [W(X0, Y0, top), W(X0, Y1, top), W(X1, Y1, Z), W(X1, Y0, Z)],
            c,
            [H, 0, X1 - X0],
        );
        poly(
            bucket,
            [W(X0, Y0, Z), W(X1, Y0, Z), W(X0, Y0, top)],
            c,
            [0, -1, 0],
        );
        poly(
            bucket,
            [W(X0, Y1, Z), W(X1, Y1, Z), W(X0, Y1, top)],
            c,
            [0, 1, 0],
        );
    }
}

/** Scaffolding around a footprint w × d up to height h (matte, vertex colours). */
export function buildScaffold(
    w: number,
    d: number,
    h: number,
): THREE.BufferGeometry {
    const bucket = new GeoBucket('matte');
    const wood = color('#9a7446');
    const rail = color('#c49a5c');
    const t = 0.014;
    const pad = 0.04;
    const x0 = -pad;
    const y0 = -pad;
    const x1 = w + pad;
    const y1 = d + pad;
    const top = Math.max(0.15, h);
    const stepsX = Math.max(1, Math.round(w / 0.5));
    const stepsY = Math.max(1, Math.round(d / 0.5));

    for (let i = 0; i <= stepsX; i++) {
        const x = x0 + ((x1 - x0) * i) / stepsX;

        box(bucket, x - t, y0 - t, 0, x + t, y0 + t, top, wood);
        box(bucket, x - t, y1 - t, 0, x + t, y1 + t, top, wood);
    }

    for (let i = 1; i < stepsY; i++) {
        const y = y0 + ((y1 - y0) * i) / stepsY;

        box(bucket, x0 - t, y - t, 0, x0 + t, y + t, top, wood);
        box(bucket, x1 - t, y - t, 0, x1 + t, y + t, top, wood);
    }

    const levels = Math.max(1, Math.round(top / 0.22));

    for (let i = 1; i <= levels; i++) {
        const z = (top * i) / levels;

        box(bucket, x0, y0 - t, z - t, x1, y0 + t, z, rail, true);
        box(bucket, x0, y1 - t, z - t, x1, y1 + t, z, rail, true);
        box(bucket, x0 - t, y0, z - t, x0 + t, y1, z, rail, true);
        box(bucket, x1 - t, y0, z - t, x1 + t, y1, z, rail, true);
    }

    return bucket.toGeometry();
}

/** A live instance of a model's moving part. */
export interface AnimatedInstance {
    object: THREE.Object3D;
    update(time: number, night: number): void;
}

/** Creates the object of a moving part (shares the spec's geometry). */
export function createAnimated(
    spec: AnimatedSpec,
    materials: MaterialSet,
    phase: number,
): AnimatedInstance {
    const outer = new THREE.Group();
    const mesh = new THREE.Mesh(spec.geometry, materials.buckets[spec.bucket]);

    outer.position.copy(spec.pivot);
    outer.rotation.copy(spec.orient);
    outer.add(mesh);
    mesh.castShadow = spec.kind === 'spin';

    if (spec.kind === 'blink') {
        return {
            object: outer,
            update(time: number, night: number): void {
                mesh.visible =
                    Math.sin((time * spec.speed + phase) * Math.PI * 2) >
                    (night > 0.5 ? -0.2 : 0.3);
            },
        };
    }

    return {
        object: outer,
        update(time: number): void {
            const angle = (time * spec.speed + phase) * Math.PI * 2;

            mesh.rotation.set(
                spec.axis === 'x' ? angle : 0,
                spec.axis === 'y' ? angle : 0,
                spec.axis === 'z' ? angle : 0,
            );
        },
    };
}

/** Tree geometry for instancing: [trunk + conifer crown (matte), leafy crown (foliage)]. */
export function treeGeometries(conifer: boolean): {
    trunk: THREE.BufferGeometry;
    crown: THREE.BufferGeometry | null;
} {
    const trunk = new GeoBucket('matte');
    const crown = new GeoBucket('foliage');

    addTree(trunk, crown, 0, 0, 1, conifer, 0.4);

    return {
        trunk: trunk.toGeometry(),
        crown: crown.empty ? null : crown.toGeometry(),
    };
}

/** Merges geometries with identical attribute layouts, each translated. */
export function mergeTranslated(
    items: {
        geometry: THREE.BufferGeometry;
        x: number;
        y: number;
        z: number;
    }[],
): THREE.BufferGeometry | null {
    if (!items.length) {
        return null;
    }

    const names = Object.keys(items[0].geometry.attributes);
    let total = 0;

    for (const item of items) {
        total += item.geometry.getAttribute('position').count;
    }

    const merged = new THREE.BufferGeometry();

    for (const name of names) {
        const size = items[0].geometry.getAttribute(name).itemSize;
        const array = new Float32Array(total * size);
        let offset = 0;

        for (const item of items) {
            const attribute = item.geometry.getAttribute(name) as
                THREE.BufferAttribute | undefined;
            const count = item.geometry.getAttribute('position').count;

            if (attribute && attribute.itemSize === size) {
                const source = attribute.array as Float32Array;

                if (name === 'position') {
                    for (let i = 0; i < count; i++) {
                        array[offset + i * 3] = source[i * 3] + item.x;
                        array[offset + i * 3 + 1] = source[i * 3 + 1] + item.y;
                        array[offset + i * 3 + 2] = source[i * 3 + 2] + item.z;
                    }
                } else {
                    array.set(source.subarray(0, count * size), offset);
                }
            }

            offset += count * size;
        }

        merged.setAttribute(name, new THREE.BufferAttribute(array, size));
    }

    merged.computeBoundingBox();
    merged.computeBoundingSphere();

    return merged;
}
