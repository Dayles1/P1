/**
 * What the player has learnt: knowledge points and the recipes
 * researched. Knowledge comes from studying old notes and relic shards
 * (dug out at excavations, dropped by the dead) and from taking things
 * apart; a recipe marked `research` costs that many points to learn.
 * Taking apart a thing whose recipe is not known yet teaches it outright.
 *
 * Saved with the character as `{points, known}`.
 */

import { isItem } from './items';
import type { ItemId } from './items';
import { recipeFor } from './recipes';

export interface SavedResearch {
    points: number;
    known: ItemId[];
}

export class Research {
    points = 0;
    private known = new Set<ItemId>();

    /**
     * Takes what was saved. A character from before research learns every
     * recipe of what it already carries, wears or keeps in its chests, so
     * nobody loses what they could make.
     */
    load(saved: unknown, owned: Iterable<ItemId> = []): void {
        const source = saved as Partial<SavedResearch> | null;

        if (!source) {
            for (const item of owned) {
                if (recipeFor(item)?.research) {
                    this.known.add(item);
                }
            }

            return;
        }

        this.points = Math.max(0, Math.floor(Number(source.points) || 0));

        for (const item of Array.isArray(source.known) ? source.known : []) {
            if (isItem(item)) {
                this.known.add(item);
            }
        }
    }

    /** Whether the item's recipe can be used: learnt, or never needed learning. */
    knows(item: ItemId): boolean {
        return !recipeFor(item)?.research || this.known.has(item);
    }

    /** Learns a recipe for its knowledge points; false when there are not enough. */
    study(item: ItemId): boolean {
        const cost = recipeFor(item)?.research ?? 0;

        if (this.knows(item) || this.points < cost) {
            return false;
        }

        this.points -= cost;
        this.known.add(item);

        return true;
    }

    /** Learns a recipe for free (by taking a thing apart); false if already known. */
    learn(item: ItemId): boolean {
        if (this.knows(item)) {
            return false;
        }

        this.known.add(item);

        return true;
    }

    add(points: number): void {
        this.points += Math.max(0, Math.round(points));
    }

    toJSON(): SavedResearch {
        return { points: this.points, known: [...this.known] };
    }
}
