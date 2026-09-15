import { api } from '../axios';
import { t } from '../shared/i18n';
import { notificationItemHtml } from '../shared/notification-renderers';
import { renderPagination } from '../shared/pagination';
import { emptyState } from '../shared/skeleton';
import { showToast, apiErrorMessage } from '../shared/toast';

const list = document.querySelector('[data-notif-center-list]');
const paginationEl = document.querySelector('[data-notif-pagination]');
const filterButtons = document.querySelectorAll('[data-notif-filter]');
const markAllBtn = document.querySelector('[data-notif-mark-all-page]');

let currentFilter = '';
let currentPage = 1;

async function load(page = 1) {
    currentPage = page;
    list.innerHTML = `<div class="skeleton skeleton-row" style="margin:12px;"></div>`;

    const params = { page, per_page: 15 };

    if (currentFilter === 'unread') {
        params.unread = true;
    } else if (currentFilter) {
        params.type = currentFilter;
    }

    try {
        const { data } = await api.get('/notifications', { params });
        const items = data.data || [];

        list.innerHTML = items.length
            ? `<div style="padding:6px;">${items.map(notificationItemHtml).join('')}</div>`
            : emptyState(t('notifications.empty'));

        renderPagination(paginationEl, data.pagination, load);
    } catch (error) {
        list.innerHTML = emptyState(apiErrorMessage(error, t('common.error_generic')));
    }
}

list.addEventListener('click', async (event) => {
    const item = event.target.closest('[data-notif-id]');

    if (!item) {
        return;
    }

    try {
        await api.post(`/notifications/${item.dataset.notifId}/read`);
        item.classList.remove('notif-item--unread');
        item.querySelector('.notif-item__dot')?.remove();
    } catch {
        // Non-critical.
    }

    const url = item.dataset.notifUrl;

    if (url) {
        window.location.href = url;
    }
});

filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
        filterButtons.forEach((btn) => {
            btn.classList.toggle('btn--secondary', btn === button);
            btn.classList.toggle('btn--outline', btn !== button);
        });

        currentFilter = button.dataset.notifFilter;
        load(1);
    });
});

markAllBtn?.addEventListener('click', async () => {
    markAllBtn.disabled = true;

    try {
        await api.post('/notifications/read-all');
        load(currentPage);
    } catch (error) {
        showToast(apiErrorMessage(error, t('common.error_generic')), 'error');
    } finally {
        markAllBtn.disabled = false;
    }
});

load();
