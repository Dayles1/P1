/**
 * The skyscraper studio's model, brought over from the «Студия небоскрёбов»
 * artifact: a building is a list of parts in metres (blocks of storeys,
 * crowns, spires, …) stacked on top of each other. `toModelParts` turns it
 * into the tile-sized parts of an Epochs building model, so a tower can be
 * designed the way the studio does it and then built in the game.
 *
 * The studio's JSON (its «JSON» button: `{ name, parts }`) is read as is.
 */

import type { ModelPart } from '../engine/content/types';

export type PlanShape =
    | 'rect'
    | 'rounded'
    | 'ellipse'
    | 'chamfer'
    | 'tri'
    | 'y';
export type Facade =
    | 'glass'
    | 'ribbon'
    | 'grid'
    | 'deco'
    | 'fins'
    | 'brick'
    | 'solid';
export type CrownStyle = 'fins' | 'ring' | 'deco' | 'slope' | 'pyramid';

interface Base {
    /** Which tower it stands on: parts of one stack sit on each other. */
    stack: number;
    label?: string;
}

export interface BlockPart extends Base {
    type: 'block';
    plan: PlanShape;
    w: number;
    d: number;
    r: number;
    wa: number;
    wb: number;
    wc: number;
    wingW: number;
    floors: number;
    fh: number;
    taper: number;
    twist: number;
    rot: number;
    x: number;
    z: number;
    facade: Facade;
    color: string;
    trim: string;
}

export interface CrownPart extends Base {
    type: 'crown';
    style: CrownStyle;
    h: number;
    color: string;
}

export interface SpirePart extends Base {
    type: 'spire';
    h: number;
    r: number;
    color: string;
}

export interface AntennaPart extends Base {
    type: 'antenna';
    h: number;
    color: string;
}

export interface HelipadPart extends Base {
    type: 'helipad';
    r: number;
}

export interface GardenPart extends Base {
    type: 'garden';
    density: number;
}

export interface LanternPart extends Base {
    type: 'lantern';
    h: number;
    color: string;
}

export interface BridgePart extends Base {
    type: 'bridge';
    y: number;
    x1: number;
    z1: number;
    x2: number;
    z2: number;
    w: number;
    h: number;
    color: string;
}

export type StudioPart =
    | BlockPart
    | CrownPart
    | SpirePart
    | AntennaPart
    | HelipadPart
    | GardenPart
    | LanternPart
    | BridgePart;

export type StudioType = StudioPart['type'];

/**
 * What a level keeps of its studio design (in `model.studio`), so the
 * Workshop can open it again: the parts and the height they were fitted to.
 */
export interface StudioSource {
    name: string;
    parts: StudioPart[];
    /** Height of the tallest point, in tiles. */
    height: number;
}

export const DEFAULTS: { [T in StudioType]: Extract<StudioPart, { type: T }> } =
    {
        block: {
            type: 'block',
            plan: 'rect',
            w: 36,
            d: 28,
            r: 8,
            wa: 40,
            wb: 40,
            wc: 40,
            wingW: 20,
            floors: 20,
            fh: 3.6,
            taper: 1,
            twist: 0,
            rot: 0,
            x: 0,
            z: 0,
            stack: 0,
            facade: 'glass',
            color: '#7fa3bd',
            trim: '#d7dde2',
        },
        crown: {
            type: 'crown',
            style: 'fins',
            h: 16,
            color: '#e2e6ea',
            stack: 0,
        },
        spire: { type: 'spire', h: 60, r: 3, color: '#c9d1d6', stack: 0 },
        antenna: { type: 'antenna', h: 30, color: '#b9c0c6', stack: 0 },
        helipad: { type: 'helipad', r: 10, stack: 0 },
        garden: { type: 'garden', density: 0.6, stack: 0 },
        lantern: { type: 'lantern', h: 10, color: '#ffd27a', stack: 0 },
        bridge: {
            type: 'bridge',
            y: 120,
            x1: -30,
            z1: 0,
            x2: 30,
            z2: 0,
            w: 8,
            h: 7,
            color: '#9fb6c6',
            stack: 0,
        },
    };

export const TYPE_NAMES: Record<StudioType, string> = {
    block: 'Блок этажей',
    crown: 'Корона',
    spire: 'Шпиль',
    antenna: 'Антенна',
    helipad: 'Вертолётная площадка',
    garden: 'Сад на крыше',
    lantern: 'Световой фонарь',
    bridge: 'Мост-переход',
};

type Options = [string, string][];

const PLANS: Options = [
    ['rect', 'Прямоуг.'],
    ['rounded', 'Скруглённый'],
    ['ellipse', 'Овал'],
    ['chamfer', 'Срез углов'],
    ['tri', 'Треугольник'],
    ['y', 'Y-план'],
];
const FACADES: Options = [
    ['glass', 'Стекло'],
    ['ribbon', 'Ленты'],
    ['grid', 'Сетка окон'],
    ['deco', 'Арт-деко'],
    ['fins', 'Ламели'],
    ['brick', 'Кирпич'],
    ['solid', 'Глухой'],
];
const CROWNS: Options = [
    ['fins', 'Рама-ламели'],
    ['ring', 'Кольцо'],
    ['deco', 'Ступени'],
    ['slope', 'Скос'],
    ['pyramid', 'Пирамида'],
];

/** One editable field: a number range, a choice or a colour. */
export type Field =
    | {
          key: string;
          label: string;
          kind: 'number';
          min: number;
          max: number;
          step: number;
          when?: (part: BlockPart) => boolean;
      }
    | { key: string; label: string; kind: 'choice'; options: Options }
    | { key: string; label: string; kind: 'color' };

const num = (
    key: string,
    label: string,
    min: number,
    max: number,
    step: number,
    when?: (part: BlockPart) => boolean,
): Field => ({ key, label, kind: 'number', min, max, step, when });

export const FIELDS: Record<StudioType, Field[]> = {
    block: [
        num('floors', 'Этажей', 1, 160, 1),
        num('fh', 'Высота этажа, м', 2.6, 8, 0.05),
        { key: 'plan', label: 'Форма плана', kind: 'choice', options: PLANS },
        num('w', 'Ширина, м', 4, 200, 0.5),
        num('d', 'Глубина, м', 4, 200, 0.5),
        num('r', 'Скругление или срез, м', 0, 60, 0.5, (p) =>
            ['rounded', 'chamfer', 'tri'].includes(p.plan),
        ),
        num('wingW', 'Ширина крыла, м', 4, 60, 0.5, (p) => p.plan === 'y'),
        num('wa', 'Крыло A, м', 4, 120, 0.5, (p) => p.plan === 'y'),
        num('wb', 'Крыло B, м', 4, 120, 0.5, (p) => p.plan === 'y'),
        num('wc', 'Крыло C, м', 4, 120, 0.5, (p) => p.plan === 'y'),
        num('taper', 'Сужение к верху', 0.2, 1.5, 0.01),
        num('x', 'Сдвиг X, м', -250, 250, 0.5),
        num('z', 'Сдвиг Z, м', -250, 250, 0.5),
        { key: 'facade', label: 'Фасад', kind: 'choice', options: FACADES },
        { key: 'color', label: 'Основной цвет', kind: 'color' },
        { key: 'trim', label: 'Рамы и перекрытия', kind: 'color' },
    ],
    crown: [
        { key: 'style', label: 'Тип', kind: 'choice', options: CROWNS },
        num('h', 'Высота, м', 2, 160, 0.5),
        { key: 'color', label: 'Цвет', kind: 'color' },
    ],
    spire: [
        num('h', 'Высота, м', 4, 400, 1),
        num('r', 'Радиус у основания, м', 0.5, 25, 0.1),
        { key: 'color', label: 'Цвет', kind: 'color' },
    ],
    antenna: [
        num('h', 'Высота, м', 4, 200, 1),
        { key: 'color', label: 'Цвет', kind: 'color' },
    ],
    helipad: [num('r', 'Радиус, м', 4, 24, 0.5)],
    garden: [num('density', 'Плотность', 0.1, 1, 0.05)],
    lantern: [
        num('h', 'Высота, м', 2, 60, 0.5),
        { key: 'color', label: 'Цвет света', kind: 'color' },
    ],
    bridge: [
        num('y', 'Высота над землёй, м', 4, 700, 0.5),
        num('x1', 'Начало X', -250, 250, 0.5),
        num('z1', 'Начало Z', -250, 250, 0.5),
        num('x2', 'Конец X', -250, 250, 0.5),
        num('z2', 'Конец Z', -250, 250, 0.5),
        num('w', 'Ширина, м', 2, 40, 0.5),
        num('h', 'Высота, м', 2, 30, 0.5),
        { key: 'color', label: 'Цвет', kind: 'color' },
    ],
};

/** Studio values outside the fields above that are still kept. */
const KEPT_NUMBERS: Record<string, [number, number]> = {
    twist: [-180, 180],
    rot: [-180, 180],
};

const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

/**
 * A part from anywhere (the studio's JSON, a saved level, a preset) made
 * safe: unknown types become blocks, numbers are clamped to their ranges,
 * colours and choices outside the lists fall back to the defaults.
 */
export function sanitize(input: unknown): StudioPart {
    const raw = (input && typeof input === 'object' ? input : {}) as Record<
        string,
        unknown
    >;
    const type = (
        typeof raw.type === 'string' && raw.type in DEFAULTS
            ? raw.type
            : 'block'
    ) as StudioType;
    const out: Record<string, unknown> = { ...DEFAULTS[type] };

    for (const field of FIELDS[type]) {
        const value = raw[field.key];

        if (value === undefined) {
            continue;
        }

        if (field.kind === 'number') {
            const n = Number(value);

            if (Number.isFinite(n)) {
                out[field.key] = clamp(n, field.min, field.max);
            }
        } else if (field.kind === 'color') {
            if (/^#[0-9a-f]{6}$/i.test(String(value))) {
                out[field.key] = String(value).toLowerCase();
            }
        } else if (field.options.some(([id]) => id === value)) {
            out[field.key] = value;
        }
    }

    for (const [key, [min, max]] of Object.entries(KEPT_NUMBERS)) {
        const n = Number(raw[key]);

        if (key in out && Number.isFinite(n)) {
            out[key] = clamp(n, min, max);
        }
    }

    const stack = Number(raw.stack);

    out.stack = Number.isFinite(stack) ? clamp(Math.round(stack), 0, 20) : 0;

    if (type === 'block') {
        out.floors = Math.round(out.floors as number);
    }

    if (typeof raw.label === 'string' && raw.label.trim()) {
        out.label = raw.label.trim().slice(0, 40);
    }

    return out as unknown as StudioPart;
}

/** Reads the studio's exported JSON, or a level's saved source. */
export function parseStudioJson(text: string): {
    name: string;
    parts: StudioPart[];
} {
    const data = JSON.parse(text) as unknown;
    const list = Array.isArray(data)
        ? data
        : (data as { parts?: unknown })?.parts;

    if (!Array.isArray(list) || list.length === 0) {
        throw new Error('В JSON нет списка parts');
    }

    const name = (data as { name?: unknown })?.name;

    return {
        name: typeof name === 'string' ? name.slice(0, 60) : '',
        parts: list.slice(0, 120).map(sanitize),
    };
}

export function partHeight(part: StudioPart): number {
    switch (part.type) {
        case 'block':
            return part.floors * part.fh;
        case 'helipad':
            return 1.2;
        case 'garden':
            return 6;
        case 'bridge':
            return part.h;
        default:
            return part.h;
    }
}

export interface Placed {
    part: StudioPart;
    /** Bottom and top above the ground, in metres. */
    base: number;
    top: number;
    /** The block it stands on, if any. */
    under: BlockPart | null;
}

/**
 * Every part sits on top of the previous part of the same stack; a bridge
 * has a height of its own.
 */
export function layout(parts: StudioPart[]): Placed[] {
    const tops = new Map<number, { y: number; block: BlockPart | null }>();

    return parts.map((part) => {
        const stack = tops.get(part.stack) ?? { y: 0, block: null };

        if (part.type === 'bridge') {
            return {
                part,
                base: part.y,
                top: part.y + part.h,
                under: null,
            };
        }

        const top = stack.y + partHeight(part);

        tops.set(part.stack, {
            y: top,
            block: part.type === 'block' ? part : stack.block,
        });

        return { part, base: stack.y, top, under: stack.block };
    });
}

export function studioSummary(parts: StudioPart[]) {
    const placed = layout(parts);

    return {
        height: placed.reduce((max, item) => Math.max(max, item.top), 0),
        floors: parts.reduce(
            (sum, part) =>
                part.type === 'block' && part.stack === 0
                    ? sum + part.floors
                    : sum,
            0,
        ),
    };
}

/* ---------------- Presets (massing after open data) ---------------- */

const block = (o: Partial<BlockPart>): BlockPart =>
    sanitize({ ...o, type: 'block' }) as BlockPart;
const part = (o: Partial<StudioPart> & { type: StudioType }): StudioPart =>
    sanitize(o);

function burjParts(): StudioPart[] {
    const look = {
        plan: 'y' as const,
        facade: 'fins' as const,
        color: '#94adbf',
        trim: '#e3e9ee',
    };
    const parts: StudioPart[] = [
        block({
            label: 'Подиум',
            wa: 62,
            wb: 62,
            wc: 62,
            wingW: 30,
            floors: 19,
            fh: 3.9,
            ...look,
        }),
    ];

    for (let tier = 0; tier < 24; tier++) {
        const wing = (i: number) =>
            62 - 47 * Math.pow((tier + i / 3 + 1) / 25, 1.25);
        const f = tier / 23;

        parts.push(
            block({
                label: `Ярус ${tier + 1}`,
                wa: wing(0),
                wb: wing(1),
                wc: wing(2),
                wingW: 30 - 15 * f * f,
                floors: 6,
                fh: 3.75,
                ...look,
            }),
        );
    }

    parts.push(part({ type: 'spire', h: 214, r: 7, color: '#cfd6db' }));

    return parts;
}

export interface Preset {
    id: string;
    name: string;
    note: string;
    parts: () => StudioPart[];
}

export const PRESETS: Preset[] = [
    {
        id: 'nest',
        name: 'Nest One',
        note: 'Ташкент · 266,5 м',
        parts: () => [
            block({
                label: 'Стилобат',
                w: 92,
                d: 62,
                floors: 4,
                fh: 5,
                facade: 'glass',
                color: '#5f7f93',
                trim: '#cdd5da',
            }),
            block({
                label: 'Башня',
                plan: 'rounded',
                w: 54,
                d: 31,
                r: 15.5,
                floors: 47,
                fh: 4.25,
                facade: 'fins',
                color: '#6f95ad',
                trim: '#eef1f3',
            }),
            part({
                type: 'crown',
                label: 'Венец',
                style: 'fins',
                h: 46.75,
                color: '#eef1f3',
            }),
            block({
                label: 'Отель',
                w: 70,
                d: 24,
                floors: 16,
                fh: 3.8,
                x: 80,
                z: 12,
                stack: 1,
                facade: 'ribbon',
                color: '#7c97a8',
                trim: '#dde2e5',
            }),
            block({
                label: 'Офисы',
                plan: 'chamfer',
                w: 42,
                d: 42,
                r: 8,
                floors: 10,
                fh: 4,
                x: -76,
                z: 18,
                stack: 2,
                facade: 'glass',
                color: '#5b7a8f',
                trim: '#cfd6db',
            }),
        ],
    },
    {
        id: 'esb',
        name: 'Empire State Building',
        note: 'Нью-Йорк · 381 м',
        parts: () => {
            const c = {
                facade: 'deco' as const,
                color: '#d6cab4',
                trim: '#7b848b',
            };

            return [
                block({
                    label: 'Основание',
                    w: 130,
                    d: 60,
                    floors: 5,
                    fh: 4.5,
                    ...c,
                }),
                block({
                    label: 'Уступ 6–20',
                    w: 98,
                    d: 56,
                    floors: 15,
                    fh: 3.9,
                    ...c,
                }),
                block({
                    label: 'Уступ 21–29',
                    w: 80,
                    d: 50,
                    floors: 9,
                    fh: 3.8,
                    ...c,
                }),
                block({
                    label: 'Ствол 30–73',
                    w: 58,
                    d: 42,
                    floors: 44,
                    fh: 3.75,
                    ...c,
                }),
                block({
                    label: 'Уступ 74–82',
                    w: 50,
                    d: 36,
                    floors: 9,
                    fh: 3.75,
                    ...c,
                }),
                block({
                    label: 'Уступ 83–86',
                    w: 40,
                    d: 30,
                    floors: 4,
                    fh: 3.75,
                    ...c,
                }),
                block({
                    label: 'Мачта 87–102',
                    plan: 'chamfer',
                    w: 24,
                    d: 24,
                    r: 6,
                    floors: 16,
                    fh: 3.25,
                    taper: 0.72,
                    ...c,
                }),
                part({ type: 'antenna', h: 62, color: '#c3c9cd' }),
            ];
        },
    },
    {
        id: 'burj',
        name: 'Burj Khalifa',
        note: 'Дубай · 828 м',
        parts: burjParts,
    },
    {
        id: 'office',
        name: 'Офисный центр',
        note: '≈ 175 м · 42 этажа',
        parts: () => [
            block({
                w: 74,
                d: 52,
                floors: 4,
                fh: 5,
                facade: 'glass',
                color: '#3f5f73',
            }),
            block({
                w: 46,
                d: 30,
                floors: 30,
                fh: 4,
                facade: 'ribbon',
                color: '#6f8ea3',
                trim: '#e9ecee',
            }),
            block({
                w: 38,
                d: 26,
                floors: 8,
                fh: 4,
                facade: 'ribbon',
                color: '#6f8ea3',
                trim: '#e9ecee',
            }),
            part({ type: 'crown', style: 'fins', h: 12, color: '#e9ecee' }),
        ],
    },
    {
        id: 'twist',
        name: 'Скрученная башня',
        note: '≈ 230 м · 63 этажа',
        parts: () => [
            block({
                w: 64,
                d: 54,
                floors: 3,
                fh: 5,
                facade: 'glass',
                color: '#4d6f86',
            }),
            block({
                plan: 'rounded',
                w: 36,
                d: 36,
                r: 9,
                floors: 60,
                fh: 3.6,
                twist: 90,
                facade: 'glass',
                color: '#5e93b5',
                trim: '#e8edf1',
            }),
            part({ type: 'helipad', r: 9 }),
        ],
    },
    {
        id: 'deco',
        name: 'Арт-деко с иглой',
        note: 'Как Chrysler Building',
        parts: () => {
            const c = {
                facade: 'deco' as const,
                color: '#cfc6b8',
                trim: '#5d666d',
            };

            return [
                block({ w: 60, d: 60, floors: 16, fh: 4, ...c }),
                block({ w: 40, d: 40, floors: 48, fh: 3.8, ...c }),
                part({ type: 'crown', style: 'deco', h: 30, color: '#d8dde0' }),
                part({ type: 'spire', h: 38, r: 2.5, color: '#e4e8ea' }),
            ];
        },
    },
    {
        id: 'taper',
        name: 'Сужающаяся стекляшка',
        note: 'Как The Shard',
        parts: () => [
            block({
                plan: 'chamfer',
                w: 58,
                d: 46,
                r: 14,
                floors: 66,
                fh: 3.7,
                taper: 0.28,
                facade: 'glass',
                color: '#8fb1c7',
                trim: '#e7ecef',
            }),
            part({ type: 'lantern', h: 22, color: '#fff0c9' }),
        ],
    },
    {
        id: 'twins',
        name: 'Башни-близнецы с мостом',
        note: 'Как Petronas',
        parts: () => {
            const c = {
                plan: 'chamfer' as const,
                w: 40,
                d: 40,
                r: 11,
                floors: 60,
                fh: 3.8,
                facade: 'fins' as const,
                color: '#a9b6bf',
                trim: '#e9edef',
                taper: 0.8,
            };

            return [
                block({ ...c, x: -32 }),
                part({ type: 'spire', h: 50, r: 2.5 }),
                block({ ...c, x: 32, stack: 1 }),
                part({ type: 'spire', h: 50, r: 2.5, stack: 1 }),
                part({
                    type: 'bridge',
                    y: 160,
                    x1: -18,
                    z1: 0,
                    x2: 18,
                    z2: 0,
                    w: 6,
                    h: 8,
                    color: '#c6d0d6',
                }),
            ];
        },
    },
];

/* ---------------- Studio → Epochs model ---------------- */

/** Thinnest storey drawn, in tiles: taller towers merge storeys. */
const MIN_STOREY = 0.12;
/** Most stepped tiers a tapering block is drawn as. */
const MAX_TIERS = 6;
/** Free border left around the footprint, in tiles. */
const MARGIN = 0.08;

const round = (value: number) => Math.round(value * 1000) / 1000;

const GLASSY: Facade[] = ['glass', 'fins', 'ribbon'];

function shade(hex: string, factor: number, lift = 0): string {
    const channel = (i: number) =>
        clamp(
            Math.round(
                parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) * factor + lift,
            ),
            0,
            255,
        )
            .toString(16)
            .padStart(2, '0');

    return `#${channel(0)}${channel(1)}${channel(2)}`;
}

/** Half-sizes of a block's outline (before taper) on the x and y axes. */
function halfExtent(p: BlockPart): { hx: number; hy: number } {
    if (p.plan === 'y') {
        const reach = Math.max(p.wa, p.wb, p.wc);

        return { hx: reach * 0.87 + p.wingW / 2, hy: reach };
    }

    const turned = Math.abs(Math.round(p.rot / 90)) % 2 === 1;

    return turned ? { hx: p.d / 2, hy: p.w / 2 } : { hx: p.w / 2, hy: p.d / 2 };
}

export interface FitOptions {
    /** The building's footprint, in tiles. */
    size: { w: number; h: number };
    /** Height of the tallest point, in tiles. */
    height: number;
}

/**
 * The studio design as Epochs model parts: plans are fitted into the
 * footprint, heights scaled so the tallest point is `height` tiles. Epochs
 * draws upright, axis-aligned shapes only, so twist and free rotation are
 * left out and a tapering block becomes stepped tiers.
 */
export function toModelParts(
    parts: StudioPart[],
    { size, height }: FitOptions,
): ModelPart[] {
    const placed = layout(parts);
    const total = Math.max(1, ...placed.map((item) => item.top));
    const vertical = height / total;

    // Horizontal fit: the plans of every block and bridge end.
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const grow = (x: number, y: number) => {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    };

    for (const { part: p } of placed) {
        if (p.type === 'block') {
            const { hx, hy } = halfExtent(p);
            const scale = Math.max(1, p.taper);

            grow(p.x - hx * scale, p.z - hy * scale);
            grow(p.x + hx * scale, p.z + hy * scale);
        } else if (p.type === 'bridge') {
            grow(p.x1, p.z1);
            grow(p.x2, p.z2);
        }
    }

    if (!Number.isFinite(minX)) {
        grow(-10, -10);
        grow(10, 10);
    }

    const room = { w: size.w - MARGIN * 2, h: size.h - MARGIN * 2 };
    const across = Math.min(
        room.w / Math.max(1, maxX - minX),
        room.h / Math.max(1, maxY - minY),
    );
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const tx = (x: number) => size.w / 2 + (x - cx) * across;
    const ty = (y: number) => size.h / 2 + (y - cy) * across;
    const tz = (z: number) => z * vertical;

    const out: ModelPart[] = [
        {
            kind: 'ground',
            x: 0.05,
            y: 0.05,
            w: size.w - 0.1,
            d: size.h - 0.1,
            color: 'plaza',
        },
    ];

    /** A block's top outline: centre and size in tiles. */
    const topOf = (p: BlockPart | null) => {
        if (!p) {
            return { x: size.w / 2, y: size.h / 2, w: 0.6, d: 0.6 };
        }

        const { hx, hy } = halfExtent(p);

        return {
            x: tx(p.x),
            y: ty(p.z),
            w: hx * 2 * p.taper * across,
            d: hy * 2 * p.taper * across,
        };
    };

    for (const { part: p, base, top, under } of placed) {
        const z0 = tz(base);
        const h = tz(top) - z0;

        switch (p.type) {
            case 'block':
                out.push(...blockParts(p, z0, h, { tx, ty, across }));
                break;

            case 'crown':
                out.push(...crownParts(p, topOf(under), z0, h));
                break;

            case 'spire': {
                const t = topOf(under);

                out.push({
                    kind: 'cylinder',
                    x: round(t.x),
                    y: round(t.y),
                    z: round(z0),
                    r: round(
                        clamp(p.r * across, 0.025, Math.min(t.w, t.d) / 2),
                    ),
                    h: round(h),
                    color: p.color,
                    taper: 0,
                    segments: 12,
                    material: 'metal',
                });
                break;
            }

            case 'antenna': {
                const t = topOf(under);

                out.push({
                    kind: 'pole',
                    x: round(t.x),
                    y: round(t.y),
                    z: round(z0),
                    h: round(h),
                    color: p.color,
                    blink: '#ff4d4d',
                });
                break;
            }

            case 'helipad': {
                const t = topOf(under);
                const r = clamp(p.r * across, 0.08, Math.min(t.w, t.d) / 2);

                out.push(
                    {
                        kind: 'cylinder',
                        x: round(t.x),
                        y: round(t.y),
                        z: round(z0),
                        r: round(r),
                        h: 0.03,
                        color: '#3a4048',
                        segments: 24,
                    },
                    {
                        kind: 'cylinder',
                        x: round(t.x),
                        y: round(t.y),
                        z: round(z0 + 0.03),
                        r: round(r * 0.35),
                        h: 0.01,
                        color: '#f2c84b',
                        segments: 24,
                        material: 'glow',
                    },
                );
                break;
            }

            case 'garden': {
                const t = topOf(under);
                const count = Math.max(2, Math.round(p.density * 8));

                out.push({
                    kind: 'box',
                    x: round(t.x - t.w * 0.45),
                    y: round(t.y - t.d * 0.45),
                    z: round(z0),
                    w: round(t.w * 0.9),
                    d: round(t.d * 0.9),
                    h: 0.03,
                    color: '#5f8f3e',
                });

                for (let i = 0; i < count; i++) {
                    const a = (i / count) * Math.PI * 2;

                    out.push({
                        kind: 'sphere',
                        x: round(t.x + Math.cos(a) * t.w * 0.28),
                        y: round(t.y + Math.sin(a) * t.d * 0.28),
                        z: round(z0 + 0.08),
                        r: round(clamp(Math.min(t.w, t.d) * 0.09, 0.03, 0.12)),
                        color: i % 2 ? '#4f8a3a' : '#6aa84f',
                    });
                }

                break;
            }

            case 'lantern': {
                const t = topOf(under);

                out.push(
                    {
                        kind: 'box',
                        x: round(t.x - t.w * 0.25),
                        y: round(t.y - t.d * 0.25),
                        z: round(z0),
                        w: round(t.w * 0.5),
                        d: round(t.d * 0.5),
                        h: round(h),
                        color: p.color,
                        material: 'glow',
                    },
                    {
                        kind: 'light',
                        x: round(t.x),
                        y: round(t.y),
                        z: round(z0 + h),
                        radius: 2,
                        color: p.color,
                    },
                );
                break;
            }

            case 'bridge': {
                const half = (p.w * across) / 2;
                const x0 = Math.min(tx(p.x1), tx(p.x2));
                const x1 = Math.max(tx(p.x1), tx(p.x2));
                const y0 = Math.min(ty(p.z1), ty(p.z2));
                const y1 = Math.max(ty(p.z1), ty(p.z2));

                out.push({
                    kind: 'box',
                    x: round(x0 - (x1 - x0 < y1 - y0 ? half : 0)),
                    y: round(y0 - (x1 - x0 < y1 - y0 ? 0 : half)),
                    z: round(z0),
                    w: round(Math.max(x1 - x0, half * 2)),
                    d: round(Math.max(y1 - y0, half * 2)),
                    h: round(Math.max(h, 0.05)),
                    color: p.color,
                    material: 'glass',
                });
                break;
            }
        }
    }

    return out;
}

interface Mapping {
    tx: (x: number) => number;
    ty: (y: number) => number;
    across: number;
}

function blockParts(
    p: BlockPart,
    z0: number,
    h: number,
    { tx, ty, across }: Mapping,
): ModelPart[] {
    const glassy = GLASSY.includes(p.facade);
    const window = glassy ? shade(p.color, 1.25, 30) : '#2b3946';
    const band = p.facade === 'solid' ? undefined : p.trim;
    const material = glassy ? ('metal' as const) : undefined;

    // Taper: stepped tiers, each as wide as the block halfway up it.
    const tapering = Math.abs(p.taper - 1) > 0.02;
    const tiers = tapering ? clamp(Math.round(p.floors / 4), 2, MAX_TIERS) : 1;
    const out: ModelPart[] = [];
    const cx = tx(p.x);
    const cy = ty(p.z);

    for (let tier = 0; tier < tiers; tier++) {
        const scale = 1 + (p.taper - 1) * ((tier + 0.5) / tiers);
        const tz0 = z0 + (h * tier) / tiers;
        const th = h / tiers;
        const storeys = Math.max(1, Math.round(p.floors / tiers));
        const visible = Math.max(
            1,
            Math.min(storeys, Math.floor(th / MIN_STOREY)),
        );
        const fh = round(th / visible);

        if (p.plan === 'ellipse') {
            out.push({
                kind: 'cylinder',
                x: round(cx),
                y: round(cy),
                z: round(tz0),
                r: round(((p.w + p.d) / 4) * scale * across),
                h: round(th),
                color: p.color,
                taper: tapering
                    ? round((1 + (p.taper - 1) * ((tier + 1) / tiers)) / scale)
                    : 1,
                segments: 32,
                material: glassy ? 'glass' : undefined,
            });

            continue;
        }

        const storey = (
            x: number,
            y: number,
            w: number,
            d: number,
        ): ModelPart => ({
            kind: 'floors',
            x: round(x - w / 2),
            y: round(y - d / 2),
            z: round(tz0),
            w: round(w),
            d: round(d),
            floors: visible,
            floorHeight: fh,
            color: p.color,
            window,
            ...(band ? { band } : {}),
            ...(material ? { material } : {}),
        });

        if (p.plan === 'y') {
            // Seen from above a Y: one wing north, the other two spread
            // south-east and south-west — drawn as a T of two blocks.
            const wing = p.wingW * scale * across;
            const north = p.wa * scale * across;
            const span = (p.wb + p.wc) * 0.87 * scale * across + wing;
            const south = Math.max(p.wb, p.wc) * 0.5 * scale * across;

            out.push(
                storey(cx, cy - north / 2 + wing / 4, wing, north + wing / 2),
            );
            out.push(storey(cx, cy + south / 2, span, Math.max(wing, south)));

            continue;
        }

        const { hx, hy } = halfExtent(p);
        const shrink = p.plan === 'tri' ? 0.78 : 1;

        out.push(
            storey(
                cx,
                cy,
                hx * 2 * scale * across * shrink,
                hy * 2 * scale * across * shrink,
            ),
        );
    }

    return out;
}

function crownParts(
    p: CrownPart,
    t: { x: number; y: number; w: number; d: number },
    z0: number,
    h: number,
): ModelPart[] {
    const x0 = t.x - t.w / 2;
    const y0 = t.y - t.d / 2;

    switch (p.style) {
        case 'ring':
            return [
                {
                    kind: 'torus',
                    x: round(t.x),
                    y: round(t.y),
                    z: round(z0 + h / 2),
                    r: round(Math.min(t.w, t.d) * 0.42),
                    tube: round(clamp(h * 0.12, 0.02, 0.08)),
                    color: p.color,
                    material: 'metal',
                },
            ];

        case 'pyramid':
        case 'slope':
            return [
                {
                    kind: 'roof',
                    shape: p.style === 'pyramid' ? 'pyramid' : 'shed',
                    x: round(x0),
                    y: round(y0),
                    z: round(z0),
                    w: round(t.w),
                    d: round(t.d),
                    h: round(h),
                    color: p.color,
                    material: 'metal',
                },
            ];

        case 'deco':
            return [0, 1, 2].map((step) => {
                const k = 1 - step * 0.25;

                return {
                    kind: 'box' as const,
                    x: round(t.x - (t.w * k) / 2),
                    y: round(t.y - (t.d * k) / 2),
                    z: round(z0 + (h * step) / 3),
                    w: round(t.w * k),
                    d: round(t.d * k),
                    h: round(h / 3),
                    color: p.color,
                    material: 'metal' as const,
                };
            });

        default: {
            // A frame of fins: four thin walls around the roof.
            const thick = round(clamp(Math.min(t.w, t.d) * 0.06, 0.02, 0.06));

            return [
                [x0, y0, t.w, thick],
                [x0, y0 + t.d - thick, t.w, thick],
                [x0, y0, thick, t.d],
                [x0 + t.w - thick, y0, thick, t.d],
            ].map(([x, y, w, d]) => ({
                kind: 'box' as const,
                x: round(x),
                y: round(y),
                z: round(z0),
                w: round(w),
                d: round(d),
                h: round(h),
                color: p.color,
                material: 'metal' as const,
            }));
        }
    }
}
