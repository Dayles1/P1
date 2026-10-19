/**
 * A minimal external store for useSyncExternalStore: a state object that
 * is replaced, never mutated, and a set of listeners told after each
 * replacement. Selectors read primitives or sub-objects whose identity
 * only changes when their contents do, so components re-render only when
 * what they show changed (ui-spec §10).
 */
export class Store<S extends object> {
    private state: S;
    private listeners = new Set<() => void>();

    constructor(initial: S) {
        this.state = initial;
    }

    getState = (): S => this.state;

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    };

    /** Replaces the fields given; listeners hear only of a real change. */
    set(patch: Partial<S>): void {
        let changed = false;

        for (const key of Object.keys(patch) as (keyof S)[]) {
            if (!Object.is(this.state[key], patch[key])) {
                changed = true;
                break;
            }
        }

        if (!changed) {
            return;
        }

        this.state = { ...this.state, ...patch };
        this.emit();
    }

    /** Applies an updater to the whole state. */
    update(updater: (state: S) => Partial<S> | null): void {
        const patch = updater(this.state);

        if (patch) {
            this.set(patch);
        }
    }

    private emit(): void {
        for (const listener of [...this.listeners]) {
            listener();
        }
    }
}

/** Shallow equality of two plain objects or arrays. */
export function shallowEqual(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) {
        return true;
    }

    if (
        typeof a !== 'object' ||
        typeof b !== 'object' ||
        a === null ||
        b === null
    ) {
        return false;
    }

    if (Array.isArray(a) !== Array.isArray(b)) {
        return false;
    }

    const ka = Object.keys(a);
    const kb = Object.keys(b);

    if (ka.length !== kb.length) {
        return false;
    }

    return ka.every((key) =>
        Object.is(
            (a as Record<string, unknown>)[key],
            (b as Record<string, unknown>)[key],
        ),
    );
}

/** `next` when it differs shallowly from `prev`, else `prev` (keeps identity). */
export function keep<T>(prev: T, next: T): T {
    return shallowEqual(prev, next) ? prev : next;
}

/** A list whose items are compared shallowly, one by one. */
export function keepList<T>(
    prev: readonly T[],
    next: readonly T[],
): readonly T[] {
    if (
        prev.length === next.length &&
        prev.every((item, index) => shallowEqual(item, next[index]))
    ) {
        return prev;
    }

    return next;
}
