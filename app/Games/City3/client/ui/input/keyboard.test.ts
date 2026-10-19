import { describe, expect, it } from 'vitest';
import { escape, INITIAL_UI } from '../store/ui-store';
import type { UiState } from '../store/ui-store';
import { keyAction, panKey } from './keyboard';

describe('shortcuts (ui-spec §7.3)', () => {
    it('maps the letters by physical key, so the Russian layout works', () => {
        expect(keyAction({ code: 'KeyB', key: 'и' })).toBe('build');
        expect(keyAction({ code: 'KeyU', key: 'г' })).toBe('upgrade');
        expect(keyAction({ code: 'KeyG', key: 'п' })).toBe('goals');
        expect(keyAction({ code: 'KeyC', key: 'с' })).toBe('city');
        expect(keyAction({ code: 'KeyH', key: 'р' })).toBe('chronicle');
        expect(keyAction({ code: 'KeyT', key: 'е' })).toBe('research');
        expect(keyAction({ code: 'KeyL', key: 'д' })).toBe('layers');
        expect(keyAction({ code: 'KeyX', key: 'ч' })).toBe('bulldoze');
        expect(keyAction({ code: 'KeyM', key: 'ь' })).toBe('move');
        expect(keyAction({ code: 'KeyR', key: 'к' })).toBe('rotate');
    });

    it('falls back to the typed Russian letter without a code', () => {
        expect(keyAction({ key: 'И' })).toBe('build');
        expect(keyAction({ key: 'ч' })).toBe('bulldoze');
    });

    it('maps speed, pause, confirm and leaves modified keys alone', () => {
        expect(keyAction({ code: 'Space', key: ' ' })).toBe('pause');
        expect(keyAction({ code: 'Digit3', key: '3' })).toBe('speed5');
        expect(keyAction({ code: 'Enter', key: 'Enter' })).toBe('confirm');
        expect(keyAction({ code: 'KeyC', key: 'c', ctrlKey: true })).toBeNull();
        expect(panKey('KeyW')).toBe('up');
        expect(panKey('KeyB')).toBeNull();
    });
});

describe('Esc order: tool → sheet → popover', () => {
    const base: UiState = {
        ...INITIAL_UI,
        sheet: 'city',
        popover: 'menu',
        tool: { kind: 'bulldoze', picked: [] },
    };

    it('cancels the tool first', () => {
        expect(escape(base)).toEqual({ tool: { kind: 'select' } });
    });

    it('then closes the sheet, then the popover, then nothing', () => {
        const noTool = { ...base, tool: { kind: 'select' } as const };

        expect(escape(noTool)).toMatchObject({ sheet: null });
        expect(escape({ ...noTool, sheet: null })).toEqual({ popover: null });
        expect(escape({ ...noTool, sheet: null, popover: null })).toBeNull();
    });

    it('takes placement opened from the tray back to the tray', () => {
        expect(
            escape({
                ...INITIAL_UI,
                tool: {
                    kind: 'place',
                    type: 'house',
                    level: 1,
                    ghost: null,
                    paint: [],
                    fromTray: true,
                },
            }),
        ).toMatchObject({ sheet: 'build', tool: { kind: 'select' } });
    });

    it('drops the selection when the inspector closes', () => {
        expect(
            escape({ ...INITIAL_UI, sheet: 'inspect', selection: 12 }),
        ).toMatchObject({ sheet: null, selection: null });
    });
});
