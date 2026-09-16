import { api } from '../axios';
import { confirmDialog } from './confirm';
import { methodClass, statusClass } from './format';
import { escapeHtml } from './forms';
import { t } from './i18n';
import { renderPagination } from './pagination';
import { openRequestLogDetailModal } from './request-log-detail';
import { showToast, apiErrorMessage } from './toast';

function field(label, value) {
    return `
        <div>
            <div style="font-size:11.5px; color: var(--ui-text-muted); text-transform:uppercase; letter-spacing:.03em; margin-bottom:3px;">${label}</div>
            <div style="font-size:13.5px; color: var(--ui-text); font-weight:600;">${value ?? '—'}</div>
        </div>
    `;
}

/**
 * Drives both the user-facing `/sessions/{id}` page and the admin
 * `/admin/sessions/{id}` page — same layout, same request-log drill-down,
 * different base API path and whether the owning user is shown.
 */
export function initSessionDetailView({
    sessionId,
    sessionEndpoint,
    logsEndpoint,
    logDetailEndpoint,
    revokeEndpoint,
    showOwner = false,
}) {
    // Turbo Drive can restore a page from its own cache using the exact
    // previous DOM nodes (not fresh ones) on a back/forward-style
    // navigation, so listeners bound on a prior call to this function can
    // still be attached when it runs again. The AbortController lets the
    // caller remove this call's listeners in one shot (via the returned
    // cleanup function) before wiring up a fresh set.
    const controller = new AbortController();
    const { signal } = controller;

    const summaryEl = document.querySelector('[data-session-summary]');
    const revokeBtn = document.querySelector('[data-revoke-session]');
    const rowsEl = document.querySelector('[data-request-log-rows]');
    const paginationEl = document.querySelector(
        '[data-request-log-pagination]',
    );

    function renderSummary(session) {
        const statusPill =
            session.status === 'active'
                ? `<span class="pill pill--success">${t('common.active')}</span>`
                : `<span class="pill pill--muted">${t('common.expired')}</span>`;

        const currentPill = session.is_current
            ? `<span class="pill pill--primary" style="margin-left:6px;">${t('sessions.this_device')}</span>`
            : '';

        const ownerBlock =
            showOwner && session.user
                ? field(
                      t('admin.user'),
                      `${escapeHtml(session.user.name)}<br><span style="font-weight:400; color:var(--ui-text-secondary);">${escapeHtml(session.user.email)}</span>`,
                  )
                : '';

        summaryEl.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px;">
                ${statusPill}${currentPill}
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:16px;">
                ${ownerBlock}
                ${field(t('sessions.device'), escapeHtml([session.browser, session.platform].filter(Boolean).join(' · ') || session.device_name || t('common.unknown')))}
                ${field(t('sessions.ip_address'), session.ip_address)}
                ${field(t('sessions.browser'), session.browser)}
                ${field(t('sessions.platform'), session.platform)}
                ${field(t('sessions.signed_in'), session.logged_in_at)}
                ${field(t('sessions.last_active'), session.last_activity_at)}
                ${field(t('sessions.signed_out'), session.logged_out_at)}
            </div>
            ${session.user_agent ? `<div style="margin-top:16px;">${field(t('sessions.user_agent'), `<span style="font-weight:400; color:var(--ui-text-secondary); word-break:break-all;">${escapeHtml(session.user_agent)}</span>`)}</div>` : ''}
        `;

        if (revokeBtn) {
            revokeBtn.hidden =
                session.status !== 'active' || session.is_current;
        }
    }

    async function loadSession() {
        try {
            const { data } = await api.get(sessionEndpoint);

            renderSummary(data.data);
        } catch (error) {
            summaryEl.innerHTML = `<div class="empty-state"><strong>${t('sessions.error')}</strong></div>`;
            showToast(apiErrorMessage(error, t('sessions.error')), 'error');
        }
    }

    function renderLogRows(logs) {
        if (!logs.length) {
            rowsEl.innerHTML = `<tr><td colspan="5"><div class="empty-state"><strong>${t('sessions.request_logs_empty')}</strong></div></td></tr>`;

            return;
        }

        rowsEl.innerHTML = logs
            .map(
                (log) => `
                <tr class="table__row--clickable" data-log-id="${log.id}">
                    <td><span class="${statusClass(log.status_code)}">${log.status_code ?? '—'}</span></td>
                    <td><span class="${methodClass(log.method)}">${log.method}</span></td>
                    <td class="table__cell--wrap" style="max-width:320px;">${escapeHtml(log.path)}</td>
                    <td>${log.duration_ms != null ? `${log.duration_ms} ms` : '—'}</td>
                    <td>${log.created_at ?? '—'}</td>
                </tr>
            `,
            )
            .join('');
    }

    async function loadLogs(page = 1) {
        rowsEl.innerHTML = `<tr><td colspan="5"><div class="skeleton skeleton-row"></div></td></tr>`;

        try {
            const { data } = await api.get(logsEndpoint, {
                params: { page, per_page: 15 },
            });

            renderLogRows(data.data || []);
            renderPagination(paginationEl, data.pagination, loadLogs);
        } catch (error) {
            rowsEl.innerHTML = `<tr><td colspan="5"><div class="empty-state"><strong>${t('sessions.request_logs_error')}</strong></div></td></tr>`;
            showToast(
                apiErrorMessage(error, t('sessions.request_logs_error')),
                'error',
            );
        }
    }

    async function openLogDetail(logId) {
        try {
            const { data } = await api.get(logDetailEndpoint(logId));

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

    revokeBtn?.addEventListener(
        'click',
        async () => {
            try {
                const confirmed = await confirmDialog({
                    title: t('confirm.revoke_session_title'),
                    message: t('confirm.revoke_session_message'),
                    confirmText: t('confirm.revoke_session_confirm'),
                    cancelText: t('common.cancel'),
                    danger: true,
                    onConfirm: () => api.delete(revokeEndpoint),
                });

                if (!confirmed) {
                    return;
                }

                showToast(t('sessions.revoked'));
                loadSession();
            } catch (error) {
                showToast(apiErrorMessage(error, t('sessions.error')), 'error');
            }
        },
        { signal },
    );

    if (sessionId) {
        loadSession();
        loadLogs();
    }

    return () => controller.abort();
}
