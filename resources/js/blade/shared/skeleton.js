import { t } from './i18n';
import { icon } from './icon';

/**
 * Shared skeleton/empty-state markup helpers — formalizes the ad-hoc
 * `<div class="skeleton">`/`<div class="empty-state">` strings that used to
 * be hand-written per page, so every new list/card/panel gets the same
 * loading and empty treatment without duplicating HTML.
 */

/**
 * A single skeleton block matching `.skeleton`. Size comes from a class
 * (`skeleton-row`, `skeleton--card`, `skeleton--text`, ...), never an
 * inline height.
 */
export function skeletonBlock({ className = 'skeleton-row' } = {}) {
    return `<div class="skeleton ${className}"></div>`;
}

/** `count` stacked skeleton rows — the common "list still loading" placeholder. */
export function skeletonRows(count = 3) {
    return Array.from({ length: count }, () => skeletonBlock()).join('');
}

/**
 * A list still loading: avatar circle + two text lines per row, like the
 * rows it stands in for.
 */
export function skeletonList(count = 3) {
    const row = `
        <div class="skeleton-list__row">
            <span class="skeleton skeleton--circle"></span>
            <span class="skeleton-list__lines">
                <span class="skeleton skeleton--line"></span>
                <span class="skeleton skeleton--line-sm"></span>
            </span>
        </div>
    `;

    return `<div class="skeleton-list" aria-hidden="true">${row.repeat(count)}</div>`;
}

/**
 * Empty state block — `title` is required; `hint`, `icon` (sprite
 * name) and `actionHtml` are optional. `plain` drops the dashed frame
 * for use inside a card or list that already has one.
 */
export function emptyState(
    title,
    { hint = '', actionHtml = '', icon: iconName = '', plain = false } = {},
) {
    return `
        <div class="empty-state${plain ? ' empty-state--plain' : ''}">
            ${iconName ? `<span class="empty-state__icon">${icon(iconName, { size: 20 })}</span>` : ''}
            <strong class="empty-state__title">${title}</strong>
            ${hint ? `<span>${hint}</span>` : ''}
            ${actionHtml ? `<div class="empty-state__actions">${actionHtml}</div>` : ''}
        </div>
    `;
}

/**
 * Error state with a Retry button (`[data-retry]` — the caller wires
 * it, usually to the same loader that just failed).
 */
export function errorState(
    title = t('components.error_title'),
    { hint = '', retryLabel = t('components.retry') } = {},
) {
    return `
        <div class="error-state" role="alert">
            <span class="error-state__icon">${icon('alert', { size: 24 })}</span>
            <strong class="error-state__title">${title}</strong>
            ${hint ? `<span>${hint}</span>` : ''}
            <div class="error-state__actions">
                <button type="button" class="btn btn--outline btn--sm" data-retry>
                    ${icon('refresh', { size: 16 })}${retryLabel}
                </button>
            </div>
        </div>
    `;
}
