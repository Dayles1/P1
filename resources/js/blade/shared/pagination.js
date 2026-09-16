import { t } from './i18n';

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

    const { current_page: current, last_page: last, total } = pagination;

    const pages = pageWindow(current, last);

    const pageButton = (
        page,
        label = page,
        active = false,
        disabled = false,
    ) => `
        <button
            type="button"
            class="pagination__btn ${active ? 'pagination__btn--active' : ''}"
            data-page="${page}"
            ${disabled ? 'disabled' : ''}
        >${label}</button>
    `;

    container.innerHTML = `
        <span>${t('common.total_items', { count: total })}</span>
        <div class="pagination__controls">
            ${pageButton(current - 1, '‹', false, current <= 1)}
            ${pages
                .map((page) =>
                    page === '…'
                        ? '<span class="pagination__btn" style="border:none;background:none;cursor:default;">…</span>'
                        : pageButton(page, page, page === current),
                )
                .join('')}
            ${pageButton(current + 1, '›', false, current >= last)}
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

function pageWindow(current, last) {
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
