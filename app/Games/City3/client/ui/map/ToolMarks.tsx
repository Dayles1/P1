/**
 * Marks drawn over the scene for the tools (ui-spec §4.3, §6.2): four
 * ground arrows around the placement ghost (drag me), and the 44-px
 * vellum rings on a line's start and end (drag from here to draw).
 * Positioned from the frame loop.
 */

import { useRef } from 'react';
import { useCtl, useGame, useUi } from '../context';
import { useFrame } from '../store/frame';

const DIRECTIONS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
] as const;

export function ToolMarks() {
    const ctl = useCtl();
    const game = useGame();
    const tool = useUi((s) => s.tool);
    const arrows = useRef<(HTMLSpanElement | null)[]>([]);
    const start = useRef<HTMLSpanElement>(null);
    const end = useRef<HTMLSpanElement>(null);
    const ghost =
        (tool.kind === 'place' && tool.paint.length <= 1) ||
        tool.kind === 'move'
            ? tool.ghost
            : null;
    const type =
        tool.kind === 'place'
            ? tool.type
            : tool.kind === 'move'
              ? (game.buildings.get(tool.uid)?.type ?? null)
              : null;

    useFrame(() => {
        const renderer = ctl.renderer;

        if (ghost && type) {
            const { w, h } = game.content.building(type).size;
            const cx = ghost.x + w / 2;
            const cy = ghost.y + h / 2;
            const centre = renderer.worldToScreen(cx, cy, 0.05);

            DIRECTIONS.forEach(([dx, dy], index) => {
                const element = arrows.current[index];

                if (!element) {
                    return;
                }

                const at = renderer.worldToScreen(
                    cx + dx * (w / 2 + 0.55),
                    cy + dy * (h / 2 + 0.55),
                    0.05,
                );
                const angle = Math.atan2(at.y - centre.y, at.x - centre.x);

                element.style.display = at.visible ? '' : 'none';
                element.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px) rotate(${angle.toFixed(3)}rad)`;
            });
        }

        if (tool.kind === 'line') {
            for (const [element, tile] of [
                [start.current, tool.start],
                [end.current, tool.end],
            ] as const) {
                if (!element) {
                    continue;
                }

                if (!tile) {
                    element.style.display = 'none';
                    continue;
                }

                const at = renderer.worldToScreen(
                    tile.x + 0.5,
                    tile.y + 0.5,
                    0.05,
                );

                element.style.display = at.visible ? '' : 'none';
                element.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px)`;
            }
        }
    });

    if (!ghost && tool.kind !== 'line') {
        return null;
    }

    return (
        <div className="c3-marks" aria-hidden="true">
            {ghost &&
                DIRECTIONS.map((_, index) => (
                    <span
                        key={index}
                        className="c3-arrow"
                        ref={(element) => {
                            arrows.current[index] = element;
                        }}
                    />
                ))}
            {tool.kind === 'line' && (
                <>
                    <span
                        className="c3-handle"
                        ref={start}
                        style={{ display: 'none' }}
                    />
                    <span
                        className="c3-handle c3-handle--end"
                        ref={end}
                        style={{ display: 'none' }}
                    />
                </>
            )}
        </div>
    );
}
