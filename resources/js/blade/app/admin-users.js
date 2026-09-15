import { api } from '../axios';
import { showToast, apiErrorMessage } from '../shared/toast';
import { confirmDialog } from '../shared/confirm';
import { openModal } from '../shared/modal';
import { renderPagination } from '../shared/pagination';
import { t } from '../shared/i18n';
import { escapeHtml } from '../shared/forms';

const rowsEl = document.querySelector('[data-users-rows]');
const paginationEl = document.querySelector('[data-users-pagination]');
const searchInput = document.querySelector('[data-users-search]');
const roleFilter = document.querySelector('[data-users-role]');

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'USER'];

let currentPage = 1;
let searchTimer = null;

function roleSelect(user) {
    const currentRole = user.roles?.[0]?.code || 'USER';

    return `
        <div class="select-field" style="max-width:150px;">
            <select class="field-select" data-role-select="${user.id}" data-current-role="${currentRole}">
                ${ROLES.map((role) => `<option value="${role}" ${role === currentRole ? 'selected' : ''}>${role}</option>`).join('')}
            </select>
        </div>
    `;
}

function renderRows(users) {
    if (!users.length) {
        rowsEl.innerHTML = `<tr><td colspan="4"><div class="empty-state"><strong>${t('common.total_items', { count: 0 })}</strong></div></td></tr>`;

        return;
    }

    rowsEl.innerHTML = users
        .map((user) => {
            const statusPill = user.is_banned
                ? `<span class="pill pill--danger">${t('admin.banned')}</span>`
                : `<span class="pill pill--success">${t('common.active')}</span>`;

            return `
                <tr>
                    <td>
                        <div style="font-weight:600;">${escapeHtml(user.name)}</div>
                        <div style="font-size:11.5px; color:var(--ui-text-muted);">${escapeHtml(user.email)}</div>
                    </td>
                    <td>${roleSelect(user)}</td>
                    <td>${statusPill}</td>
                    <td style="text-align:right;">
                        ${user.is_banned
                            ? `<button type="button" class="btn btn--outline btn--sm" data-unban="${user.id}">${t('admin.unban')}</button>`
                            : `<button type="button" class="btn btn--outline btn--danger-outline btn--sm" data-ban="${user.id}">${t('admin.ban')}</button>`
                        }
                    </td>
                </tr>
            `;
        })
        .join('');
}

async function loadUsers(page = 1) {
    currentPage = page;
    rowsEl.innerHTML = `<tr><td colspan="4"><div class="skeleton skeleton-row"></div></td></tr>`;

    try {
        const { data } = await api.get('/admin/users', {
            params: {
                page,
                per_page: 15,
                role: roleFilter?.value || undefined,
                search: searchInput?.value || undefined,
            },
        });

        renderRows(data.data || []);
        renderPagination(paginationEl, data.pagination, loadUsers);
    } catch (error) {
        rowsEl.innerHTML = `<tr><td colspan="4"><div class="empty-state"><strong>${t('common.error_generic')}</strong></div></td></tr>`;
        showToast(apiErrorMessage(error, t('common.error_generic')), 'error');
    }
}

rowsEl?.addEventListener('change', async (event) => {
    const select = event.target.closest('[data-role-select]');

    if (!select) {
        return;
    }

    const userId = select.dataset.roleSelect;
    const previousRole = select.dataset.currentRole;
    const newRole = select.value;

    select.disabled = true;

    try {
        const confirmed = await confirmDialog({
            title: t('confirm.change_role_title'),
            message: t('confirm.change_role_message'),
            confirmText: t('confirm.change_role_confirm'),
            cancelText: t('common.cancel'),
            onConfirm: () => api.patch(`/admin/users/${userId}/role`, { role: newRole }),
        });

        if (!confirmed) {
            select.value = previousRole;

            return;
        }

        select.dataset.currentRole = newRole;
        showToast(t('admin.role_updated'));
    } catch (error) {
        select.value = previousRole;
        showToast(apiErrorMessage(error, t('common.error_generic')), 'error');
    } finally {
        select.disabled = false;
    }
});

rowsEl?.addEventListener('click', async (event) => {
    const unbanBtn = event.target.closest('[data-unban]');
    const banBtn = event.target.closest('[data-ban]');

    if (unbanBtn) {
        try {
            const confirmed = await confirmDialog({
                title: t('confirm.unban_user_title'),
                message: t('confirm.unban_user_message'),
                confirmText: t('confirm.unban_user_confirm'),
                cancelText: t('common.cancel'),
                onConfirm: () => api.delete(`/admin/users/${unbanBtn.dataset.unban}/ban`),
            });

            if (!confirmed) {
                return;
            }

            showToast(t('admin.user_unbanned'));
            loadUsers(currentPage);
        } catch (error) {
            showToast(apiErrorMessage(error, t('common.error_generic')), 'error');
        }

        return;
    }

    if (banBtn) {
        openBanModal(banBtn.dataset.ban);
    }
});

function openBanModal(userId) {
    const { close, modal } = openModal({
        title: t('confirm.ban_user_title'),
        bodyHtml: `
            <p style="margin:0 0 14px;">${t('confirm.ban_user_message')}</p>
            <div class="field-group">
                <label class="field-label">${t('admin.ban_reason')}</label>
                <textarea class="field-input" rows="3" data-ban-reason style="height:auto;"></textarea>
            </div>
            <div class="field-group">
                <label class="field-label">${t('admin.ban_ends_at')}</label>
                <input class="field-input" type="datetime-local" data-ban-ends-at>
            </div>
        `,
        footerHtml: `
            <button type="button" class="btn btn--outline btn--sm" data-action="cancel">${t('common.cancel')}</button>
            <button type="button" class="btn btn--danger btn--sm" data-action="confirm">${t('confirm.ban_user_confirm')}</button>
        `,
    });

    modal.querySelector('[data-action="cancel"]').addEventListener('click', close);

    modal.querySelector('[data-action="confirm"]').addEventListener('click', async () => {
        const confirmBtn = modal.querySelector('[data-action="confirm"]');
        const cancelBtn = modal.querySelector('[data-action="cancel"]');
        const originalLabel = confirmBtn.textContent;

        confirmBtn.disabled = true;
        cancelBtn.disabled = true;
        confirmBtn.innerHTML = `<span class="btn__spinner" aria-hidden="true"></span>${originalLabel}`;

        const reason = modal.querySelector('[data-ban-reason]').value || undefined;
        const endsAtRaw = modal.querySelector('[data-ban-ends-at]').value;
        const ends_at = endsAtRaw ? new Date(endsAtRaw).toISOString() : undefined;

        try {
            await api.post(`/admin/users/${userId}/ban`, { reason, ends_at });

            showToast(t('admin.user_banned'));
            close();
            loadUsers(currentPage);
        } catch (error) {
            showToast(apiErrorMessage(error, t('common.error_generic')), 'error');
            confirmBtn.disabled = false;
            cancelBtn.disabled = false;
            confirmBtn.textContent = originalLabel;
        }
    });
}

roleFilter?.addEventListener('change', () => loadUsers(1));

searchInput?.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => loadUsers(1), 350);
});

loadUsers();
