/** How a stack looks in a slot, wherever slots are drawn. */

import { condition } from '../inventory';
import type { Stack } from '../inventory';
import { ITEMS } from '../items';

export function stackHtml(stack: Stack | null): string {
    if (!stack) {
        return '';
    }

    const definition = ITEMS[stack.item];
    let html = `<span class="sb-icon">${definition.icon}</span>`;

    if (stack.count > 1) {
        html += `<span class="sb-slot__count">${stack.count}</span>`;
    }

    if (definition.durability) {
        const left = condition(stack);
        html += `<span class="sb-wear${left < 0.25 ? ' sb-wear--low' : ''}"><span style="width:${Math.round(left * 100)}%"></span></span>`;
    }

    return html;
}
