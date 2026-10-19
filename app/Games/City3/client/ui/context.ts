/**
 * The controller for the component tree, and selector hooks over its
 * stores. A selector returns a primitive or a group the store keeps
 * stable, so a component re-renders only when what it shows changed.
 */

import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Game } from '../engine/sim/game';
import type { Controller } from './controller';
import type { FeedbackState } from './store/feedback';
import type { HudSnapshot } from './store/hud-store';
import type { UiState } from './store/ui-store';

export const ControllerContext = createContext<Controller | null>(null);

export function useCtl(): Controller {
    const ctl = useContext(ControllerContext);

    if (!ctl) {
        throw new Error('No game controller');
    }

    return ctl;
}

export function useGame(): Game {
    return useCtl().game;
}

export function useHud<T>(select: (snapshot: HudSnapshot) => T): T {
    const hud = useCtl().hud;

    return useSyncExternalStore(hud.subscribe, () => select(hud.getState()));
}

export function useUi<T>(select: (state: UiState) => T): T {
    const ui = useCtl().ui;

    return useSyncExternalStore(ui.subscribe, () => select(ui.getState()));
}

export function useFeedback<T>(select: (state: FeedbackState) => T): T {
    const feedback = useCtl().feedback;

    return useSyncExternalStore(feedback.subscribe, () =>
        select(feedback.getState()),
    );
}

/** Re-renders once a second (sheets with live numbers). */
export function useSecond(): number {
    return useHud((s) => s.second);
}
