import { t } from './i18n';
import { notificationItemHtml } from './notification-renderers';
import { emptyState } from './skeleton';
import { showToast, apiErrorMessage } from './toast';
import { getUserSettings } from './user-settings-cache';

const POLL_MS = 30000;

/**
 * Header bell: unread badge (polled — replaced by a real push once Reverb
 * lands) + a dropdown of recent notifications. Fires a browser notification
 * for any *new* unread item seen since the bell was initialized, gated by
 * the user's `browser` preference — permission itself is only ever
 * requested from the Settings toggle, never from here.
 */
export function initNotificationBell(api) {
    const badge = document.querySelector('[data-notif-badge]');
    const list = document.querySelector('[data-notif-list]');
    const markAllBtn = document.querySelector('[data-notif-mark-all]');
    const dropdown = document.querySelector('[data-notif-dropdown]');

    if (!badge || !list) {
        return;
    }

    const seenIds = new Set();
    let firstPoll = true;
    let browserPrefEnabled = true;

    getUserSettings(api)
        .then((settings) => {
            browserPrefEnabled = settings?.meta?.notifications?.browser !== false;
        })
        .catch(() => {});

    function updateBadge(count) {
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : String(count);
            badge.hidden = false;
        } else {
            badge.hidden = true;
        }
    }

    function maybeFireBrowser(notification) {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
            return;
        }

        if (!browserPrefEnabled) {
            return;
        }

        const renderer = notification.type === 'mention' ? t('notifications.type_mention') : notification.title;

        new Notification(renderer || t('notifications.label'), {
            body: notification.body || '',
            tag: `notification-${notification.id}`,
        });
    }

    async function pollUnread() {
        try {
            const { data } = await api.get('/notifications', { params: { unread: true, per_page: 5 } });
            const items = data.data || [];

            const { data: countData } = await api.get('/notifications/unread-count');
            updateBadge(countData.data.count);

            if (!firstPoll) {
                items.filter((n) => !seenIds.has(n.id)).forEach((n) => maybeFireBrowser(n));
            }

            items.forEach((n) => seenIds.add(n.id));
            firstPoll = false;
        } catch {
            // Silent — this is a background poll, not a user-initiated action.
        }
    }

    async function loadRecent() {
        list.innerHTML = `<div class="skeleton skeleton-row" style="margin:8px;"></div>`;

        try {
            const { data } = await api.get('/notifications', { params: { per_page: 8 } });
            const items = data.data || [];

            list.innerHTML = items.length
                ? items.map(notificationItemHtml).join('')
                : emptyState(t('notifications.empty'));
        } catch (error) {
            list.innerHTML = emptyState(apiErrorMessage(error, t('common.error_generic')));
        }
    }

    async function markRead(id) {
        try {
            await api.post(`/notifications/${id}/read`);
        } catch {
            // Non-critical — the item just stays marked unread visually until next reload.
        }
    }

    list.addEventListener('click', (event) => {
        const item = event.target.closest('[data-notif-id]');

        if (!item) {
            return;
        }

        markRead(item.dataset.notifId);
        item.classList.remove('notif-item--unread');
        item.querySelector('.notif-item__dot')?.remove();
        pollUnread();

        const url = item.dataset.notifUrl;

        if (url) {
            window.location.href = url;
        }
    });

    markAllBtn?.addEventListener('click', async () => {
        try {
            await api.post('/notifications/read-all');
            list.querySelectorAll('.notif-item--unread').forEach((el) => {
                el.classList.remove('notif-item--unread');
                el.querySelector('.notif-item__dot')?.remove();
            });
            updateBadge(0);
        } catch (error) {
            showToast(apiErrorMessage(error, t('common.error_generic')), 'error');
        }
    });

    // Only fetch the (heavier) recent list when the dropdown is actually
    // opened — deferred a tick so this reads the DOM *after* site-chrome's
    // own delegated click listener has already toggled `hidden`, regardless
    // of which of the two listeners happened to be registered first.
    dropdown?.querySelector('[data-dropdown-trigger]')?.addEventListener('click', () => {
        window.setTimeout(() => {
            if (!dropdown.querySelector('[data-dropdown-menu]')?.hasAttribute('hidden')) {
                loadRecent();
            }
        }, 0);
    });

    pollUnread();
    window.setInterval(pollUnread, POLL_MS);
}
