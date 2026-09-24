import { api } from '../axios';
import { methodClass, statusClass } from '../shared/format';
import { escapeHtml } from '../shared/forms';
import { t } from '../shared/i18n';
import { bootOnPage } from '../shared/page-boot';
import { renderPagination } from '../shared/pagination';
import { openRequestLogDetailModal } from '../shared/request-log-detail';
import { showToast, apiErrorMessage } from '../shared/toast';

let currentCleanup = null;

/**
 * Everything below used to run once at module top level. Under Turbo
 * Drive, `<main>` (and everything in it) is replaced by fresh server
 * HTML on every navigation, but this module is only ever evaluated once
 * per session — so all of this is wrapped in `boot()` and re-run via
 * `bootOnPage` on every `turbo:load` that lands on /admin/request-logs,
 * re-querying the (new) DOM each time instead of operating on detached
 * nodes from a previous visit. The AbortController lets `teardown()`
 * remove all of this visit's listeners in one shot, and also cancels
 * any pending search-debounce timer so it can't fire later against a
 * previous visit's stale closures.
 */
function boot() {
    const controller = new AbortController();
    const { signal } = controller;

    const rowsEl = document.querySelector('[data-logs-rows]');
    const paginationEl = document.querySelector('[data-logs-pagination]');
    const searchInput = document.querySelector('[data-logs-search]');
    const methodFilter = document.querySelector('[data-logs-method]');
    const statusFilter = document.querySelector('[data-logs-status]');

    let searchTimer = null;

    function renderRows(logs) {
        if (!logs.length) {
            rowsEl.innerHTML = `<tr><td colspan="6"><div class="empty-state"><strong>${t('sessions.request_logs_empty')}</strong></div></td></tr>`;

            return;
        }

        rowsEl.innerHTML = logs
            .map(
                (log) => `
                <tr class="table__row--clickable" data-log-id="${log.id}">
                    <td><span class="${statusClass(log.status_code)}">${log.status_code ?? '—'}</span></td>
                    <td><span class="${methodClass(log.method)}">${log.method}</span></td>
                    <td class="table__cell--wrap mw-lg">${escapeHtml(log.path)}</td>
                    <td>${escapeHtml(log.user?.name || '—')}</td>
                    <td>${log.duration_ms != null ? `${log.duration_ms} ms` : '—'}</td>
                    <td>${log.created_at ?? '—'}</td>
                </tr>
            `,
            )
            .join('');
    }

    async function loadLogs(page = 1) {
        rowsEl.innerHTML = `<tr><td colspan="6"><div class="skeleton skeleton-row"></div></td></tr>`;

        try {
            const { data } = await api.get('/admin/request-logs', {
                params: {
                    page,
                    per_page: 20,
                    method: methodFilter?.value || undefined,
                    status: statusFilter?.value || undefined,
                    search: searchInput?.value || undefined,
                },
            });

            renderRows(data.data || []);
            renderPagination(paginationEl, data.pagination, loadLogs);
        } catch (error) {
            rowsEl.innerHTML = `<tr><td colspan="6"><div class="empty-state"><strong>${t('sessions.request_logs_error')}</strong></div></td></tr>`;
            showToast(
                apiErrorMessage(error, t('sessions.request_logs_error')),
                'error',
            );
        }
    }

    async function openLogDetail(logId) {
        try {
            const { data } = await api.get(`/admin/request-logs/${logId}`);

            openRequestLogDetailModal(data.data);
        } catch (error) {
            showToast(
                apiErrorMessage(error, t('sessions.request_logs_error')),
                'error',
            );
        }
    }

    rowsEl?.addEventListener(
        'click',
        (event) => {
            const row = event.target.closest('[data-log-id]');

            if (row) {
                openLogDetail(row.dataset.logId);
            }
        },
        { signal },
    );

    [methodFilter, statusFilter].forEach((el) =>
        el?.addEventListener('change', () => loadLogs(1), { signal }),
    );

    searchInput?.addEventListener(
        'input',
        () => {
            window.clearTimeout(searchTimer);
            searchTimer = window.setTimeout(() => loadLogs(1), 350);
        },
        { signal },
    );

    loadLogs();

    currentCleanup = () => {
        controller.abort();
        window.clearTimeout(searchTimer);
    };
}

function teardown() {
    currentCleanup?.();
    currentCleanup = null;
}

bootOnPage('[data-logs-rows]', boot, teardown);
