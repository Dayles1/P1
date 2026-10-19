import { describe, expect, it } from 'vitest';
import { gesture, IDLE, lPath } from './gestures';
import type {
    GestureEffect,
    GestureInput,
    GestureState,
    Hit,
} from './gestures';

function run(inputs: GestureInput[], state: GestureState = IDLE) {
    const effects: GestureEffect[] = [];

    for (const input of inputs) {
        const result = gesture(state, input);

        state = result.state;
        effects.push(...result.effects);
    }

    return { state, effects };
}

const down = (
    x: number,
    y: number,
    hit: Hit = 'none',
    extra: Partial<Extract<GestureInput, { type: 'down' }>> = {},
): GestureInput => ({
    type: 'down',
    id: extra.id ?? 1,
    x,
    y,
    button: 0,
    hit,
    mouse: false,
    draws: false,
    paintable: false,
    ...extra,
});
const move = (x: number, y: number, id = 1): GestureInput => ({
    type: 'move',
    id,
    x,
    y,
});
const up = (x: number, y: number, id = 1): GestureInput => ({
    type: 'up',
    id,
    x,
    y,
});

describe('the pointer machine (ui-spec §7.1)', () => {
    it('taps below the 5-px threshold and pans above it', () => {
        const tap = run([down(100, 100), move(103, 102), up(103, 102)]);

        expect(tap.effects).toEqual([
            { type: 'tap', x: 103, y: 102, mouse: false, button: 0 },
        ]);

        const pan = run([
            down(100, 100),
            move(120, 100),
            move(130, 110),
            up(130, 110),
        ]);

        expect(pan.effects.map((e) => e.type)).toEqual(['pan', 'pan']);
        expect(pan.effects[0]).toEqual({ type: 'pan', dx: 20, dy: 0 });
        expect(pan.effects[1]).toEqual({ type: 'pan', dx: 10, dy: 10 });
    });

    it('moves the ghost on a drag from it and pans on a drag elsewhere', () => {
        const ghost = run([down(50, 50, 'ghost'), move(80, 50), up(80, 50)]);

        expect(ghost.effects).toEqual([
            { type: 'ghost', x: 80, y: 50 },
            { type: 'release', x: 80, y: 50, mode: 'ghost' },
        ]);

        const elsewhere = run([down(50, 50, 'none'), move(80, 50)]);

        expect(elsewhere.effects).toEqual([{ type: 'pan', dx: 30, dy: 0 }]);
    });

    it('draws a line only from a handle; a finger elsewhere still pans', () => {
        const fromHandle = run([down(10, 10, 'handle-end'), move(40, 10)]);

        expect(fromHandle.effects).toEqual([
            { type: 'line', x: 40, y: 10, fromX: 10, fromY: 10, handle: 'end' },
        ]);

        const fromGround = run([down(10, 10, 'none'), move(40, 10)]);

        expect(fromGround.effects[0].type).toBe('pan');
    });

    it('lets a mouse draw with the left button and orbit with the right', () => {
        const draw = run([
            down(0, 0, 'none', { mouse: true, draws: true }),
            move(20, 0),
        ]);

        expect(draw.effects[0]).toMatchObject({ type: 'line', handle: 'new' });

        const orbit = run([
            down(0, 0, 'none', { mouse: true, button: 2 }),
            move(20, 0),
        ]);

        expect(orbit.effects).toEqual([{ type: 'orbit', dx: 20, dy: 0 }]);
    });

    it('starts a painted row after a hold on a paintable ghost', () => {
        const held = run([
            down(30, 30, 'ghost', { paintable: true }),
            { type: 'hold' },
            move(31, 30),
            move(60, 30),
            up(60, 30),
        ]);

        expect(held.effects.map((e) => e.type)).toEqual([
            'paint-start',
            'paint',
            'paint',
            'release',
        ]);

        const notPaintable = run([down(30, 30, 'ghost'), { type: 'hold' }]);

        expect(notPaintable.effects).toEqual([]);
        expect(notPaintable.state.mode).toBe('press');
    });

    it('pinches with two fingers and does not tap when they lift', () => {
        const pinch = run([
            down(0, 0, 'none', { id: 1 }),
            down(100, 0, 'none', { id: 2 }),
            move(200, 0, 2),
            up(200, 0, 2),
            up(0, 0, 1),
        ]);

        expect(pinch.effects.length).toBe(1);
        expect(pinch.effects[0]).toMatchObject({ type: 'pinch', scale: 2 });
    });

    it('hovers when a mouse moves with no button down', () => {
        expect(run([move(5, 6)]).effects).toEqual([
            { type: 'hover', x: 5, y: 6 },
        ]);
    });
});

describe('L-paths of the line tool (ui-spec §6.2)', () => {
    it('runs the first leg along the longer axis and flips with the bend', () => {
        const flat = lPath({ x: 0, y: 0 }, { x: 3, y: 1 }, 0);

        expect(flat).toEqual([
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 2, y: 0 },
            { x: 3, y: 0 },
            { x: 3, y: 1 },
        ]);

        const bent = lPath({ x: 0, y: 0 }, { x: 3, y: 1 }, 1);

        expect(bent[1]).toEqual({ x: 0, y: 1 });
        expect(bent.at(-1)).toEqual({ x: 3, y: 1 });
        expect(lPath({ x: 2, y: 2 }, { x: 2, y: 2 }, 0)).toEqual([
            { x: 2, y: 2 },
        ]);
    });
});
