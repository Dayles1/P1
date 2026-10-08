/**
 * An open chest: its slots above, the player's below. A tap on a stack
 * moves it across; the buttons move everything at once (the hotbar stays
 * as it is when putting things away).
 */

import { t } from '../i18n';
import { HOTBAR, stash } from '../inventory';
import type { Structure } from '../world/structures';
import { button, element } from './dom';
import type { MenuHost, TabView } from './menu';
import { stackHtml } from './slots';

export class ChestTab implements TabView {
    readonly element: HTMLElement;
    private chestGrid: HTMLElement;
    private bagGrid: HTMLElement;

    constructor(
        private host: MenuHost,
        private chest: () => Structure | null,
    ) {
        this.element = element('div', 'sb-chest');

        const top = element('section', 'sb-chest__part');
        const topBar = element('div', 'sb-bag__toolbar');
        topBar.append(
            element('h3', '', t.items.chest[0]),
            button(
                'sb-button sb-button--small',
                t.take_all,
                () => this.takeAll(),
                'take',
            ),
        );
        this.chestGrid = element('div', 'sb-grid');
        top.append(topBar, this.chestGrid);

        const bottom = element('section', 'sb-chest__part');
        const bottomBar = element('div', 'sb-bag__toolbar');
        bottomBar.append(
            element('h3', '', t.tabs.bag),
            button(
                'sb-button sb-button--small',
                t.put_all,
                () => this.putAll(),
                'drop',
            ),
        );
        this.bagGrid = element('div', 'sb-grid');
        bottom.append(bottomBar, this.bagGrid);

        this.element.append(top, bottom, element('p', 'sb-hint', t.chest_hint));
    }

    render(): void {
        const chest = this.chest();

        if (!chest?.items) {
            return;
        }

        this.chestGrid.replaceChildren(
            ...chest.items.map((stack, index) =>
                this.slot(stackHtml(stack), stack !== null, () =>
                    this.take(index),
                ),
            ),
        );
        this.bagGrid.replaceChildren(
            ...this.host.inventory.slots.map((stack, index) =>
                this.slot(
                    stackHtml(stack),
                    stack !== null,
                    () => this.put(index),
                    index < HOTBAR,
                ),
            ),
        );
    }

    private slot(
        html: string,
        filled: boolean,
        onTap: () => void,
        hotbar = false,
    ): HTMLElement {
        const slot = element(
            'button',
            `sb-slot${filled ? ' sb-slot--filled' : ''}${hotbar ? ' sb-slot--hotbar' : ''}`,
        );
        slot.type = 'button';
        slot.innerHTML = html;
        slot.addEventListener('click', onTap);

        return slot;
    }

    /** One chest stack into the bag, as much as fits. */
    private take(index: number): boolean {
        const items = this.chest()?.items;
        const stack = items?.[index];

        if (!items || !stack) {
            return true;
        }

        const moved = this.host.inventory.put(stack);
        stack.count -= moved;

        if (stack.count <= 0) {
            items[index] = null;
        }

        this.changed();

        return stack.count <= 0;
    }

    /** One bag stack into the chest, as much as fits. */
    private put(index: number): void {
        const items = this.chest()?.items;
        const stack = this.host.inventory.slots[index];

        if (!items || !stack) {
            return;
        }

        const moved = stash(items, stack);

        if (moved > 0) {
            this.host.inventory.take(index, moved);
        }

        this.changed();
    }

    private takeAll(): void {
        const items = this.chest()?.items ?? [];

        for (let index = 0; index < items.length; index++) {
            if (items[index] && !this.take(index)) {
                break;
            }
        }
    }

    private putAll(): void {
        for (
            let index = HOTBAR;
            index < this.host.inventory.slots.length;
            index++
        ) {
            this.put(index);
        }
    }

    private changed(): void {
        this.host.chestChanged();
        this.render();
    }
}
