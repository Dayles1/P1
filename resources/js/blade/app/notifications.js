import { api } from '../axios';
import { fetchCurrentUser } from '../shared/auth-state';
import { getEcho } from '../shared/echo';
import { t } from '../shared/i18n';
import {
    markNotificationReadAndOpen,
    notificationItemHtml,
} from '../shared/notification-renderers';
import { bootOnPage } from '../shared/page-boot';
import { renderPagination } from '../shared/pagination';
import { emptyState } from '../shared/skeleton';
import { showToast, apiErrorMessage } from '../shared/toast';

let currentCleanup = null;

/**
 * Everything below used to run once at module top level. Under Turbo
 * Drive, `<main>` (and everything in it) is replaced by fresh server
 * HTML on every navigation, but this module is only ever evaluated once
 * per session — so all of this is wrapped in `boot()` and re-run via
 * `bootOnPage` on every `turbo:load` that lands on /notifications, re-
 * querying the (new) DOM each time instead of operating on detached
 * nodes from a previous visit. The AbortController removes this visit's
 * DOM listeners on `teardown()`, and the same teardown leaves the Echo
 * private channel subscribed by this visit so live updates don't stack
 * duplicate `prependLive` calls the next time this page boots.
 */
function boot() {
    const controller = new AbortController();
    const { signal } = controller;

    const list = document.querySelector('[data-notif-center-list]');
    const paginationEl = document.querySelector('[data-notif-pagination]');
    const filterButtons = document.querySelectorAll('[data-notif-filter]');
    const markAllBtn = document.querySelector('[data-notif-mark-all-page]');

    let currentFilter = '';
    let currentPage = 1;
    let subscribedChannelName = null;

    async function load(page = 1) {
        currentPage = page;
        list.innerHTML = `<div class="skeleton skeleton-row m-3"></div>`;

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
                ? `<div class="p-2">${items.map(notificationItemHtml).join('')}</div>`
                : emptyState(t('notifications.empty'));

            renderPagination(paginationEl, data.pagination, load);
        } catch (error) {
            list.innerHTML = emptyState(
                apiErrorMessage(error, t('common.error_generic')),
            );
        }
    }

    list.addEventListener(
        'click',
        (event) => {
            const item = event.target.closest('[data-notif-id]');

            if (!item) {
                return;
            }

            item.classList.remove('notif-item--unread');
            item.querySelector('.notif-item__dot')?.remove();

            markNotificationReadAndOpen(api, {
                id: item.dataset.notifId,
                action_url: item.dataset.notifUrl,
                data: {
                    conversation_id: item.dataset.notifConversationId || null,
                    message_id: item.dataset.notifMessageId || null,
                },
            });
        },
        { signal },
    );

    filterButtons.forEach((button) => {
        button.addEventListener(
            'click',
            () => {
                filterButtons.forEach((btn) => {
                    btn.classList.toggle('btn--secondary', btn === button);
                    btn.classList.toggle('btn--outline', btn !== button);
                });

                currentFilter = button.dataset.notifFilter;
                load(1);
            },
            { signal },
        );
    });

    markAllBtn?.addEventListener(
        'click',
        async () => {
            markAllBtn.disabled = true;

            try {
                await api.post('/notifications/read-all');
                load(currentPage);
            } catch (error) {
                showToast(
                    apiErrorMessage(error, t('common.error_generic')),
                    'error',
                );
            } finally {
                markAllBtn.disabled = false;
            }
        },
        { signal },
    );

    load();

    /*
    |--------------------------------------------------------------------------
    | Live updates — a new notification lands on top instantly if it matches
    | whatever's currently being viewed (page 1, and the active filter, if
    | any). Anything else (a later page, or a filtered-out type) just isn't
    | shown yet, exactly like a fresh page load wouldn't show it either.
    |--------------------------------------------------------------------------
    */

    function matchesCurrentFilter(notification) {
        if (!currentFilter || currentFilter === 'unread') {
            return true;
        }

        return notification.type === currentFilter;
    }

    function prependLive(notification) {
        if (currentPage !== 1 || !matchesCurrentFilter(notification)) {
            return;
        }

        const wrapper = list.querySelector(':scope > div');

        if (wrapper) {
            wrapper.insertAdjacentHTML(
                'afterbegin',
                notificationItemHtml(notification),
            );
        } else {
            list.innerHTML = `<div class="p-2">${notificationItemHtml(notification)}</div>`;
        }
    }

    (async () => {
        const user = await fetchCurrentUser();

        if (!user) {
            return;
        }

        subscribedChannelName = `App.Models.User.${user.id}`;
        const channel = getEcho()?.private(subscribedChannelName);

        channel?.notification(prependLive);

        // Reflects reads that happened elsewhere — another tab, or reading
        // the underlying message in Chat — without a manual refresh.
        channel?.listen('.notifications.read', (payload) => {
            (payload.ids || []).forEach((id) => {
                const item = list.querySelector(`[data-notif-id="${id}"]`);

                if (item?.classList.contains('notif-item--unread')) {
                    item.classList.remove('notif-item--unread');
                    item.querySelector('.notif-item__dot')?.remove();
                }
            });
        });
    })();

    currentCleanup = () => {
        controller.abort();

        if (subscribedChannelName) {
            getEcho()?.leave(subscribedChannelName);
        }
    };
}

function teardown() {
    currentCleanup?.();
    currentCleanup = null;
}

bootOnPage('[data-notif-center-list]', boot, teardown);
