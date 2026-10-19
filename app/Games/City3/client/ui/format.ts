/**
 * The one number format of the game (gdd §3.2) and the small text helpers
 * every surface shares: compact HUD numbers, exact sheet numbers with thin
 * spaces, yearly rates, the real minus sign, Russian plurals, the era
 * accent blend.
 */

const SUFFIXES = ['', 'K', 'M', 'B', 'T'];

/** U+2212, the minus every negative number is written with. */
export const MINUS = '−';

/** U+00A0, between a number and its unit (71 %). */
export const NBSP = ' ';

/** U+2009, the thousands separator of exact numbers. */
export const THIN_SPACE = ' ';

/**
 * Three significant digits with Latin suffixes and a decimal comma: 999,
 * 1,24K, 12,4K, 124K, 1,24M, 1,24B; negative values with a real minus.
 */
export function formatNumber(value: number): string {
    if (!Number.isFinite(value)) {
        return '∞';
    }

    const sign = value < 0 ? MINUS : '';
    let abs = Math.abs(value);
    let tier = 0;
    let rounded = Number(abs.toPrecision(3));

    while (rounded >= 1000 && tier < SUFFIXES.length - 1) {
        abs /= 1000;
        tier++;
        rounded = Number(abs.toPrecision(3));
    }

    if (tier === 0) {
        rounded = Math.round(rounded * 100) / 100;
    }

    if (rounded === 0) {
        return '0';
    }

    return `${sign}${String(rounded).replace('.', ',')}${SUFFIXES[tier]}`;
}

/** A yearly rate: +12,4K/год, −80/год. */
export function formatRate(perYear: number): string {
    return `${perYear < 0 ? '' : '+'}${formatNumber(perYear)}/год`;
}

/** An exact whole number for labels and sheets: 12 400 (thin spaces). */
export function formatExact(value: number): string {
    if (!Number.isFinite(value)) {
        return '∞';
    }

    const digits = String(Math.round(Math.abs(value))).replace(
        /\B(?=(\d{3})+(?!\d))/g,
        THIN_SPACE,
    );

    return `${value < 0 && Math.round(value) !== 0 ? MINUS : ''}${digits}`;
}

/** A signed whole number with thin spaces: +1 352, −34, 0. */
export function formatSigned(value: number): string {
    const rounded = Math.round(value);

    return `${rounded > 0 ? '+' : ''}${formatExact(rounded)}`;
}

/** «71 %» with a no-break space. */
export function formatPercent(share: number): string {
    return `${Math.round(share * 100)}${NBSP}%`;
}

/** Russian plural: 1 год, 2 года, 5 лет. */
export function plural(
    count: number,
    one: string,
    few: string,
    many: string,
): string {
    const n = Math.abs(Math.round(count)) % 100;
    const last = n % 10;

    if (n > 10 && n < 20) {
        return many;
    }

    return last === 1 ? one : last >= 2 && last <= 4 ? few : many;
}

/** «12 лет», «1 год». */
export function years(count: number): string {
    return `${formatExact(count)} ${plural(count, 'год', 'года', 'лет')}`;
}

/** Two #rrggbb colours mixed: 0 = the first, 1 = the second. */
export function mixColor(from: string, to: string, share: number): string {
    const parse = (hex: string) =>
        [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) || 0);
    const a = parse(from);
    const b = parse(to);
    const t = Math.max(0, Math.min(1, share));

    return `#${a
        .map((value, i) =>
            Math.round(value + (b[i] - value) * t)
                .toString(16)
                .padStart(2, '0'),
        )
        .join('')}`;
}

/** Engine texts still carry emoji; the chrome shows none (ui-spec §3.7). */
export function stripEmoji(text: string): string {
    return text
        .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}
