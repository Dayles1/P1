import { isConversationActive } from './active-context';
import { pushNotification, setNotifications } from './app-state';
import { getEcho } from './echo';
import { t } from './i18n';
import { notificationItemHtml } from './notification-renderers';
import { playNotificationSound } from './notification-sound';
import { emptyState } from './skeleton';
import { showToast, apiErrorMessage } from './toast';
import { getUserSettings } from './user-settings-cache';

/**
 * Header bell: unread badge + a dropdown of recent notifications, kept live
 * over the same private `App.Models.User.{id}` Reverb channel the backend
 * already broadcasts every notification on (see BaseNotification::via) —
 * one fetch on boot to get the current count/list, then push for
 * everything after that. No polling loop.
 */
export function initNotificationBell(api, user) {
    const badge = document.querySelector('[data-notif-badge]');
    const list = document.querySelector('[data-notif-list]');
    const markAllBtn = document.querySelector('[data-notif-mark-all]');
    const dropdown = document.querySelector('[data-notif-dropdown]');

    if (!badge || !list || !user) {
        return;
    }

    let unreadCount = 0;
    let prefs = { browser: true, sound: true };

    getUserSettings(api)
        .then((settings) => {
            const meta = settings?.meta?.notifications || {};
            prefs = {
                browser: meta.browser !== false,
                sound: meta.sound !== false,
            };
        })
        .catch(() => {});

    function updateBadge(count) {
        unreadCount = Math.max(0, count);
        badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        badge.hidden = unreadCount === 0;
    }

    /** Same target resolution for a dropdown click and an OS notification click — a full nav when we're not already in the chat app, an in-page event when we are, so a click never causes a redundant reload of the same chat page. */
    function openNotificationTarget(notification) {
        const conversationId = notification.data?.conversation_id;
        const messageId = notification.data?.message_id;

        if (conversationId && window.location.pathname.startsWith('/chat')) {
            document.dispatchEvent(
                new CustomEvent('chat:open-conversation', {
                    detail: {
                        conversationId: Number(conversationId),
                        messageId: messageId ? Number(messageId) : null,
                    },
                }),
            );

            return;
        }

        if (!notification.action_url) {
            return;
        }

        const url = new URL(notification.action_url, window.location.origin);

        if (messageId) {
            url.searchParams.set('message', messageId);
        }

        window.location.href = url.pathname + url.search;
    }

    function maybeAlert(notification) {
        const conversationId = notification.data?.conversation_id;

        // The message already landed live in the open conversation — an OS
        // popup + ding on top of that would just be noise for something
        // the user is already looking at.
        if (conversationId && isConversationActive(conversationId)) {
            return;
        }

        if (prefs.sound) {
            playNotificationSound();
        }

        if (
            prefs.browser &&
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted'
        ) {
            const renderer =
                notification.type === 'mention'
                    ? t('notifications.type_mention')
                    : notification.title;
            const popup = new Notification(
                renderer || t('notifications.label'),
                {
                    body: notification.body || '',
                    tag: `notification-${notification.id}`,
                },
            );

            popup.onclick = () => {
                window.focus();
                openNotificationTarget(notification);
                popup.close();
            };
        }
    }

    function prependToDropdown(notification) {
        const empty = list.querySelector('.empty-state');

        if (empty) {
            empty.remove();
        }

        list.insertAdjacentHTML(
            'afterbegin',
            notificationItemHtml(notification),
        );

        // Keep the dropdown from growing unbounded across a long session.
        const items = list.querySelectorAll('[data-notif-id]');

        if (items.length > 8) {
            items[items.length - 1].remove();
        }
    }

    function onNotificationCreated(notification) {
        updateBadge(unreadCount + 1);
        prependToDropdown(notification);
        maybeAlert(notification);
        pushNotification(notification);
    }

    async function loadInitial() {
        try {
            const [{ data: recent }, { data: countData }] = await Promise.all([
                api.get('/notifications', { params: { per_page: 8 } }),
                api.get('/notifications/unread-count'),
            ]);

            const items = recent.data || [];
            list.innerHTML = items.length
                ? items.map(notificationItemHtml).join('')
                : emptyState(t('notifications.empty'));
            updateBadge(countData.data.count);
            setNotifications({ items, unreadCount: countData.data.count });
        } catch {
            // Silent — the bell just stays at its initial (empty) state until the dropdown is opened, which retries.
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

        if (item.classList.contains('notif-item--unread')) {
            item.classList.remove('notif-item--unread');
            item.querySelector('.notif-item__dot')?.remove();
            updateBadge(unreadCount - 1);
        }

        openNotificationTarget({
            action_url: item.dataset.notifUrl,
            data: {
                conversation_id: item.dataset.notifConversationId || null,
                message_id: item.dataset.notifMessageId || null,
            },
        });
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
            showToast(
                apiErrorMessage(error, t('common.error_generic')),
                'error',
            );
        }
    });

    // The (heavier) recent list is already kept live via the socket, so
    // opening the dropdown just needs the very first load — no re-fetch.
    let loaded = false;

    dropdown
        ?.querySelector('[data-dropdown-trigger]')
        ?.addEventListener('click', () => {
            window.setTimeout(() => {
                if (
                    !loaded &&
                    !dropdown
                        .querySelector('[data-dropdown-menu]')
                        ?.hasAttribute('hidden')
                ) {
                    loaded = true;
                    loadInitial();
                }
            }, 0);
        });

    loadInitial();

    const echo = getEcho();
    echo?.private(`App.Models.User.${user.id}`).notification((notification) =>
        onNotificationCreated(notification),
    );
}
