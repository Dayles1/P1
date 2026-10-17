import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { Game } from '../engine/sim/game';
import { leadText, racePosition, starStrip } from './chronicle';

const { content } = loadContent();
const HISTORY = [0, 1000, 1500, 1800, 1900, 2000, 2100];

describe('the race line (ui-spec §5.1)', () => {
    it('maps a year into six equal era segments', () => {
        expect(racePosition(0, HISTORY)).toBe(0);
        expect(racePosition(500, HISTORY)).toBe(0.5);
        expect(racePosition(1250, HISTORY)).toBe(1.5);
        expect(racePosition(1850, HISTORY)).toBe(3.5);
        expect(racePosition(2100, HISTORY)).toBe(6);
        expect(racePosition(2500, HISTORY)).toBe(6);
    });

    it('draws stars as a strip of three', () => {
        expect(starStrip(0)).toBe('☆☆☆');
        expect(starStrip(2)).toBe('★★☆');
    });
});

describe('the lead tooltip (gdd §2.3)', () => {
    it('says how far ahead the city is and like which year of Europe', () => {
        const game = Game.create(content, 7);
        const text = leadText(game);

        expect(text).toMatch(/^Опережение истории: \+\d+/);
        expect(text).toContain('Ваш город — как Европа');
        expect(text).toContain('до эпохи «Средневековье»');
    });

    it('says history is catching up once the city is behind', () => {
        const game = Game.create(content, 7);

        for (let i = 0; i < 6; i++) {
            game.testerNextEpoch();
        }

        game.state.time = 2134 * 25;
        expect(leadText(game)).toBe(
            'История догоняет: город на 34 года позади.',
        );
    });
});
