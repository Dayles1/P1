/** Small helpers for building the game's HTML. */

import { ICONS } from './icons';
import type { IconName } from './icons';

export function element<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string,
    text = '',
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;

    return node;
}

/** A line icon in a span. */
export function icon(name: IconName, className = 'sb-ui-icon'): HTMLElement {
    const node = element('span', className);
    node.innerHTML = ICONS[name];

    return node;
}

/** A plain button: an optional icon and a label. */
export function button(
    className: string,
    label: string,
    onClick: () => void,
    iconName?: IconName,
): HTMLButtonElement {
    const node = element('button', className);
    node.type = 'button';

    if (iconName) {
        node.append(icon(iconName));
    }

    if (label) {
        node.append(element('span', '', label));
    }

    node.addEventListener('click', (event) => {
        event.stopPropagation();
        onClick();
    });

    return node;
}

/** Escapes text for use inside innerHTML. */
export function escape(text: string): string {
    return text.replace(
        /[&<>"']/g,
        (char) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[char]!,
    );
}
