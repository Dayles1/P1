/** Seeded randomness: the same seed always builds the same world. */

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
    let a = seed >>> 0;

    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** A stable number in [0, 1) for a pair of integers — for looks only. */
export function hash2(x: number, y: number, salt = 0): number {
    let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);

    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function pick<T>(rng: Rng, list: readonly T[]): T {
    return list[Math.floor(rng() * list.length)];
}

export function between(
    rng: Rng,
    [min, max]: readonly [number, number],
): number {
    return min + rng() * (max - min);
}

/** A key from a { key: weight } table. */
export function weighted(rng: Rng, table: Record<string, number>): string {
    const entries = Object.entries(table).filter(([, weight]) => weight > 0);
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = rng() * total;

    for (const [key, weight] of entries) {
        roll -= weight;

        if (roll <= 0) {
            return key;
        }
    }

    return entries.at(-1)?.[0] ?? '';
}
