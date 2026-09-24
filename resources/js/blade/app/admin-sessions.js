import { api } from '../axios';
import { confirmDialog } from '../shared/confirm';
import { escapeHtml } from '../shared/forms';
import { t } from '../shared/i18n';
import { bootOnPage } from '../shared/page-boot';
import { renderPagination } from '../shared/pagination';
import { showToast, apiErrorMessage } from '../shared/toast';

let currentCleanup = null;

/**
 * Everything below used to run once at module top level. Under Turbo
 * Drive, `<main>` (and everything in it) is replaced by fresh server
 * HTML on every navigation, but this module is only ever evaluated once
 * per session — so all of this is wrapped in `boot()` and re-run via
 * `bootOnPage` on every `turbo:load` that lands on /admin/sessions, re-
 * querying the (new) DOM each time instead of operating on detached
 * nodes from a previous visit. The AbortController lets `teardown()`
 * remove all of this visit's listeners in one shot, and also cancels
 * any pending search-debounce timer so it can't fire later against a
 * previous visit's stale closures.
 */
function boot() {
    const controller = new AbortController();
    const { signal } = controller;

    const rowsEl = document.querySelector('[data-sessions-rows]');
    const paginationEl = document.querySelector('[data-sessions-pagination]');
    const searchInput = document.querySelector('[data-sessions-search]');
    const statusFilter = document.querySelector('[data-sessions-status]');

    let currentPage = 1;
    let searchTimer = null;

    function renderRows(sessions) {
        if (!sessions.length) {
            rowsEl.innerHTML = `<tr><td colspan="6"><div class="empty-state"><strong>${t('sessions.empty')}</strong></div></td></tr>`;

            return;
        }

        rowsEl.innerHTML = sessions
            .map((session) => {
                const statusPill =
                    session.status === 'active'
                        ? `<span class="pill pill--success">${t('common.active')}</span>`
                        : `<span class="pill pill--muted">${t('common.expired')}</span>`;

                return `
                    <tr>
                        <td>
                            <div class="font-semibold">${escapeHtml(session.user?.name || '—')}</div>
                            <div class="text-xs muted">${escapeHtml(session.user?.email || '')}</div>
                        </td>
                        <td>${escapeHtml([session.browser, session.platform].filter(Boolean).join(' · ') || session.device_name || t('common.unknown'))}</td>
                        <td>${escapeHtml(session.ip_address || '—')}</td>
                        <td>${statusPill}</td>
                        <td>${session.last_activity_at ?? '—'}</td>
                        <td class="text-right">
                            <a href="/admin/sessions/${session.id}" class="btn btn--ghost btn--sm">${t('common.details')}</a>
                            ${session.status === 'active' ? `<button type="button" class="btn btn--outline btn--sm" data-revoke="${session.id}">${t('sessions.sign_out')}</button>` : ''}
                        </td>
                    </tr>
                `;
            })
            .join('');
    }

    async function loadSessions(page = 1) {
        currentPage = page;
        rowsEl.innerHTML = `<tr><td colspan="6"><div class="skeleton skeleton-row"></div></td></tr>`;

        try {
            const { data } = await api.get('/admin/sessions', {
                params: {
                    page,
                    per_page: 15,
                    status: statusFilter?.value || 'all',
                    search: searchInput?.value || undefined,
                },
            });

            renderRows(data.data || []);
            renderPagination(paginationEl, data.pagination, loadSessions);
        } catch (error) {
            rowsEl.innerHTML = `<tr><td colspan="6"><div class="empty-state"><strong>${t('sessions.error')}</strong></div></td></tr>`;
            showToast(apiErrorMessage(error, t('sessions.error')), 'error');
        }
    }

    rowsEl?.addEventListener(
        'click',
        async (event) => {
            const button = event.target.closest('[data-revoke]');

            if (!button) {
                return;
            }

            try {
                const confirmed = await confirmDialog({
                    title: t('confirm.revoke_session_title'),
                    message: t('confirm.revoke_session_message'),
                    confirmText: t('confirm.revoke_session_confirm'),
                    cancelText: t('common.cancel'),
                    danger: true,
                    onConfirm: () =>
                        api.delete(`/admin/sessions/${button.dataset.revoke}`),
                });

                if (!confirmed) {
                    return;
                }

                showToast(t('sessions.revoked'));
                loadSessions(currentPage);
            } catch (error) {
                showToast(apiErrorMessage(error, t('sessions.error')), 'error');
            }
        },
        { signal },
    );

    statusFilter?.addEventListener('change', () => loadSessions(1), {
        signal,
    });

    searchInput?.addEventListener(
        'input',
        () => {
            window.clearTimeout(searchTimer);
            searchTimer = window.setTimeout(() => loadSessions(1), 350);
        },
        { signal },
    );

    loadSessions();

    currentCleanup = () => {
        controller.abort();
        window.clearTimeout(searchTimer);
    };
}

function teardown() {
    currentCleanup?.();
    currentCleanup = null;
}

bootOnPage('[data-sessions-rows]', boot, teardown);
