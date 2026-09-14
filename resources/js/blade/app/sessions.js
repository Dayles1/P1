import { api } from '../axios';
import { showToast, apiErrorMessage } from '../shared/toast';
import { confirmDialog } from '../shared/confirm';
import { renderPagination } from '../shared/pagination';
import { t } from '../shared/i18n';

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
            const statusPill = session.status === 'active'
                ? `<span class="pill pill--success">${t('common.active')}</span>`
                : `<span class="pill pill--muted">${t('common.expired')}</span>`;

            const currentPill = session.is_current
                ? `<span class="pill pill--primary" style="margin-left:6px;">${t('sessions.this_device')}</span>`
                : '';

            const device = [session.browser, session.platform]
                .filter(Boolean)
                .join(' · ') || session.device_name || t('common.unknown');

            const revokeButton = session.status === 'active' && !session.is_current
                ? `<button type="button" class="btn btn--outline btn--sm" data-revoke="${session.id}">${t('sessions.sign_out')}</button>`
                : '';

            return `
                <a href="/sessions/${session.id}" class="data-row ${session.is_current ? 'data-row--current' : ''}" style="text-decoration:none;">
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
            params: { status: statusFilter?.value || 'all', page, per_page: 10 },
        });

        renderSessions(data.data || []);
        renderPagination(paginationEl, data.pagination, loadSessions);
    } catch (error) {
        renderEmpty(t('sessions.error'));
        showToast(apiErrorMessage(error, t('sessions.error')), 'error');
    }
}

list?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-revoke]');

    if (!button) {
        return;
    }

    event.preventDefault();

    const confirmed = await confirmDialog({
        title: t('confirm.revoke_session_title'),
        message: t('confirm.revoke_session_message'),
        confirmText: t('confirm.revoke_session_confirm'),
        cancelText: t('common.cancel'),
        danger: true,
    });

    if (!confirmed) {
        return;
    }

    button.disabled = true;

    try {
        await api.delete(`/sessions/${button.dataset.revoke}`);

        showToast(t('sessions.revoked'));

        loadSessions(currentPage);
    } catch (error) {
        showToast(apiErrorMessage(error, t('sessions.error')), 'error');
        button.disabled = false;
    }
});

revokeOthersBtn?.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
        title: t('confirm.revoke_others_title'),
        message: t('confirm.revoke_others_message'),
        confirmText: t('confirm.revoke_others_confirm'),
        cancelText: t('common.cancel'),
        danger: true,
    });

    if (!confirmed) {
        return;
    }

    revokeOthersBtn.disabled = true;

    try {
        const { data } = await api.delete('/sessions/others');

        showToast(
            data.data?.revoked_sessions > 0
                ? t('sessions.revoked')
                : t('sessions.others_revoked_none')
        );

        loadSessions(currentPage);
    } catch (error) {
        showToast(apiErrorMessage(error, t('sessions.error')), 'error');
    } finally {
        revokeOthersBtn.disabled = false;
    }
});

statusFilter?.addEventListener('change', () => loadSessions(1));

loadSessions();
