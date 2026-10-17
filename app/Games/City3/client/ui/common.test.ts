import { describe, expect, it } from 'vitest';
import {
    formatExact,
    formatNumber,
    formatRate,
    formatSigned,
    mixColor,
    plural,
    years,
} from './common';

describe('the number format (gdd §3.2)', () => {
    it('keeps three significant digits with Latin suffixes and a decimal comma', () => {
        for (const [value, text] of [
            [0, '0'],
            [28, '28'],
            [2.2, '2,2'],
            [0.4, '0,4'],
            [12.345, '12,3'],
            [999, '999'],
            [999.6, '1K'],
            [1000, '1K'],
            [1240, '1,24K'],
            [12_400, '12,4K'],
            [124_000, '124K'],
            [1_240_000, '1,24M'],
            [3_500_000, '3,5M'],
            [1_240_000_000, '1,24B'],
        ] as const) {
            expect(formatNumber(value)).toBe(text);
        }
    });

    it('writes negative values with a real minus sign', () => {
        expect(formatNumber(-1240)).toBe('−1,24K');
        expect(formatNumber(-0.0001)).toBe('0');
    });

    it('fits the money pill in six characters', () => {
        for (let exponent = 0; exponent < 15; exponent++) {
            for (const mantissa of [1, 1.234, 4.999, 9.995, 9.9999]) {
                const value = mantissa * 10 ** exponent;

                expect(formatNumber(value).length).toBeLessThanOrEqual(5);
                expect(formatNumber(-value).length).toBeLessThanOrEqual(6);
            }
        }
    });

    it('marks rates per year with their sign', () => {
        expect(formatRate(12_400)).toBe('+12,4K/год');
        expect(formatRate(0)).toBe('+0/год');
        expect(formatRate(-80)).toBe('−80/год');
    });

    it('writes exact values with thin spaces', () => {
        expect(formatExact(12_400)).toBe('12 400');
        expect(formatExact(1_234_567.4)).toBe('1 234 567');
        expect(formatExact(-999)).toBe('−999');
        expect(formatExact(7)).toBe('7');
    });
});

describe('the Chronicle words and colours', () => {
    it('signs the lead and counts years in Russian', () => {
        expect(formatSigned(1352.4)).toBe('+1 352');
        expect(formatSigned(-34)).toBe('−34');
        expect(formatSigned(0)).toBe('0');
        expect(
            [1, 2, 5, 11, 21, 22, 112].map((n) =>
                plural(n, 'год', 'года', 'лет'),
            ),
        ).toEqual(['год', 'года', 'лет', 'лет', 'год', 'года', 'лет']);
        expect(years(926)).toBe('926 лет');
    });

    it('blends the era accent', () => {
        expect(mixColor('#000000', '#ffffff', 0.5)).toBe('#808080');
        expect(mixColor('#c9d17a', '#e79a8e', 0)).toBe('#c9d17a');
        expect(mixColor('#c9d17a', '#e79a8e', 1)).toBe('#e79a8e');
        expect(mixColor('#c9d17a', '#e79a8e', 7)).toBe('#e79a8e');
    });
});
