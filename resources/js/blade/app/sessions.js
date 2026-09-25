import { api } from '../axios';
import { visit } from '../shared/command-palette';
import { confirmDialog } from '../shared/confirm';
import { escapeHtml } from '../shared/forms';
import { formatNumber, t } from '../shared/i18n';
import { icon } from '../shared/icon';
import { bootOnPage } from '../shared/page-boot';
import { renderPagination } from '../shared/pagination';
import { showToast, apiErrorMessage } from '../shared/toast';

let currentCleanup = null;

/**
 * Everything below used to run once at module top level. Under Turbo
 * Drive, `<main>` (and everything in it) is replaced by fresh server
 * HTML on every navigation, but this module is only ever evaluated once
 * per session — so all of this is wrapped in `boot()` and re-run via
 * `bootOnPage` on every `turbo:load` that lands on /sessions, re-
 * querying the (new) DOM each time instead of operating on detached
 * nodes from a previous visit. The AbortController lets `teardown()`
 * remove all of this visit's listeners in one shot before the next one
 * registers a fresh set.
 */
function boot() {
    const controller = new AbortController();
    const { signal } = controller;

    const list = document.querySelector('[data-sessions-list]');
    const revokeOthersBtn = document.querySelector('[data-revoke-others]');
    const statusButtons = [
        ...document.querySelectorAll('[data-sessions-status]'),
    ];
    const searchInput = document.querySelector('[data-sessions-search]');
    const paginationEl = document.querySelector('[data-sessions-pagination]');

    let currentPage = 1;
    let status = 'all';
    let sessions = [];

    function renderSkeleton() {
        list.innerHTML = Array.from({ length: 3 })
            .map(() => '<div class="skeleton skeleton-row"></div>')
            .join('');
    }

    function renderEmpty(message) {
        list.innerHTML = `<div class="empty-state empty-state--plain"><strong>${escapeHtml(message)}</strong></div>`;
    }

    function deviceOf(session) {
        return (
            [session.browser, session.platform].filter(Boolean).join(' · ') ||
            session.device_name ||
            t('common.unknown')
        );
    }

    function statusBadge(session) {
        if (session.is_current) {
            return `<span class="badge badge--success">${t('sessions.this_device')}</span>`;
        }

        return session.status === 'active'
            ? `<span class="badge">${t('common.active')}</span>`
            : `<span class="sessions-row__ended">${t('common.expired')}</span>`;
    }

    /**
     * The loaded page, narrowed by the search box (device or IP).
     */
    function renderSessions() {
        const query = (searchInput?.value || '').trim().toLowerCase();
        const shown = sessions.filter(
            (session) =>
                !query ||
                deviceOf(session).toLowerCase().includes(query) ||
                String(session.ip_address || '').includes(query),
        );

        if (!shown.length) {
            renderEmpty(t('sessions.empty'));

            return;
        }

        list.innerHTML = shown
            .map((session) => {
                const mobile = ['mobile', 'tablet'].includes(
                    session.device_type,
                );
                const revokeButton =
                    session.status === 'active' && !session.is_current
                        ? `<button type="button" class="btn btn--ghost btn--sm" data-revoke="${escapeHtml(session.id)}">${t('sessions.sign_out')}</button>`
                        : '';

                return `
                <div class="sessions-row${session.status === 'active' ? '' : ' sessions-row--ended'}" role="row" data-href="/sessions/${escapeHtml(session.id)}">
                    <span class="sessions-col sessions-col--device" role="cell">
                        ${icon(mobile ? 'phone' : 'monitor', { size: 15, className: 'sessions-row__icon' })}
                        <a href="/sessions/${escapeHtml(session.id)}" class="sessions-row__device truncate">${escapeHtml(deviceOf(session))}</a>
                    </span>
                    <span class="sessions-col sessions-col--ip mono" role="cell">${escapeHtml(session.ip_address ?? '—')}</span>
                    <span class="sessions-col sessions-col--activity" role="cell">${escapeHtml(session.last_activity_at ?? '—')}</span>
                    <span class="sessions-col sessions-col--status" role="cell">${statusBadge(session)}</span>
                    <span class="sessions-col sessions-col--action" role="cell">${revokeButton}</span>
                </div>
            `;
            })
            .join('');
    }

    /** The figures and filter counts, from the dashboard summary. */
    async function loadStats() {
        try {
            const { data } = await api.get('/dashboard');
            const summary = data.data;
            const values = {
                active: summary.sessions.active,
                total: summary.sessions.total,
                requests_today: summary.requests.today,
                errors_week: summary.requests.errors_this_week,
            };

            Object.entries(values).forEach(([key, value]) => {
                const el = document.querySelector(
                    `[data-sessions-stat="${key}"]`,
                );

                if (el) {
                    el.textContent = formatNumber(value);
                }
            });

            const counts = {
                all: summary.sessions.total,
                active: summary.sessions.active,
                expired: summary.sessions.total - summary.sessions.active,
            };

            Object.entries(counts).forEach(([key, value]) => {
                const el = document.querySelector(
                    `[data-sessions-count="${key}"]`,
                );

                if (el) {
                    el.textContent = ` · ${formatNumber(value)}`;
                }
            });
        } catch {
            document.querySelectorAll('[data-sessions-stat]').forEach((el) => {
                el.textContent = '—';
            });
        }
    }

    async function loadSessions(page = 1) {
        currentPage = page;
        renderSkeleton();

        try {
            const { data } = await api.get('/sessions', {
                params: {
                    status,
                    page,
                    per_page: 10,
                },
            });

            sessions = data.data || [];
            renderSessions();
            renderPagination(paginationEl, data.pagination, loadSessions);
        } catch (error) {
            renderEmpty(t('sessions.error'));
            showToast(apiErrorMessage(error, t('sessions.error')), 'error');
        }
    }

    list?.addEventListener(
        'click',
        async (event) => {
            const button = event.target.closest('[data-revoke]');
            const row = event.target.closest('[data-href]');

            // A click anywhere on a row opens the session, as its link does.
            if (!button) {
                if (row && !event.target.closest('a')) {
                    visit(row.dataset.href);
                }

                return;
            }

            event.preventDefault();

            try {
                const confirmed = await confirmDialog({
                    title: t('confirm.revoke_session_title'),
                    message: t('confirm.revoke_session_message'),
                    confirmText: t('confirm.revoke_session_confirm'),
                    cancelText: t('common.cancel'),
                    danger: true,
                    onConfirm: () =>
                        api.delete(`/sessions/${button.dataset.revoke}`),
                });

                if (!confirmed) {
                    return;
                }

                showToast(t('sessions.revoked'));

                loadSessions(currentPage);
                loadStats();
            } catch (error) {
                showToast(apiErrorMessage(error, t('sessions.error')), 'error');
            }
        },
        { signal },
    );

    revokeOthersBtn?.addEventListener(
        'click',
        async () => {
            try {
                let revokedCount = 0;

                const confirmed = await confirmDialog({
                    title: t('confirm.revoke_others_title'),
                    message: t('confirm.revoke_others_message'),
                    confirmText: t('confirm.revoke_others_confirm'),
                    cancelText: t('common.cancel'),
                    danger: true,
                    onConfirm: async () => {
                        const { data } = await api.delete('/sessions/others');
                        revokedCount = data.data?.revoked_sessions ?? 0;
                    },
                });

                if (!confirmed) {
                    return;
                }

                showToast(
                    revokedCount > 0
                        ? t('sessions.revoked')
                        : t('sessions.others_revoked_none'),
                );

                loadSessions(currentPage);
                loadStats();
            } catch (error) {
                showToast(apiErrorMessage(error, t('sessions.error')), 'error');
            }
        },
        { signal },
    );

    statusButtons.forEach((button) => {
        button.addEventListener(
            'click',
            () => {
                status = button.dataset.sessionsStatus;
                statusButtons.forEach((other) =>
                    other.setAttribute(
                        'aria-pressed',
                        String(other === button),
                    ),
                );
                loadSessions(1);
            },
            { signal },
        );
    });

    searchInput?.addEventListener('input', renderSessions, { signal });

    loadSessions();
    loadStats();

    currentCleanup = () => controller.abort();
}

function teardown() {
    currentCleanup?.();
    currentCleanup = null;
}

bootOnPage('[data-sessions-list]', boot, teardown);
