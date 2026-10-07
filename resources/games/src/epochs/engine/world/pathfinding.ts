/**
 * A* over the tile grid for NPCs. Roads are cheap, open land costs by
 * biome speed, forests are slower, water and buildings are walls (except
 * the building being entered).
 */

import type { WorldMap } from './world-map';

export type Step = [number, number];

export interface PathOptions {
    isRoad: (index: number) => boolean;
    /** Tiles of buildings the walker may step onto (its home or workplace). */
    allowed?: Set<number>;
    maxNodes?: number;
}

class MinHeap {
    private items: { index: number; priority: number }[] = [];

    get size(): number {
        return this.items.length;
    }

    push(index: number, priority: number): void {
        const items = this.items;

        items.push({ index, priority });

        let i = items.length - 1;

        while (i > 0) {
            const parent = (i - 1) >> 1;

            if (items[parent].priority <= items[i].priority) {
                break;
            }

            [items[parent], items[i]] = [items[i], items[parent]];
            i = parent;
        }
    }

    pop(): number {
        const items = this.items;
        const top = items[0];
        const last = items.pop()!;

        if (items.length) {
            items[0] = last;

            let i = 0;

            for (;;) {
                const l = i * 2 + 1;
                const r = l + 1;
                let smallest = i;

                if (
                    l < items.length &&
                    items[l].priority < items[smallest].priority
                ) {
                    smallest = l;
                }

                if (
                    r < items.length &&
                    items[r].priority < items[smallest].priority
                ) {
                    smallest = r;
                }

                if (smallest === i) {
                    break;
                }

                [items[smallest], items[i]] = [items[i], items[smallest]];
                i = smallest;
            }
        }

        return top.index;
    }
}

export function stepCost(
    map: WorldMap,
    index: number,
    options: PathOptions,
): number {
    if (options.isRoad(index)) {
        return 0.4;
    }

    if (map.occupant[index] && !options.allowed?.has(index)) {
        return Infinity;
    }

    const biome = map.biomeOfIndex(index);

    if (!biome.walkable || biome.speed <= 0) {
        return Infinity;
    }

    const feature = map.feature[index];

    return 1 / biome.speed + (feature === 1 ? 0.8 : feature === 2 ? 2 : 0);
}

export function findPath(
    map: WorldMap,
    from: Step,
    to: Step,
    options: PathOptions,
): Step[] | null {
    const width = map.width;
    const start = map.index(from[0], from[1]);
    const goal = map.index(to[0], to[1]);
    const maxNodes = options.maxNodes ?? 6000;
    const cameFrom = new Map<number, number>();
    const cost = new Map<number, number>([[start, 0]]);
    const open = new MinHeap();
    const allowed = new Set(options.allowed ?? []);

    allowed.add(start);
    allowed.add(goal);
    open.push(start, 0);

    let expanded = 0;

    while (open.size && expanded++ < maxNodes) {
        const current = open.pop();

        if (current === goal) {
            const path: Step[] = [];
            let node: number | undefined = current;

            while (node !== undefined) {
                path.push([node % width, Math.floor(node / width)]);
                node = cameFrom.get(node);
            }

            return path.reverse();
        }

        const cx = current % width;
        const cy = Math.floor(current / width);

        for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ]) {
            const nx = cx + dx;
            const ny = cy + dy;

            if (!map.inBounds(nx, ny)) {
                continue;
            }

            const next = map.index(nx, ny);
            const step = stepCost(map, next, { ...options, allowed });

            if (!Number.isFinite(step)) {
                continue;
            }

            const total = cost.get(current)! + step;

            if (total < (cost.get(next) ?? Infinity)) {
                cost.set(next, total);
                cameFrom.set(next, current);
                open.push(
                    next,
                    total + (Math.abs(nx - to[0]) + Math.abs(ny - to[1])) * 0.4,
                );
            }
        }
    }

    return null;
}
