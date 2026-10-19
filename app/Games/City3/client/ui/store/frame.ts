/**
 * Per-frame imperative work (ui-spec §10): the year ring, plaque and
 * handle positions are written to DOM refs from the frame loop, never
 * through React state.
 */

import { useEffect, useEffectEvent } from 'react';

type FrameCallback = (dt: number) => void;

const callbacks = new Set<FrameCallback>();

/** Called by the game loop once per animation frame. */
export function runFrame(dt: number): void {
    for (const callback of callbacks) {
        callback(dt);
    }
}

/** Runs `callback` every frame while the component is mounted. */
export function useFrame(callback: FrameCallback): void {
    const onFrame = useEffectEvent(callback);

    useEffect(() => {
        const run = (dt: number) => onFrame(dt);

        callbacks.add(run);

        return () => {
            callbacks.delete(run);
        };
    }, []);
}
