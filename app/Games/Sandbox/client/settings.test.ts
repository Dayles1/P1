import { describe, expect, it } from 'vitest';
import { BODY_STYLES, loadSettings } from './settings';

describe('settings', () => {
    it('draws the hero as the Sci-Fi Girl unless the player chose otherwise', () => {
        // In Node there is no localStorage: what a new player gets.
        expect(loadSettings().bodyStyle).toBe('scifi');
        expect(BODY_STYLES[0]).toBe('scifi');
    });
});
