import { api } from '../axios';
import { confirmDialog } from '../shared/confirm';
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
    const statusFilter = document.querySelector('[data-sessions-status]');
    const paginationEl = document.querySelector('[data-sessions-pagination]');

    let currentPage = 1;

    function renderSkeleton() {
        list.innerHTML = Array.from({ length: 3 })
            .map(() => '<div class="skeleton skeleton-row"></div>')
            .join('');
    }

    function renderEmpty(message) {
        list.innerHTML = `<div class="empty-state"><strong>${message}</strong></div>`;
    }

    function renderSessions(sessions) {
        if (!sessions.length) {
            renderEmpty(t('sessions.empty'));

            return;
        }

        list.innerHTML = sessions
            .map((session) => {
                const statusPill =
                    session.status === 'active'
                        ? `<span class="pill pill--success">${t('common.active')}</span>`
                        : `<span class="pill pill--muted">${t('common.expired')}</span>`;

                const currentPill = session.is_current
                    ? `<span class="pill pill--primary ml-2">${t('sessions.this_device')}</span>`
                    : '';

                const device =
                    [session.browser, session.platform]
                        .filter(Boolean)
                        .join(' · ') ||
                    session.device_name ||
                    t('common.unknown');

                const revokeButton =
                    session.status === 'active' && !session.is_current
                        ? `<button type="button" class="btn btn--outline btn--sm" data-revoke="${session.id}">${t('sessions.sign_out')}</button>`
                        : '';

                return `
                <a href="/sessions/${session.id}" class="data-row ${session.is_current ? 'data-row--current' : ''} no-underline">
                    <div class="data-row__main">
                        <div class="data-row__title">${device} ${statusPill} ${currentPill}</div>
                        <div class="data-row__meta">${session.ip_address ?? ''} &middot; ${t('sessions.last_active')}: ${session.last_activity_at ?? '—'}</div>
                    </div>
                    <div class="data-row__actions" onclick="event.stopPropagation(); event.preventDefault();">
                        ${revokeButton}
                        <a href="/sessions/${session.id}" class="btn btn--ghost btn--sm">${t('common.details')}</a>
                    </div>
                </a>
            `;
            })
            .join('');
    }

    async function loadSessions(page = 1) {
        currentPage = page;
        renderSkeleton();

        try {
            const { data } = await api.get('/sessions', {
                params: {
                    status: statusFilter?.value || 'all',
                    page,
                    per_page: 10,
                },
            });

            renderSessions(data.data || []);
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

            if (!button) {
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
            } catch (error) {
                showToast(apiErrorMessage(error, t('sessions.error')), 'error');
            }
        },
        { signal },
    );

    statusFilter?.addEventListener('change', () => loadSessions(1), {
        signal,
    });

    loadSessions();

    currentCleanup = () => controller.abort();
}

function teardown() {
    currentCleanup?.();
    currentCleanup = null;
}

bootOnPage('[data-sessions-list]', boot, teardown);
