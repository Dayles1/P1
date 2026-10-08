/**
 * What the player has done so far, for the character tab: creatures
 * beaten by kind, trees felled, rocks broken, things made, deaths. Saved
 * with the character.
 */

export type StatKey =
    | 'deer'
    | 'boar'
    | 'wolf'
    | 'zombie'
    | 'trees'
    | 'rocks'
    | 'crafted'
    | 'deaths';

export const STAT_KEYS: StatKey[] = [
    'deer',
    'boar',
    'wolf',
    'zombie',
    'trees',
    'rocks',
    'crafted',
    'deaths',
];

export type Stats = Record<StatKey, number>;

/** Saved counters, with anything missing or odd as zero. */
export function readStats(saved: unknown): Stats {
    const source = (saved ?? {}) as Partial<Record<string, unknown>>;

    return Object.fromEntries(
        STAT_KEYS.map((key) => {
            const value = source[key];

            return [
                key,
                Number.isInteger(value) && (value as number) > 0
                    ? (value as number)
                    : 0,
            ];
        }),
    ) as Stats;
}
