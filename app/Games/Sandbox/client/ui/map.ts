/**
 * The map of Qing Mao Mountain: the whole land as an old ink map on dark
 * parchment — the slopes shaded and ringed with contour lines every ten
 * metres, water, the paths dashed, the three clan villages inside their
 * palisades with their names, the summit — and the hero, an arrow that
 * turns the way they look. North is up.
 *
 * The land is drawn once, the first time the map opens; then only the
 * hero's arrow moves. N, Esc or a tap closes it.
 */

import { t } from '../i18n';
import { TOUCH } from '../input';
import { PATHS, SUMMIT, VILLAGES } from '../world/qingmao';
import type { Clan } from '../world/qingmao';
import { heightAt, WATER_LEVEL, WORLD_HALF } from '../world/terrain';
import { element } from './dom';

/** Height samples along a side, and the canvas' side in pixels. */
const SAMPLES = 256;
const SIZE = 1024;
const CONTOUR = 10;

const PARCHMENT: [number, number, number] = [134, 120, 94];
const WATER: [number, number, number] = [58, 70, 74];
const INK = 'rgb(28 22 18)';
const BLOOD = 'rgb(168 38 31)';

const CLAN_FILL: Record<Clan, string> = {
    gu_yue: 'rgb(34 48 74 / 0.35)',
    bai: 'rgb(217 213 204 / 0.35)',
    xiong: 'rgb(59 40 28 / 0.4)',
};

/** World metres to canvas pixels. */
const toMap = (value: number) =>
    ((value + WORLD_HALF) / (WORLD_HALF * 2)) * SIZE;

export class WorldMap {
    readonly element: HTMLElement;
    private canvas: HTMLCanvasElement;
    private land: HTMLCanvasElement | null = null;
    private drawn = { x: NaN, z: NaN, heading: NaN };

    constructor(root: HTMLElement, close: () => void) {
        this.element = element('div', 'sb-overlay sb-map');
        this.element.hidden = true;

        const card = element('div', 'sb-card sb-map__card');
        this.canvas = element('canvas', 'sb-map__canvas');
        this.canvas.width = SIZE;
        this.canvas.height = SIZE;
        card.append(
            element('h1', '', t.map.title),
            this.canvas,
            element('p', 'sb-hint', TOUCH ? t.map.hint_touch : t.map.hint),
        );
        this.element.append(card);
        this.element.addEventListener('click', close);
        root.append(this.element);
    }

    get open(): boolean {
        return !this.element.hidden;
    }

    show(): void {
        this.land ??= this.drawLand();
        this.drawn.x = NaN;
        this.element.hidden = false;
    }

    hide(): void {
        this.element.hidden = true;
    }

    /** Moves the hero's arrow: where they are, which way they look (clockwise from north). */
    update(x: number, z: number, heading: number): void {
        if (
            !this.open ||
            (Math.abs(x - this.drawn.x) < 0.5 &&
                Math.abs(z - this.drawn.z) < 0.5 &&
                Math.abs(heading - this.drawn.heading) < 0.02)
        ) {
            return;
        }

        this.drawn = { x, z, heading };
        const context = this.canvas.getContext('2d')!;
        context.drawImage(this.land!, 0, 0);

        context.save();
        context.translate(toMap(x), toMap(z));
        context.rotate(heading);
        context.beginPath();
        context.moveTo(0, -22);
        context.lineTo(13, 14);
        context.lineTo(0, 7);
        context.lineTo(-13, 14);
        context.closePath();
        context.fillStyle = BLOOD;
        context.strokeStyle = 'rgb(243 231 211)';
        context.lineWidth = 3;
        context.fill();
        context.stroke();
        context.restore();

        context.font = '600 26px "Golos Text", sans-serif';
        context.fillStyle = 'rgb(243 231 211)';
        context.textAlign = 'center';
        context.fillText(t.map.you, toMap(x), toMap(z) + 46);
    }

    /** The land: shaded, contoured, with the paths, villages and summit. */
    private drawLand(): HTMLCanvasElement {
        const heights = new Float32Array(SAMPLES * SAMPLES);
        const step = (WORLD_HALF * 2) / SAMPLES;

        for (let j = 0; j < SAMPLES; j++) {
            for (let i = 0; i < SAMPLES; i++) {
                heights[j * SAMPLES + i] = heightAt(
                    -WORLD_HALF + (i + 0.5) * step,
                    -WORLD_HALF + (j + 0.5) * step,
                );
            }
        }

        const relief = document.createElement('canvas');
        relief.width = SAMPLES;
        relief.height = SAMPLES;
        const reliefContext = relief.getContext('2d')!;
        const image = reliefContext.createImageData(SAMPLES, SAMPLES);
        const at = (i: number, j: number) =>
            heights[
                Math.min(SAMPLES - 1, Math.max(0, j)) * SAMPLES +
                    Math.min(SAMPLES - 1, Math.max(0, i))
            ];

        for (let j = 0; j < SAMPLES; j++) {
            for (let i = 0; i < SAMPLES; i++) {
                const height = at(i, j);
                // Light from the north-west.
                const shade = Math.max(
                    0.55,
                    Math.min(
                        1.25,
                        1 +
                            ((at(i - 1, j) - at(i + 1, j)) * 0.5 +
                                (at(i, j - 1) - at(i, j + 1)) * 0.5) /
                                step,
                    ),
                );
                const base = height < WATER_LEVEL ? WATER : PARCHMENT;
                // Higher ground a little darker, like ink washed over it.
                const wash =
                    height < WATER_LEVEL ? 1 : 1 - Math.min(0.35, height / 400);
                const k = (j * SAMPLES + i) * 4;

                for (let c = 0; c < 3; c++) {
                    image.data[k + c] = base[c] * shade * wash;
                }

                image.data[k + 3] = 255;
            }
        }

        reliefContext.putImageData(image, 0, 0);

        const land = document.createElement('canvas');
        land.width = SIZE;
        land.height = SIZE;
        const context = land.getContext('2d')!;
        context.imageSmoothingEnabled = true;
        context.drawImage(relief, 0, 0, SIZE, SIZE);
        this.drawContours(context, heights);

        // The paths, dashed.
        context.strokeStyle = INK;
        context.lineWidth = 3;
        context.setLineDash([10, 8]);

        for (const path of PATHS) {
            context.beginPath();
            path.forEach(([x, z], index) =>
                index
                    ? context.lineTo(toMap(x), toMap(z))
                    : context.moveTo(toMap(x), toMap(z)),
            );
            context.stroke();
        }

        context.setLineDash([]);

        // The summit.
        const sx = toMap(SUMMIT.x);
        const sz = toMap(SUMMIT.z);
        context.beginPath();
        context.moveTo(sx, sz - 18);
        context.lineTo(sx + 16, sz + 10);
        context.lineTo(sx - 16, sz + 10);
        context.closePath();
        context.fillStyle = INK;
        context.fill();
        context.font = '600 24px "Golos Text", sans-serif';
        context.textAlign = 'center';
        context.fillText(
            `${t.map.summit} · ${Math.round(heightAt(SUMMIT.x, SUMMIT.z))} ${t.hud.metres}`,
            sx,
            sz + 40,
        );

        // The villages: the palisade's ring, the clan's colour, the name.
        context.textBaseline = 'middle';

        for (const village of VILLAGES) {
            const x = toMap(village.x);
            const z = toMap(village.z);
            const radius = (village.radius / (WORLD_HALF * 2)) * SIZE;

            context.beginPath();
            context.arc(x, z, radius, 0, Math.PI * 2);
            context.fillStyle = CLAN_FILL[village.clan];
            context.fill();
            context.lineWidth = 4;
            context.strokeStyle = INK;
            context.setLineDash([3, 4]);
            context.stroke();
            context.setLineDash([]);

            const name = t.villages[village.clan][0];
            context.font = '700 30px "Unbounded", "Golos Text", sans-serif';
            context.lineWidth = 6;
            context.strokeStyle = 'rgb(134 120 94 / 0.9)';
            context.strokeText(name, x, z - radius * 0.45);
            context.fillStyle = INK;
            context.fillText(name, x, z - radius * 0.45);
        }

        context.textBaseline = 'alphabetic';

        // A frame of old blood.
        context.lineWidth = 8;
        context.strokeStyle = BLOOD;
        context.strokeRect(4, 4, SIZE - 8, SIZE - 8);

        return land;
    }
    /**
     * Contour lines every CONTOUR metres, traced through the height grid
     * (marching squares) as ink lines: every fifth one bolder.
     */
    private drawContours(
        context: CanvasRenderingContext2D,
        heights: Float32Array,
    ): void {
        const cell = SIZE / SAMPLES;
        const levels = new Map<number, number[]>();

        for (let j = 0; j < SAMPLES - 1; j++) {
            for (let i = 0; i < SAMPLES - 1; i++) {
                const a = heights[j * SAMPLES + i];
                const b = heights[j * SAMPLES + i + 1];
                const c = heights[(j + 1) * SAMPLES + i + 1];
                const d = heights[(j + 1) * SAMPLES + i];
                const low = Math.max(WATER_LEVEL, Math.min(a, b, c, d));
                const high = Math.max(a, b, c, d);

                for (
                    let level = Math.ceil(low / CONTOUR) * CONTOUR;
                    level <= high;
                    level += CONTOUR
                ) {
                    // Where the level crosses each edge of the cell.
                    const cuts: number[] = [];
                    const edge = (
                        h0: number,
                        h1: number,
                        x0: number,
                        y0: number,
                        x1: number,
                        y1: number,
                    ) => {
                        if (h0 < level !== h1 < level) {
                            const share = (level - h0) / (h1 - h0);
                            cuts.push(
                                (i + 0.5 + x0 + (x1 - x0) * share) * cell,
                                (j + 0.5 + y0 + (y1 - y0) * share) * cell,
                            );
                        }
                    };

                    edge(a, b, 0, 0, 1, 0);
                    edge(b, c, 1, 0, 1, 1);
                    edge(c, d, 1, 1, 0, 1);
                    edge(d, a, 0, 1, 0, 0);

                    if (cuts.length >= 4) {
                        let list = levels.get(level);

                        if (!list) {
                            list = [];
                            levels.set(level, list);
                        }

                        list.push(...cuts.slice(0, 4));

                        if (cuts.length === 8) {
                            list.push(...cuts.slice(4, 8));
                        }
                    }
                }
            }
        }

        context.lineCap = 'round';

        for (const [level, segments] of levels) {
            const bold = level % (CONTOUR * 5) === 0;
            context.strokeStyle = bold
                ? 'rgb(28 22 18 / 0.7)'
                : 'rgb(28 22 18 / 0.38)';
            context.lineWidth = bold ? 2.4 : 1.3;
            context.beginPath();

            for (let k = 0; k < segments.length; k += 4) {
                context.moveTo(segments[k], segments[k + 1]);
                context.lineTo(segments[k + 2], segments[k + 3]);
            }

            context.stroke();
        }
    }
}
