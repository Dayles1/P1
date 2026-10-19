/**
 * Wires the canvas and the window to the controller: pointer events go
 * through the gesture reducer (ui-spec §7.1–§7.2), keys through the
 * shortcut map (§7.3). One window listener; an open modal dialog takes
 * the keys first, and typing in a field is left alone.
 */

import type { Controller } from '../controller';
import { isPaintable } from '../game/catalog';
import type { Tile } from '../store/ui-store';
import { gesture, HOLD_MS, IDLE } from './gestures';
import type { GestureEffect, GestureInput, Hit } from './gestures';
import { keyAction, panKey } from './keyboard';

function near(a: Tile, b: Tile | null, reach: number): boolean {
    return (
        b !== null &&
        Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= reach
    );
}

/** What a press at a point lands on, for the current tool. */
function hitTest(ctl: Controller, px: number, py: number, mouse: boolean): Hit {
    const tool = ctl.state.tool;
    const tile = ctl.tileAt(px, py);

    if (!tile) {
        return 'none';
    }

    if ((tool.kind === 'place' || tool.kind === 'move') && tool.ghost) {
        const type =
            tool.kind === 'place'
                ? tool.type
                : (ctl.game.buildings.get(tool.uid)?.type ?? '');

        if (!type) {
            return 'none';
        }

        const def = ctl.game.content.building(type);
        const paintable = tool.kind === 'place' && isPaintable(def);

        // A mouse's ghost follows the cursor: a left drag pans unless it paints.
        if (mouse && !paintable) {
            return 'none';
        }

        const g = tool.ghost;

        return tile.x >= g.x - 1 &&
            tile.x <= g.x + def.size.w &&
            tile.y >= g.y - 1 &&
            tile.y <= g.y + def.size.h
            ? 'ghost'
            : 'none';
    }

    if (tool.kind === 'line' && !mouse) {
        if (near(tile, tool.end, 1)) {
            return 'handle-end';
        }

        if (near(tile, tool.start, 1)) {
            return 'handle-start';
        }
    }

    if (tool.kind === 'bulldoze') {
        const building = ctl.game.buildingAt(tile.x, tile.y);

        if (building && ctl.game.roleOf(building) === 'road') {
            return 'road';
        }
    }

    return 'none';
}

function apply(ctl: Controller, effect: GestureEffect): void {
    const renderer = ctl.renderer;
    const tool = ctl.state.tool;

    switch (effect.type) {
        case 'pan':
            renderer.panBy(effect.dx, effect.dy);
            break;
        case 'orbit':
            renderer.rotateBy(-effect.dx * 0.008);
            renderer.tiltBy(effect.dy * 0.006);
            break;
        case 'pinch':
            renderer.zoomBy(effect.scale, effect.x, effect.y);
            renderer.rotateBy(effect.rotate);
            renderer.panBy(effect.dx, effect.dy);
            break;
        case 'hover': {
            const tile = ctl.tileAt(effect.x, effect.y);

            ctl.setHover(tile);

            if (tile && (tool.kind === 'place' || tool.kind === 'move')) {
                if (tool.kind !== 'place' || tool.paint.length <= 1) {
                    ctl.moveGhost(tile);
                }
            }

            break;
        }

        case 'tap': {
            const tile = ctl.tileAt(effect.x, effect.y);

            if (effect.mouse && effect.button === 2) {
                ctl.cancelTool();
                break;
            }

            if (tool.kind === 'select') {
                ctl.pickAt(effect.x, effect.y);
            } else if (tool.kind === 'place' || tool.kind === 'move') {
                if (!tile) {
                    break;
                }

                if (tool.kind === 'place' && tool.paint.length > 1) {
                    // A tap off a painted row starts over at the tap.
                    ctl.moveGhost(tile);
                    break;
                }

                ctl.moveGhost(tile);

                // Desktop: a click places it (ui-spec §6.1).
                if (effect.mouse) {
                    ctl.confirm();
                }
            } else if (tool.kind === 'line') {
                if (!tile) {
                    break;
                }

                if (!tool.start || tool.end) {
                    ctl.setLine(tile, null);
                } else {
                    ctl.setLine(tool.start, tile);
                }
            } else if (tool.kind === 'bulldoze') {
                ctl.bulldozePick(effect.x, effect.y);
            }

            break;
        }

        case 'ghost': {
            const tile = ctl.tileAt(effect.x, effect.y);

            if (tile) {
                ctl.moveGhost(tile, true);
            }

            break;
        }

        case 'line': {
            const tile = ctl.tileAt(effect.x, effect.y);

            if (!tile) {
                break;
            }

            if (tool.kind === 'bulldoze') {
                const from = ctl.tileAt(effect.fromX, effect.fromY);

                if (from) {
                    ctl.bulldozeRun(from, tile);
                }
            } else if (tool.kind === 'line') {
                if (effect.handle === 'start') {
                    ctl.setLine(tile, tool.end);
                } else if (effect.handle === 'end') {
                    ctl.setLine(tool.start, tile);
                } else {
                    ctl.setLine(
                        ctl.tileAt(effect.fromX, effect.fromY) ?? tile,
                        tile,
                    );
                }
            }

            break;
        }

        case 'paint-start':
            ctl.paintStart();
            break;
        case 'paint': {
            const tile = ctl.tileAt(effect.x, effect.y);

            if (tile) {
                ctl.paintTo(tile);
            }

            break;
        }

        case 'release':
            break;
    }
}

/** Pointer input on the canvas; returns the cleanup. */
export function attachCanvas(
    ctl: Controller,
    canvas: HTMLCanvasElement,
): () => void {
    let state = IDLE;
    let hold: number | null = null;

    const feed = (input: GestureInput) => {
        const result = gesture(state, input);

        state = result.state;

        for (const effect of result.effects) {
            apply(ctl, effect);
        }
    };
    const local = (event: PointerEvent | MouseEvent) => {
        const box = canvas.getBoundingClientRect();

        return { x: event.clientX - box.left, y: event.clientY - box.top };
    };
    const stopHold = () => {
        if (hold !== null) {
            window.clearTimeout(hold);
            hold = null;
        }
    };

    const onDown = (event: PointerEvent) => {
        ctl.audio?.unlock();
        ctl.closePopover();
        canvas.setPointerCapture?.(event.pointerId);

        const point = local(event);
        const mouse = event.pointerType === 'mouse';
        const tool = ctl.state.tool;

        feed({
            type: 'down',
            id: event.pointerId,
            x: point.x,
            y: point.y,
            button: event.button,
            hit: hitTest(ctl, point.x, point.y, mouse),
            mouse,
            draws: tool.kind === 'line',
            paintable:
                tool.kind === 'place' &&
                isPaintable(ctl.game.content.building(tool.type)),
        });
        stopHold();
        hold = window.setTimeout(() => {
            hold = null;
            feed({ type: 'hold' });
        }, HOLD_MS);
    };
    const onMove = (event: PointerEvent) => {
        const point = local(event);

        if (
            state.mode === 'press' &&
            Math.hypot(point.x - state.downX, point.y - state.downY) > 5
        ) {
            stopHold();
        }

        feed({ type: 'move', id: event.pointerId, x: point.x, y: point.y });
    };
    const onUp = (event: PointerEvent) => {
        const point = local(event);

        stopHold();
        feed({ type: 'up', id: event.pointerId, x: point.x, y: point.y });
    };
    const onCancel = (event: PointerEvent) => {
        stopHold();
        feed({ type: 'cancel', id: event.pointerId });
    };
    const onLeave = () => ctl.setHover(null);
    const onWheel = (event: WheelEvent) => {
        event.preventDefault();

        const point = local(event);

        ctl.renderer.zoomBy(
            Math.exp(-Math.sign(event.deltaY) * 0.12),
            point.x,
            point.y,
        );
    };
    const onContext = (event: MouseEvent) => event.preventDefault();

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContext);

    return () => {
        stopHold();
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onCancel);
        canvas.removeEventListener('pointerleave', onLeave);
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('contextmenu', onContext);
    };
}

function typing(target: EventTarget | null): boolean {
    return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
    );
}

/** The one window key listener; returns the cleanup. */
export function attachKeys(ctl: Controller): () => void {
    const onKeyDown = (event: KeyboardEvent) => {
        if (typing(event.target) || ctl.state.dialog) {
            return;
        }

        const pan = panKey(event.code);

        if (pan) {
            ctl.holdKey(pan, true);

            if (
                event.code.startsWith('Arrow') ||
                event.code.startsWith('Page')
            ) {
                event.preventDefault();
            }

            return;
        }

        if (event.key === 'Shift' && ctl.state.tool.kind === 'line') {
            ctl.toggleBend();

            return;
        }

        const action = keyAction(event);
        const onButton = event.target instanceof HTMLButtonElement;

        if (!action || event.repeat) {
            return;
        }

        switch (action) {
            case 'build':
                if (ctl.state.sheet === 'build') {
                    ctl.close();
                } else {
                    ctl.openBuild();
                }

                break;
            case 'upgrade':
                ctl.toggle('upgrade');
                break;
            case 'goals':
                ctl.toggle('goals');
                break;
            case 'city':
                ctl.toggle('city');
                break;
            case 'chronicle':
                ctl.toggle('chronicle');
                break;
            case 'research':
                if (
                    ctl.state.sheet === 'goals' &&
                    ctl.state.goalsTab === 'research'
                ) {
                    ctl.close();
                } else {
                    ctl.openGoals('research');
                }

                break;
            case 'layers':
                ctl.toggle('overlays');
                break;
            case 'bulldoze':
                ctl.toggleBulldoze();
                break;
            case 'move': {
                const uid = ctl.state.selection;

                if (uid !== null) {
                    ctl.startMove(uid);
                }

                break;
            }

            case 'rotate':
                break;
            case 'confirm':
                if (onButton || ctl.state.tool.kind === 'select') {
                    return;
                }

                event.preventDefault();
                ctl.confirm();
                break;
            case 'escape':
                if (ctl.escape()) {
                    event.preventDefault();
                }

                break;
            case 'pause':
                if (onButton) {
                    return;
                }

                event.preventDefault();
                ctl.togglePause();
                break;
            case 'speed1':
                ctl.setSpeed(1);
                break;
            case 'speed2':
                ctl.setSpeed(2);
                break;
            case 'speed5':
                ctl.setSpeed(5);
                break;
            case 'home':
                ctl.home();
                break;
            case 'zoomIn':
                ctl.zoom(1.2);
                break;
            case 'zoomOut':
                ctl.zoom(1 / 1.2);
                break;
        }
    };
    const onKeyUp = (event: KeyboardEvent) => {
        const pan = panKey(event.code);

        if (pan) {
            ctl.holdKey(pan, false);
        }
    };
    const onBlur = () => ctl.releaseKeys();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
    };
}
