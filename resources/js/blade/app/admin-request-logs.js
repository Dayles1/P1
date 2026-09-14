import { api } from '../axios';
import { showToast, apiErrorMessage } from '../shared/toast';
import { renderPagination } from '../shared/pagination';
import { openRequestLogDetailModal } from '../shared/request-log-detail';
import { t } from '../shared/i18n';
import { methodClass, statusClass } from '../shared/format';
import { escapeHtml } from '../shared/forms';

const rowsEl = document.querySelector('[data-logs-rows]');
const paginationEl = document.querySelector('[data-logs-pagination]');
const searchInput = document.querySelector('[data-logs-search]');
const methodFilter = document.querySelector('[data-logs-method]');
const statusFilter = document.querySelector('[data-logs-status]');

let currentPage = 1;
let searchTimer = null;

function renderRows(logs) {
    if (!logs.length) {
        rowsEl.innerHTML = `<tr><td colspan="6"><div class="empty-state"><strong>${t('sessions.request_logs_empty')}</strong></div></td></tr>`;

        return;
    }

    rowsEl.innerHTML = logs
        .map((log) => `
            <tr class="table__row--clickable" data-log-id="${log.id}">
                <td><span class="${statusClass(log.status_code)}">${log.status_code ?? '—'}</span></td>
                <td><span class="${methodClass(log.method)}">${log.method}</span></td>
                <td class="table__cell--wrap" style="max-width:280px;">${escapeHtml(log.path)}</td>
                <td>${escapeHtml(log.user?.name || '—')}</td>
                <td>${log.duration_ms != null ? `${log.duration_ms} ms` : '—'}</td>
                <td>${log.created_at ?? '—'}</td>
            </tr>
        `)
        .join('');
}

async function loadLogs(page = 1) {
    currentPage = page;
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
        showToast(apiErrorMessage(error, t('sessions.request_logs_error')), 'error');
    }
}

async function openLogDetail(logId) {
    try {
        const { data } = await api.get(`/admin/request-logs/${logId}`);

        openRequestLogDetailModal(data.data);
    } catch (error) {
        showToast(apiErrorMessage(error, t('sessions.request_logs_error')), 'error');
    }
}

rowsEl?.addEventListener('click', (event) => {
    const row = event.target.closest('[data-log-id]');

    if (row) {
        openLogDetail(row.dataset.logId);
    }
});

[methodFilter, statusFilter].forEach((el) => el?.addEventListener('change', () => loadLogs(1)));

searchInput?.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => loadLogs(1), 350);
});

loadLogs();
