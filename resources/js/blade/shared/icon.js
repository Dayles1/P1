/**
 * The JS twin of <x-blade.u-i.icon>: markup for one symbol from the
 * sprite (resources/svg/icons.svg, inlined once per layout by
 * blade.sections.icons). Use this in every string template instead of a
 * Unicode glyph, so icons render the same everywhere and follow the text
 * color.
 *
 * @param {string} name  Symbol name without the `i-` prefix, e.g. 'bell'.
 * @param {{ size?: number, className?: string, label?: string|null }} [options]
 */
export function icon(name, { size = 20, className = '', label = null } = {}) {
    const classes = ['icon', className].filter(Boolean).join(' ');
    const a11y = label
        ? `role="img" aria-label="${label}"`
        : 'aria-hidden="true"';

    return `<svg class="${classes}" width="${size}" height="${size}" ${a11y}><use href="#i-${name}"></use></svg>`;
}
