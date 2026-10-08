/**
 * What the player carries: a fixed number of slots, each empty or one
 * stack of a single item. The first HOTBAR slots are the hotbar; the
 * selected one is what the character holds. Tools and armour keep their
 * wear (uses so far) and break when it reaches their durability. Besides
 * the slots, up to one piece of armour is worn on the head, body and
 * feet. Saved as the list of slots (empty ones null) and the worn pieces.
 */

import { ARMOR_SLOTS, isItem, ITEMS } from './items';
import type { ArmorSlot, ArtifactId, ItemId } from './items';

export const SLOTS = 24;
export const HOTBAR = 6;

export interface Stack {
    item: ItemId;
    count: number;
    /** Uses so far, for items with durability. */
    wear?: number;
}

export type Worn = Record<ArmorSlot, Stack | null>;

/** A saved stack, or null when it does not make sense. */
export function readStack(saved: unknown): Stack | null {
    const slot = saved as Partial<Stack> | null;

    if (
        !slot ||
        !isItem(slot.item) ||
        !Number.isInteger(slot.count) ||
        slot.count! < 1
    ) {
        return null;
    }

    const definition = ITEMS[slot.item];
    const stack: Stack = {
        item: slot.item,
        count: Math.min(slot.count!, definition.maxStack),
    };

    if (definition.durability) {
        stack.wear = Number.isInteger(slot.wear)
            ? Math.min(Math.max(0, slot.wear!), definition.durability - 1)
            : 0;
    }

    return stack;
}

/**
 * Puts as much of a stack as fits into a row of slots (a chest's):
 * topping up like stacks first, then the empty slots. A worn tool keeps
 * its wear. Answers how many went in.
 */
export function stash(slots: (Stack | null)[], stack: Stack): number {
    const max = ITEMS[stack.item].maxStack;
    let left = stack.count;

    if (!ITEMS[stack.item].durability) {
        for (const slot of slots) {
            if (left > 0 && slot?.item === stack.item && slot.count < max) {
                const moved = Math.min(left, max - slot.count);
                slot.count += moved;
                left -= moved;
            }
        }
    }

    for (let index = 0; index < slots.length && left > 0; index++) {
        if (slots[index] === null) {
            const moved = Math.min(left, max);
            slots[index] = { ...stack, count: moved };
            left -= moved;
        }
    }

    return stack.count - left;
}

/** 0…1 how much of a stack's durability is left (1 for things that do not wear). */
export function condition(stack: Stack): number {
    const durability = ITEMS[stack.item].durability;

    return durability ? 1 - (stack.wear ?? 0) / durability : 1;
}

export class Inventory {
    readonly slots: (Stack | null)[] = Array.from(
        { length: SLOTS },
        () => null,
    );
    readonly worn: Worn = { head: null, body: null, feet: null };
    selected = 0;
    onChange: () => void = () => {};

    /** Takes saved slots and worn armour, dropping anything that does not make sense. */
    load(saved: unknown, worn: unknown = null): void {
        this.slots.fill(null);

        if (Array.isArray(saved)) {
            saved.slice(0, SLOTS).forEach((slot, index) => {
                this.slots[index] = readStack(slot);
            });
        }

        for (const part of ARMOR_SLOTS) {
            const stack = readStack(
                (worn as Partial<Worn> | null)?.[part] ?? null,
            );
            this.worn[part] =
                stack && ITEMS[stack.item].armor?.slot === part ? stack : null;
        }

        this.onChange();
    }

    /** Armour points of everything worn. */
    get armor(): number {
        return ARMOR_SLOTS.reduce(
            (sum, part) =>
                sum +
                (this.worn[part]
                    ? ITEMS[this.worn[part].item].armor!.points
                    : 0),
            0,
        );
    }

    /**
     * Puts on the armour in a slot, taking off what was worn there into
     * that slot. False when it is not armour.
     */
    equip(index: number): boolean {
        const stack = this.slots[index];
        const part = stack ? ITEMS[stack.item].armor?.slot : undefined;

        if (!stack || !part) {
            return false;
        }

        this.slots[index] = this.worn[part];
        this.worn[part] = stack;
        this.onChange();

        return true;
    }

    /**
     * Takes off a worn piece into the given slot (or the first free one;
     * a slot holding armour of the same kind swaps). False when there is
     * no room.
     */
    unequip(part: ArmorSlot, index: number | null = null): boolean {
        const stack = this.worn[part];

        if (!stack) {
            return false;
        }

        const target = index ?? this.slots.indexOf(null);
        const there = target >= 0 ? this.slots[target] : undefined;

        if (
            there === undefined ||
            (there !== null && ITEMS[there.item].armor?.slot !== part)
        ) {
            return false;
        }

        this.worn[part] = there;
        this.slots[target] = stack;
        this.onChange();

        return true;
    }

    /**
     * Every worn piece takes one use from a blow. Answers what broke.
     */
    wearArmor(): ItemId[] {
        const broken: ItemId[] = [];

        for (const part of ARMOR_SLOTS) {
            const stack = this.worn[part];

            if (!stack) {
                continue;
            }

            stack.wear = (stack.wear ?? 0) + 1;

            if (stack.wear >= ITEMS[stack.item].durability!) {
                broken.push(stack.item);
                this.worn[part] = null;
            }
        }

        this.onChange();

        return broken;
    }

    /** The stack in the selected hotbar slot. */
    get held(): Stack | null {
        return this.slots[this.selected];
    }

    select(index: number): void {
        this.selected = Math.max(0, Math.min(HOTBAR - 1, index));
        this.onChange();
    }

    /** How many of `count` would fit. */
    room(item: ItemId, count: number): number {
        const max = ITEMS[item].maxStack;
        let room = 0;

        for (const slot of this.slots) {
            room +=
                slot === null ? max : slot.item === item ? max - slot.count : 0;

            if (room >= count) {
                return count;
            }
        }

        return room;
    }

    /** Adds as much as fits — topping up stacks first — and says how much. */
    add(item: ItemId, count: number): number {
        const definition = ITEMS[item];
        const max = definition.maxStack;
        let left = count;

        for (const slot of this.slots) {
            if (left > 0 && slot?.item === item && slot.count < max) {
                const moved = Math.min(left, max - slot.count);
                slot.count += moved;
                left -= moved;
            }
        }

        for (let index = 0; index < SLOTS && left > 0; index++) {
            if (this.slots[index] === null) {
                const moved = Math.min(left, max);
                this.slots[index] = definition.durability
                    ? { item, count: moved, wear: 0 }
                    : { item, count: moved };
                left -= moved;
            }
        }

        if (left < count) {
            this.onChange();
        }

        return count - left;
    }

    /**
     * Puts a whole stack in as it is — a worn tool keeps its wear —
     * topping up like stacks first. Answers how many went in.
     */
    put(stack: Stack): number {
        const moved = stash(this.slots, stack);

        if (moved > 0) {
            this.onChange();
        }

        return moved;
    }

    /** Takes up to `count` out of a slot. */
    take(index: number, count: number): Stack | null {
        const slot = this.slots[index];

        if (!slot) {
            return null;
        }

        const taken = Math.min(count, slot.count);
        slot.count -= taken;

        if (slot.count === 0) {
            this.slots[index] = null;
        }

        this.onChange();

        return { ...slot, count: taken };
    }

    /** Uses up `count` of an item from wherever it is (for crafting). */
    spend(item: ItemId, count: number): void {
        let left = count;

        for (let index = SLOTS - 1; index >= 0 && left > 0; index--) {
            const slot = this.slots[index];

            if (slot?.item === item) {
                const taken = Math.min(left, slot.count);
                slot.count -= taken;
                left -= taken;

                if (slot.count === 0) {
                    this.slots[index] = null;
                }
            }
        }

        this.onChange();
    }

    /**
     * One use of the held tool. Answers true when that broke it.
     */
    wearHeld(): boolean {
        const held = this.held;
        const durability = held ? ITEMS[held.item].durability : undefined;

        if (!held || !durability) {
            return false;
        }

        held.wear = (held.wear ?? 0) + 1;

        if (held.wear >= durability) {
            this.slots[this.selected] = null;
            this.onChange();

            return true;
        }

        this.onChange();

        return false;
    }

    /** Drags one slot onto another: merges the same item, else swaps. */
    move(from: number, to: number): void {
        const source = this.slots[from];
        const target = this.slots[to];

        if (from === to || !source) {
            return;
        }

        const max = ITEMS[source.item].maxStack;

        if (target && target.item === source.item && max > 1) {
            const moved = Math.min(source.count, max - target.count);
            target.count += moved;
            source.count -= moved;

            if (source.count === 0) {
                this.slots[from] = null;
            }
        } else {
            this.slots[to] = source;
            this.slots[from] = target;
        }

        this.onChange();
    }

    /**
     * Puts like items together, fullest stacks first — leaving the hotbar
     * as it is.
     */
    sort(): void {
        const loose = this.slots.slice(HOTBAR).filter((slot) => slot !== null);
        const totals = new Map<ItemId, number>();
        const tools: Stack[] = [];

        for (const slot of loose) {
            if (ITEMS[slot.item].durability) {
                tools.push(slot);
            } else {
                totals.set(
                    slot.item,
                    (totals.get(slot.item) ?? 0) + slot.count,
                );
            }
        }

        const sorted: Stack[] = [...tools];

        for (const item of Object.keys(ITEMS) as ItemId[]) {
            let left = totals.get(item) ?? 0;

            while (left > 0) {
                const count = Math.min(left, ITEMS[item].maxStack);
                sorted.push({ item, count });
                left -= count;
            }
        }

        for (let index = HOTBAR; index < SLOTS; index++) {
            this.slots[index] = sorted[index - HOTBAR] ?? null;
        }

        this.onChange();
    }

    total(item: ItemId): number {
        return this.slots.reduce(
            (sum, slot) => sum + (slot?.item === item ? slot.count : 0),
            0,
        );
    }

    has(artifact: ArtifactId): boolean {
        return this.total(artifact) > 0;
    }

    toJSON(): (Stack | null)[] {
        return this.slots.map((slot) => (slot ? { ...slot } : null));
    }

    wornJSON(): Worn {
        return {
            head: this.worn.head ? { ...this.worn.head } : null,
            body: this.worn.body ? { ...this.worn.body } : null,
            feet: this.worn.feet ? { ...this.worn.feet } : null,
        };
    }
}
