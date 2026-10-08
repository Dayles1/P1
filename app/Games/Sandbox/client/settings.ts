/**
 * The player's own settings for this browser: graphics quality, camera
 * sensitivity, volume and the FPS counter. Kept in localStorage — they
 * belong to the device, not the character.
 */

export type Quality = 'auto' | 'low' | 'medium' | 'high';

export const QUALITIES: Quality[] = ['auto', 'low', 'medium', 'high'];

export interface Settings {
    quality: Quality;
    /** Multiplies how fast the camera turns, 0.4…2. */
    sensitivity: number;
    /** 0…1. */
    volume: number;
    showFps: boolean;
}

const KEY = 'sandbox-settings';

const DEFAULTS: Settings = {
    quality: 'auto',
    sensitivity: 1,
    volume: 0.8,
    showFps: false,
};

export function loadSettings(): Settings {
    try {
        const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');

        return {
            quality: QUALITIES.includes(saved.quality)
                ? saved.quality
                : DEFAULTS.quality,
            sensitivity: clampNumber(saved.sensitivity, 0.4, 2, 1),
            volume: clampNumber(saved.volume, 0, 1, DEFAULTS.volume),
            showFps: saved.showFps === true,
        };
    } catch {
        return { ...DEFAULTS };
    }
}

export function saveSettings(settings: Settings): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
        // Not remembered — fine.
    }
}

function clampNumber(
    value: unknown,
    min: number,
    max: number,
    fallback: number,
): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(max, Math.max(min, value))
        : fallback;
}
