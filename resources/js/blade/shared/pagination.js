import { t } from './i18n';
import { icon } from './icon';

/**
 * Renders numbered pagination controls from the `pagination` meta object
 * returned by the API's `responsePagination()` envelope
 * (`{current_page, last_page, per_page, total, from, to}`), and wires clicks
 * to `onPage(page)`. Re-render on every load — it's cheap and keeps the
 * button state trivially correct.
 */
export function renderPagination(container, pagination, onPage) {
    if (!container) {
        return;
    }

    if (!pagination || pagination.last_page <= 1) {
        container.innerHTML = '';
        container.hidden = true;

        return;
    }

    container.hidden = false;

    const {
        current_page: current,
        last_page: last,
        total,
        from,
        to,
    } = pagination;

    const pages = pageWindow(current, last);

    const pageButton = (
        page,
        label = page,
        active = false,
        disabled = false,
        ariaLabel = null,
    ) => `
        <button
            type="button"
            class="pagination__btn ${active ? 'pagination__btn--active' : ''}"
            data-page="${page}"
            ${active ? 'aria-current="page"' : ''}
            ${ariaLabel ? `aria-label="${ariaLabel}"` : ''}
            ${disabled ? 'disabled' : ''}
        >${label}</button>
    `;

    container.innerHTML = `
        <span class="pagination__info">${
            from && to
                ? t('components.showing', { from, to, total })
                : t('common.total_items', { count: total })
        }</span>
        <div class="pagination__controls">
            ${pageButton(current - 1, icon('left', { size: 16 }), false, current <= 1, t('components.previous'))}
            ${pages
                .map((page) =>
                    page === '…'
                        ? '<span class="pagination__btn pagination__ellipsis" aria-hidden="true">…</span>'
                        : pageButton(page, page, page === current),
                )
                .join('')}
            ${pageButton(current + 1, icon('chev', { size: 16 }), false, current >= last, t('components.next'))}
        </div>
    `;

    container.querySelectorAll('[data-page]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const page = Number(btn.dataset.page);

            if (page >= 1 && page <= last && page !== current) {
                onPage(page);
            }
        });
    });
}

/**
 * The page numbers to show around `current`: the first, the last, the
 * current one and its neighbours, with '…' wherever pages are skipped.
 */
export function pageWindow(current, last) {
    const span = 1;
    const pages = new Set([1, last, current]);

    for (let i = current - span; i <= current + span; i += 1) {
        if (i >= 1 && i <= last) {
            pages.add(i);
        }
    }

    const sorted = [...pages].sort((a, b) => a - b);
    const result = [];

    sorted.forEach((page, index) => {
        if (index > 0 && page - sorted[index - 1] > 1) {
            result.push('…');
        }

        result.push(page);
    });

    return result;
}
