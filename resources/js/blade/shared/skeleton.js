/**
 * Shared skeleton/empty-state markup helpers — formalizes the ad-hoc
 * `<div class="skeleton">`/`<div class="empty-state">` strings that used to
 * be hand-written per page, so every new list/card/panel gets the same
 * loading and empty treatment without duplicating HTML.
 */

/** A single skeleton block matching `.skeleton` (row/card/line, any height via `style`). */
export function skeletonBlock({
    height = 20,
    className = '',
    style = '',
} = {}) {
    return `<div class="skeleton ${className}" style="height:${height}px;${style}"></div>`;
}

/** `count` stacked skeleton rows — the common "list still loading" placeholder. */
export function skeletonRows(count = 3, { height = 56, gap = 8 } = {}) {
    return Array.from({ length: count })
        .map((_, index) =>
            skeletonBlock({
                height,
                className: 'skeleton-row',
                style: index < count - 1 ? `margin-bottom:${gap}px;` : '',
            }),
        )
        .join('');
}

/** Empty state block — `title` is required, `hint`/`actionHtml` are optional. */
export function emptyState(title, { hint = '', actionHtml = '' } = {}) {
    return `
        <div class="empty-state">
            <strong>${title}</strong>
            ${hint ? `<span>${hint}</span>` : ''}
            ${actionHtml}
        </div>
    `;
}
