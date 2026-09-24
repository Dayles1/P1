import { isConversationActive } from './active-context';
import { pushNotification, setNotifications } from './app-state';
import { getEcho } from './echo';
import { t } from './i18n';
import {
    markNotificationReadAndOpen,
    notificationItemHtml,
    pluralKey,
} from './notification-renderers';
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
    const list = document.querySelector('[data-notif-list]');
    const markAllBtn = document.querySelector('[data-notif-mark-all]');
    const dropdown = document.querySelector('[data-notif-dropdown]');

    if (!list || !user) {
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

    /**
     * Every unread indicator in the chrome: the bell dot, the tab-bar dot,
     * the count next to "Notifications" in the account menu
     * (`[data-notif-badge-count]`) and the popover's "N new" pill.
     */
    function updateBadge(count) {
        unreadCount = Math.max(0, count);

        const label = unreadCount > 99 ? '99+' : String(unreadCount);

        document.querySelectorAll('[data-notif-badge]').forEach((el) => {
            el.hidden = unreadCount === 0;

            if (el.hasAttribute('data-notif-badge-count')) {
                el.textContent = label;
            }
        });

        // "1 новое" / "3 новых" / "5 новых" — the plural form for the count.
        document.querySelectorAll('[data-notif-new-count]').forEach((el) => {
            el.hidden = unreadCount === 0;
            el.textContent = t(
                pluralKey('notifications.new_count_forms', unreadCount),
                { count: label },
            );
        });

        // "Read all" has nothing to do once everything is read.
        if (markAllBtn) {
            markAllBtn.disabled = unreadCount === 0;
        }
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
                markNotificationReadAndOpen(api, notification);
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

    list.addEventListener('click', (event) => {
        const item = event.target.closest('[data-notif-id]');

        if (!item) {
            return;
        }

        if (item.classList.contains('notif-item--unread')) {
            item.classList.remove('notif-item--unread');
            item.querySelector('.notif-item__dot')?.remove();
            updateBadge(unreadCount - 1);
        }

        markNotificationReadAndOpen(api, {
            id: item.dataset.notifId,
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
    const channel = echo?.private(`App.Models.User.${user.id}`);

    channel?.notification((notification) =>
        onNotificationCreated(notification),
    );

    // Keeps this tab's badge/list correct even when the read happened
    // somewhere else entirely — another tab's bell/Notification Center, or
    // reading the underlying message in Chat (see MarkNotificationsRead).
    channel?.listen('.notifications.read', (payload) => {
        updateBadge(payload.unread_count ?? 0);

        (payload.ids || []).forEach((id) => {
            const item = list.querySelector(`[data-notif-id="${id}"]`);

            if (item?.classList.contains('notif-item--unread')) {
                item.classList.remove('notif-item--unread');
                item.querySelector('.notif-item__dot')?.remove();
            }
        });
    });
}
