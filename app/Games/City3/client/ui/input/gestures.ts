/**
 * The canvas pointer machine (ui-spec §7.1–§7.2) as a pure reducer: raw
 * pointer events in, intents out. One finger pans unless the press began
 * on the ghost (moves it), on a line handle (draws), or on a road in the
 * bulldozer (selects a run); drawing never steals the pan. Two fingers
 * pinch, twist and pan. A 400 ms hold on a paintable ghost starts a
 * painted row. The 5-px drag threshold is v2's. With a mouse, the right
 * or middle button orbits, a left drag in the line tool draws, and moving
 * without a button hovers (the ghost follows the cursor).
 */

/** What the press landed on, worked out by the caller from the tool. */
export type Hit = 'ghost' | 'handle-start' | 'handle-end' | 'road' | 'none';

export const DRAG_THRESHOLD = 5;
export const HOLD_MS = 400;

interface Pointer {
    id: number;
    x: number;
    y: number;
}

export type GestureMode =
    | 'idle'
    | 'press'
    | 'pan'
    | 'orbit'
    | 'pinch'
    | 'ghost'
    | 'line'
    | 'held'
    | 'paint';

export interface GestureState {
    mode: GestureMode;
    pointers: readonly Pointer[];
    downX: number;
    downY: number;
    lastX: number;
    lastY: number;
    button: number;
    hit: Hit;
    mouse: boolean;
    /** A left mouse drag draws a line (the line tool). */
    draws: boolean;
    /** The ghost can paint a row (homes, parks). */
    paintable: boolean;
    handle: 'start' | 'end' | 'new';
    pinch: { distance: number; angle: number; x: number; y: number } | null;
}

export type GestureInput =
    | {
          type: 'down';
          id: number;
          x: number;
          y: number;
          button: number;
          hit: Hit;
          mouse: boolean;
          draws: boolean;
          paintable: boolean;
      }
    | { type: 'move'; id: number; x: number; y: number }
    | { type: 'up'; id: number; x: number; y: number }
    | { type: 'cancel'; id: number }
    /** The hold timer fired (HOLD_MS after a press). */
    | { type: 'hold' };

export type GestureEffect =
    | { type: 'pan'; dx: number; dy: number }
    | { type: 'orbit'; dx: number; dy: number }
    | {
          type: 'pinch';
          scale: number;
          rotate: number;
          dx: number;
          dy: number;
          x: number;
          y: number;
      }
    | { type: 'tap'; x: number; y: number; mouse: boolean; button: number }
    | { type: 'ghost'; x: number; y: number }
    | {
          type: 'line';
          x: number;
          y: number;
          fromX: number;
          fromY: number;
          handle: 'start' | 'end' | 'new';
      }
    | { type: 'paint-start'; x: number; y: number }
    | { type: 'paint'; x: number; y: number }
    | { type: 'release'; x: number; y: number; mode: GestureMode }
    | { type: 'hover'; x: number; y: number };

export const IDLE: GestureState = {
    mode: 'idle',
    pointers: [],
    downX: 0,
    downY: 0,
    lastX: 0,
    lastY: 0,
    button: 0,
    hit: 'none',
    mouse: false,
    draws: false,
    paintable: false,
    handle: 'new',
    pinch: null,
};

function pinchOf(pointers: readonly Pointer[]) {
    const [a, b] = pointers;

    return {
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        angle: Math.atan2(b.y - a.y, b.x - a.x),
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
    };
}

/** The drag mode a press turns into once it moves past the threshold. */
function dragMode(state: GestureState): GestureState['mode'] {
    if (state.mouse && state.button !== 0) {
        return 'orbit';
    }

    if (state.hit === 'ghost') {
        return state.mouse && state.paintable ? 'paint' : 'ghost';
    }

    if (
        state.hit === 'handle-start' ||
        state.hit === 'handle-end' ||
        state.hit === 'road' ||
        (state.mouse && state.draws)
    ) {
        return 'line';
    }

    return 'pan';
}

export function gesture(
    state: GestureState,
    input: GestureInput,
): { state: GestureState; effects: GestureEffect[] } {
    switch (input.type) {
        case 'down': {
            const pointers = [
                ...state.pointers.filter((p) => p.id !== input.id),
                { id: input.id, x: input.x, y: input.y },
            ];

            if (pointers.length >= 2) {
                return {
                    state: {
                        ...state,
                        mode: 'pinch',
                        pointers: pointers.slice(-2),
                        pinch: pinchOf(pointers.slice(-2)),
                    },
                    effects: [],
                };
            }

            return {
                state: {
                    ...IDLE,
                    mode: 'press',
                    pointers,
                    downX: input.x,
                    downY: input.y,
                    lastX: input.x,
                    lastY: input.y,
                    button: input.button,
                    hit: input.hit,
                    mouse: input.mouse,
                    draws: input.draws,
                    paintable: input.paintable,
                    handle:
                        input.hit === 'handle-start'
                            ? 'start'
                            : input.hit === 'handle-end'
                              ? 'end'
                              : 'new',
                },
                effects: [],
            };
        }

        case 'move': {
            if (!state.pointers.some((p) => p.id === input.id)) {
                return state.mode === 'idle' && state.pointers.length === 0
                    ? {
                          state,
                          effects: [{ type: 'hover', x: input.x, y: input.y }],
                      }
                    : { state, effects: [] };
            }

            const pointers = state.pointers.map((p) =>
                p.id === input.id ? { ...p, x: input.x, y: input.y } : p,
            );

            if (
                state.mode === 'pinch' &&
                pointers.length === 2 &&
                state.pinch
            ) {
                const next = pinchOf(pointers);

                return {
                    state: { ...state, pointers, pinch: next },
                    effects: [
                        {
                            type: 'pinch',
                            scale: next.distance / state.pinch.distance,
                            rotate: state.pinch.angle - next.angle,
                            dx: next.x - state.pinch.x,
                            dy: next.y - state.pinch.y,
                            x: next.x,
                            y: next.y,
                        },
                    ],
                };
            }

            let mode = state.mode;

            if (mode === 'press') {
                if (
                    Math.hypot(input.x - state.downX, input.y - state.downY) <=
                    DRAG_THRESHOLD
                ) {
                    return { state: { ...state, pointers }, effects: [] };
                }

                mode = dragMode(state);
            } else if (mode === 'held') {
                mode = 'paint';
            }

            const next = {
                ...state,
                mode,
                pointers,
                lastX: input.x,
                lastY: input.y,
            };
            const effects: GestureEffect[] = [];

            if (mode === 'pan') {
                effects.push({
                    type: 'pan',
                    dx: input.x - state.lastX,
                    dy: input.y - state.lastY,
                });
            } else if (mode === 'orbit') {
                effects.push({
                    type: 'orbit',
                    dx: input.x - state.lastX,
                    dy: input.y - state.lastY,
                });
            } else if (mode === 'ghost') {
                effects.push({ type: 'ghost', x: input.x, y: input.y });
            } else if (mode === 'line') {
                effects.push({
                    type: 'line',
                    x: input.x,
                    y: input.y,
                    fromX: state.downX,
                    fromY: state.downY,
                    handle: state.handle,
                });
            } else if (mode === 'paint') {
                if (state.mode === 'press') {
                    effects.push({
                        type: 'paint-start',
                        x: state.downX,
                        y: state.downY,
                    });
                }

                effects.push({ type: 'paint', x: input.x, y: input.y });
            }

            return { state: next, effects };
        }

        case 'up': {
            const pointers = state.pointers.filter((p) => p.id !== input.id);

            if (state.mode === 'pinch') {
                // The other finger stays down but no longer pans or taps.
                return {
                    state: {
                        ...IDLE,
                        mode: pointers.length ? 'pinch' : 'idle',
                        pointers,
                        pinch: null,
                    },
                    effects: [],
                };
            }

            if (!state.pointers.some((p) => p.id === input.id)) {
                return { state, effects: [] };
            }

            const effects: GestureEffect[] = [];

            if (state.mode === 'press') {
                effects.push({
                    type: 'tap',
                    x: input.x,
                    y: input.y,
                    mouse: state.mouse,
                    button: state.button,
                });
            } else if (
                state.mode === 'ghost' ||
                state.mode === 'line' ||
                state.mode === 'paint' ||
                state.mode === 'held'
            ) {
                effects.push({
                    type: 'release',
                    x: input.x,
                    y: input.y,
                    mode: state.mode,
                });
            }

            return { state: { ...IDLE, pointers }, effects };
        }

        case 'cancel': {
            const pointers = state.pointers.filter((p) => p.id !== input.id);

            return {
                state: {
                    ...IDLE,
                    mode: pointers.length ? 'pinch' : 'idle',
                    pointers,
                },
                effects: [],
            };
        }

        case 'hold': {
            if (
                state.mode === 'press' &&
                state.hit === 'ghost' &&
                state.paintable &&
                !state.mouse
            ) {
                return {
                    state: { ...state, mode: 'held' },
                    effects: [
                        { type: 'paint-start', x: state.downX, y: state.downY },
                    ],
                };
            }

            return { state, effects: [] };
        }
    }
}

/** Tiles of an L-path between two tiles; the first leg runs along the longer axis, `bend` flips it. */
export function lPath(
    from: { x: number; y: number },
    to: { x: number; y: number },
    bend: 0 | 1,
): { x: number; y: number }[] {
    const path: { x: number; y: number }[] = [];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const xFirst = Math.abs(dx) >= Math.abs(dy) !== (bend === 1);
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);
    let x = from.x;
    let y = from.y;

    path.push({ x, y });

    if (xFirst) {
        while (x !== to.x) {
            x += sx;
            path.push({ x, y });
        }

        while (y !== to.y) {
            y += sy;
            path.push({ x, y });
        }
    } else {
        while (y !== to.y) {
            y += sy;
            path.push({ x, y });
        }

        while (x !== to.x) {
            x += sx;
            path.push({ x, y });
        }
    }

    return path;
}
