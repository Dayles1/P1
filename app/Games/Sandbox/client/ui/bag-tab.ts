/**
 * The inventory tab: what is worn (head, body, feet) on the left, the
 * slots in the middle (the top row is the hotbar), and what the chosen
 * item is on the right — with buttons to eat it, put it on or take it
 * off, and drop some.
 *
 * Drag a stack onto another slot to move, merge or swap it; drag armour
 * onto its place on the body to put it on, or off the body to take it
 * off. A tap just picks the item, which is all a phone needs.
 */

import { t } from '../i18n';
import { HOTBAR, SLOTS } from '../inventory';
import { ARMOR_SLOTS, ITEMS } from '../items';
import type { ArmorSlot } from '../items';
import { throughArmor } from '../player/vitals';
import { button, element, escape, icon } from './dom';
import type { MenuHost, TabView } from './menu';
import { stackHtml } from './slots';

type Pick = { kind: 'slot'; index: number } | { kind: 'worn'; part: ArmorSlot };

const SILHOUETTES: Record<ArmorSlot, string> = {
    head: '<svg viewBox="0 0 32 32"><path d="M6 20c0-7.5 4.5-13 10-13s10 5.5 10 13z" fill="currentColor"/></svg>',
    body: '<svg viewBox="0 0 32 32"><path d="M10 5 4 10.5l3.2 5.2 2.8-2V27h12V13.7l2.8 2 3.2-5.2L22 5c-1 2.2-3.2 3.4-6 3.4S11 7.2 10 5z" fill="currentColor"/></svg>',
    feet: '<svg viewBox="0 0 32 32"><path d="M7 5h8v14l9.5 3.2c1.6.5 2.5 1.6 2.5 3V27H7z" fill="currentColor"/></svg>',
};

export class BagTab implements TabView {
    readonly element: HTMLElement;
    private slots: HTMLElement[] = [];
    private worn = new Map<ArmorSlot, HTMLElement>();
    private armorLine: HTMLElement;
    private details: HTMLElement;
    private picked: Pick | null = null;
    private drag: { from: Pick; ghost: HTMLElement; moved: boolean } | null =
        null;

    constructor(private host: MenuHost) {
        this.element = element('div', 'sb-bag');

        const worn = element('section', 'sb-bag__worn');
        worn.append(element('h3', '', t.equipment));

        for (const part of ARMOR_SLOTS) {
            const slot = element('div', 'sb-slot sb-slot--worn');
            slot.dataset.worn = part;
            slot.title = t.armor_slots[part];
            slot.addEventListener('pointerdown', (event) =>
                this.startDrag(event, { kind: 'worn', part }),
            );
            this.worn.set(part, slot);
            const label = element('div', 'sb-worn');
            label.append(slot, element('small', '', t.armor_slots[part]));
            worn.append(label);
        }

        this.armorLine = element('p', 'sb-bag__armor');
        worn.append(this.armorLine);

        const main = element('section', 'sb-bag__main');
        const toolbar = element('div', 'sb-bag__toolbar');
        toolbar.append(
            element('p', 'sb-hint', t.inventory_hint),
            button(
                'sb-button sb-button--small',
                t.sort,
                () => host.inventory.sort(),
                'sort',
            ),
        );
        const grid = element('div', 'sb-grid');

        for (let index = 0; index < SLOTS; index++) {
            const slot = element(
                'div',
                `sb-slot${index < HOTBAR ? ' sb-slot--hotbar' : ''}`,
            );
            slot.dataset.slot = String(index);
            slot.addEventListener('pointerdown', (event) =>
                this.startDrag(event, { kind: 'slot', index }),
            );
            this.slots.push(slot);
            grid.append(slot);
        }

        main.append(toolbar, grid);

        this.details = element('section', 'sb-details');
        this.element.append(worn, main, this.details);

        window.addEventListener('pointermove', this.moveDrag);
        window.addEventListener('pointerup', this.endDrag);
        window.addEventListener('pointercancel', () => this.cancelDrag());
    }

    render(): void {
        const inventory = this.host.inventory;

        inventory.slots.forEach((stack, index) => {
            const slot = this.slots[index];
            slot.classList.toggle(
                'sb-slot--picked',
                this.picked?.kind === 'slot' && this.picked.index === index,
            );
            slot.classList.toggle('sb-slot--filled', stack !== null);
            slot.classList.toggle(
                'sb-slot--held',
                index === inventory.selected,
            );
            slot.title = stack ? t.items[stack.item][0] : '';
            slot.innerHTML = stackHtml(stack);
        });

        for (const part of ARMOR_SLOTS) {
            const slot = this.worn.get(part)!;
            const stack = inventory.worn[part];
            slot.classList.toggle('sb-slot--filled', stack !== null);
            slot.classList.toggle(
                'sb-slot--picked',
                this.picked?.kind === 'worn' && this.picked.part === part,
            );
            slot.innerHTML = stack
                ? stackHtml(stack)
                : `<span class="sb-silhouette">${SILHOUETTES[part]}</span>`;
        }

        const armor = inventory.armor;
        this.armorLine.innerHTML = '';
        this.armorLine.append(
            icon('shield'),
            element(
                'span',
                '',
                `${armor} · ${Math.round((1 - throughArmor(armor)) * 100)}% ${t.armor_blocks}`,
            ),
        );

        this.renderDetails();
    }

    private stackOf(pick: Pick | null) {
        if (!pick) {
            return null;
        }

        return pick.kind === 'slot'
            ? this.host.inventory.slots[pick.index]
            : this.host.inventory.worn[pick.part];
    }

    private renderDetails(): void {
        const stack = this.stackOf(this.picked);
        const picked = this.picked;

        if (!stack || !picked) {
            this.details.innerHTML = `<p class="sb-details__empty">${escape(t.empty_slot)}</p>`;

            return;
        }

        const definition = ITEMS[stack.item];
        const [name, description] = t.items[stack.item];
        const facts: string[] = [];

        if (definition.durability) {
            facts.push(
                `${t.durability}: ${definition.durability - (stack.wear ?? 0)} / ${definition.durability}`,
            );
        }

        if (definition.armor) {
            facts.push(
                `${t.armor}: +${definition.armor.points} · ${t.armor_slots[definition.armor.slot]}`,
            );
        }

        if (definition.heals) {
            facts.push(`${t.health}: +${definition.heals}`);
        }

        this.details.innerHTML = `
            <div class="sb-details__head">
                <span class="sb-icon sb-icon--large">${definition.icon}</span>
                <strong>${escape(name)}${stack.count > 1 ? ` × ${stack.count}` : ''}</strong>
            </div>
            <p>${escape(description)}</p>
            ${facts.map((fact) => `<p class="sb-details__fact">${escape(fact)}</p>`).join('')}`;

        const actions = element('div', 'sb-details__actions');

        if (picked.kind === 'worn') {
            actions.append(
                button(
                    'sb-button sb-button--primary',
                    t.unequip,
                    () => {
                        this.host.unequip(picked.part, null);
                        this.picked = null;
                        this.render();
                    },
                    'take',
                ),
            );
        } else {
            const index = picked.index;

            if (definition.heals) {
                actions.append(
                    button(
                        'sb-button sb-button--primary',
                        stack.item === 'bandage' ? t.bandage_up : t.eat,
                        () => this.host.consume(index),
                        'eat',
                    ),
                );
            }

            if (definition.armor) {
                actions.append(
                    button(
                        'sb-button sb-button--primary',
                        t.equip,
                        () => {
                            this.host.equip(index);
                            this.picked = {
                                kind: 'worn',
                                part: definition.armor!.slot,
                            };
                            this.render();
                        },
                        'shield',
                    ),
                );
            }

            actions.append(
                button(
                    'sb-button',
                    t.drop_one,
                    () => this.host.drop(index, 1),
                    'drop',
                ),
            );

            if (stack.count > 1) {
                actions.append(
                    button('sb-button', t.drop_all, () =>
                        this.host.drop(index, stack.count),
                    ),
                );
            }
        }

        this.details.append(actions);
    }

    private startDrag(event: PointerEvent, from: Pick): void {
        if (event.button !== 0) {
            return;
        }

        this.picked = from;
        this.render();

        if (!this.stackOf(from)) {
            return;
        }

        const source =
            from.kind === 'slot'
                ? this.slots[from.index]
                : this.worn.get(from.part)!;
        const ghost = element('div', 'sb-slot sb-slot--ghost');
        ghost.innerHTML = source.innerHTML;
        ghost.hidden = true;
        document.body.append(ghost);
        this.drag = { from, ghost, moved: false };
        event.preventDefault();
    }

    private moveDrag = (event: PointerEvent): void => {
        if (!this.drag) {
            return;
        }

        this.drag.moved = true;
        this.drag.ghost.hidden = false;
        this.drag.ghost.style.left = `${event.clientX}px`;
        this.drag.ghost.style.top = `${event.clientY}px`;
    };

    private endDrag = (event: PointerEvent): void => {
        if (!this.drag) {
            return;
        }

        const { from, moved } = this.drag;
        this.cancelDrag();

        if (!moved) {
            return;
        }

        const target = document
            .elementsFromPoint(event.clientX, event.clientY)
            .find(
                (node) =>
                    node instanceof HTMLElement &&
                    (node.dataset.slot !== undefined ||
                        node.dataset.worn !== undefined),
            ) as HTMLElement | undefined;

        if (!target) {
            return;
        }

        const inventory = this.host.inventory;

        if (target.dataset.slot !== undefined) {
            const to = Number(target.dataset.slot);

            if (from.kind === 'slot') {
                inventory.move(from.index, to);
            } else {
                this.host.unequip(from.part, to);
            }

            this.picked = { kind: 'slot', index: to };
        } else if (from.kind === 'slot') {
            const part = target.dataset.worn as ArmorSlot;
            const stack = inventory.slots[from.index];

            if (stack && ITEMS[stack.item].armor?.slot === part) {
                this.host.equip(from.index);
                this.picked = { kind: 'worn', part };
            }
        }

        this.render();
    };

    private cancelDrag(): void {
        this.drag?.ghost.remove();
        this.drag = null;
    }
}
