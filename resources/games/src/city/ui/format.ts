import { RESOURCES } from '../engine/data';
import type { Cost, Resource } from '../engine/data';

export function compact(value: number): string {
    const n = Math.floor(value);

    if (Math.abs(n) < 1000) {
        return String(n);
    }

    if (Math.abs(n) < 1_000_000) {
        return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
    }

    return `${(n / 1_000_000).toFixed(1)}M`;
}

/** A per-second rate shown per minute: "+42/мин". */
export function perMinute(rate: number): string {
    const value = rate * 60;
    const abs = Math.abs(value);
    const text =
        abs >= 1000
            ? compact(abs)
            : abs >= 10
              ? String(Math.round(abs))
              : String(Math.round(abs * 10) / 10);

    return `${value >= 0 ? '+' : '−'}${text}/мин`;
}

export function costEntries(
    cost: Cost,
): { id: Resource; icon: string; amount: number }[] {
    return RESOURCES.filter((r) => cost[r.id]).map((r) => ({
        id: r.id,
        icon: r.icon,
        amount: Math.ceil(cost[r.id] ?? 0),
    }));
}

export function happinessFace(value: number): string {
    if (value >= 80) {
        return '😄';
    }

    if (value >= 60) {
        return '🙂';
    }

    if (value >= 40) {
        return '😐';
    }

    if (value >= 25) {
        return '🙁';
    }

    return '😠';
}
