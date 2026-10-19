/**
 * Interface state (ui-spec §11.1): the one open sheet, the tool, the
 * selection, the popover, the map layer, the build tab and the coach
 * counts. Small pure transitions live here so they can be tested; the
 * controller applies them.
 */

import type { TabId } from '../game/catalog';
import type { Side } from '../game/strips';
import { Store } from './store';

export type SheetId =
    | 'build'
    | 'inspect'
    | 'upgrade'
    | 'hall'
    | 'city'
    | 'goals'
    | 'chronicle'
    | 'strip'
    | 'overlays'
    | 'settings'
    | 'bureau'
    | 'whatsNew'
    | 'price';

export type PopoverId = 'speed' | 'menu' | 'quest' | 'alerts' | 'lead';

export type DialogId = 'conflict' | 'reset' | 'chest';

export type Layer = 'xray' | 'districts';

export type GoalsTab = 'era' | 'research' | 'tasks' | 'achievements';

export interface Tile {
    x: number;
    y: number;
}

export type Tool =
    | { kind: 'select' }
    | {
          kind: 'place';
          type: string;
          level: number;
          ghost: Tile | null;
          /** Painted row: footprints to build (homes, parks). */
          paint: readonly Tile[];
          /** Opened from the build tray: ✗ goes back to it. */
          fromTray: boolean;
      }
    | {
          kind: 'line';
          type: string;
          level: number;
          start: Tile | null;
          end: Tile | null;
          bend: 0 | 1;
      }
    | {
          kind: 'bulldoze';
          /** Picked buildings (one, or a run of road tiles). */
          picked: readonly number[];
      }
    | { kind: 'move'; uid: number; ghost: Tile | null };

export type ToolKind = Tool['kind'];

export interface UiState {
    sheet: SheetId | null;
    /** The 90 % detent of a phone bottom sheet. */
    expanded: boolean;
    tool: Tool;
    /** The inspected building. */
    selection: number | null;
    /** Other buildings under the last tap (cycled by tapping again). */
    stack: number;
    popover: PopoverId | null;
    dialog: DialogId | null;
    layer: Layer | null;
    buildTab: TabId;
    goalsTab: GoalsTab;
    strip: Side | null;
    price: { uid: number; level: number } | null;
    /** Times each coach chip was shown (first 3 uses of a tool). */
    coach: Readonly<Record<string, number>>;
    /** The advisor rule the player hid, until another fires. */
    advisorHidden: string | null;
    hints: boolean;
}

export const INITIAL_UI: UiState = {
    sheet: null,
    expanded: false,
    tool: { kind: 'select' },
    selection: null,
    stack: 0,
    popover: null,
    dialog: null,
    layer: null,
    buildTab: 'housing',
    goalsTab: 'era',
    strip: null,
    price: null,
    coach: {},
    advisorHidden: null,
    hints: true,
};

export class UiStore extends Store<UiState> {
    constructor(initial: Partial<UiState> = {}) {
        super({ ...INITIAL_UI, ...initial });
    }
}

/**
 * Esc (ui-spec §7.3): cancel the tool → close the sheet → close the
 * popover; null when there is nothing to close. Placement opened from the
 * tray goes back to it first (ui-spec §6.1 step 8).
 */
export function escape(state: UiState): Partial<UiState> | null {
    const tool = state.tool;

    if (tool.kind !== 'select') {
        return tool.kind === 'place' && tool.fromTray
            ? { tool: { kind: 'select' }, sheet: 'build', popover: null }
            : { tool: { kind: 'select' } };
    }

    if (state.sheet) {
        return {
            sheet: null,
            selection: state.sheet === 'inspect' ? null : state.selection,
            expanded: false,
        };
    }

    if (state.popover) {
        return { popover: null };
    }

    return null;
}

/** Opening a sheet replaces any other; the popover closes. */
export function openSheet(
    state: UiState,
    sheet: SheetId,
    extra: Partial<UiState> = {},
): Partial<UiState> {
    return {
        sheet,
        popover: null,
        expanded: false,
        selection: sheet === 'inspect' ? state.selection : null,
        ...extra,
    };
}

/** A sheet toggled from its thumb or shortcut. */
export function toggleSheet(state: UiState, sheet: SheetId): Partial<UiState> {
    return state.sheet === sheet && state.tool.kind === 'select'
        ? { sheet: null, expanded: false }
        : { ...openSheet(state, sheet), tool: { kind: 'select' } };
}
