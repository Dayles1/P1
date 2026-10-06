import { isConversationActive } from './active-context';
import { pushNotification, setNotifications } from './app-state';
import { getEcho, onReconnect } from './echo';
import { t } from './i18n';
import {
    interpolate,
    markNotificationReadAndOpen,
    normalizeNotification,
    notificationItemHtml,
    notificationPlainText,
    notificationTitle,
    pluralKey,
} from './notification-renderers';
import { playNotificationSound } from './notification-sound';
import { emptyState, errorState } from './skeleton';
import { showToast, apiErrorMessage } from './toast';
import { getUserSettings } from './user-settings-cache';

/** Types that are a chat message — quiet while that chat is open on screen. */
const MESSAGE_TYPES = ['message', 'mention', 'reply'];

/** "(3) " at the front of the tab title while something is unread. */
const TITLE_COUNT = /^\(\d+\+?\)\s/;

/**
 * Header bell: unread badge + a dropdown of recent notifications, kept live
 * over the private `App.Models.User.{id}` Reverb channel the backend
 * broadcasts every notification on (see BaseNotification::toBroadcast).
 *
 * No request at boot: the unread count comes with `/auth/me`
 * (`user.unread_notifications_count`), the recent list is fetched the
 * first time the dropdown opens, and everything after that arrives over
 * the socket. If the socket drops and comes back, whatever was missed is
 * fetched again (the count, and the list if it was loaded).
 */
export function initNotificationBell(api, user) {
    const list = document.querySelector('[data-notif-list]');
    const markAllBtn = document.querySelector('[data-notif-mark-all]');
    const dropdown = document.querySelector('[data-notif-dropdown]');

    if (!list || !user) {
        return;
    }

    let unreadCount = 0;
    let listLoaded = false;
    let listLoading = null;
    let items = [];

    /** The browser/sound switches, read when needed so a change in Settings applies at once. */
    async function deliveryPrefs() {
        try {
            const settings = await getUserSettings(api);
            const meta = settings?.meta?.notifications || {};

            return {
                browser: meta.browser !== false,
                sound: meta.sound !== false,
            };
        } catch {
            return { browser: true, sound: true };
        }
    }

    /** "(3) Chat — App" while anything is unread; the page's own title otherwise. */
    function applyTitle() {
        const base = document.title.replace(TITLE_COUNT, '');
        const next =
            unreadCount > 0
                ? interpolate('notifications.title_unread', {
                      count: unreadCount > 99 ? '99+' : String(unreadCount),
                      title: base,
                  })
                : base;

        if (document.title !== next) {
            document.title = next;
        }
    }

    // Pages (and Turbo visits) set their own titles — put the count back.
    new MutationObserver(() => {
        if (unreadCount > 0 ? !TITLE_COUNT.test(document.title) : false) {
            applyTitle();
        }
    }).observe(document.head, {
        childList: true,
        subtree: true,
        characterData: true,
    });

    /**
     * Every unread indicator in the chrome: the bell dot, the tab-bar dot,
     * the count next to "Notifications" in the account menu
     * (`[data-notif-badge-count]`), the popover's "N new" pill and the tab
     * title.
     */
    function updateBadge(count) {
        unreadCount = Math.max(0, Number(count) || 0);

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

        applyTitle();
        setNotifications({ unreadCount });
    }

    async function maybeAlert(notification) {
        const type = notification.type;
        const conversationId =
            notification.data?.conversation_id ?? notification.conversation_id;

        // The message already landed live in the open conversation — a
        // toast, a ding and an OS popup on top of that would just be noise.
        if (
            MESSAGE_TYPES.includes(type) &&
            conversationId &&
            isConversationActive(conversationId)
        ) {
            return;
        }

        const prefs = await deliveryPrefs();
        const title = notificationTitle(notification);
        const text = notificationPlainText(notification);
        const open = () =>
            markNotificationReadAndOpen(
                api,
                normalizeNotification(notification),
            );

        if (prefs.sound) {
            playNotificationSound();
        }

        if (document.visibilityState === 'visible') {
            showToast(text, 'info', {
                title,
                action: { label: t('common.view'), onClick: open },
            });

            return;
        }

        // The OS popup is for when the tab is not in front.
        if (
            prefs.browser &&
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted'
        ) {
            const popup = new Notification(title, {
                body: text,
                tag: `notification-${notification.id}`,
            });

            popup.onclick = () => {
                window.focus();
                open();
                popup.close();
            };
        }
    }

    function renderList() {
        list.innerHTML = items.length
            ? items.map(notificationItemHtml).join('')
            : emptyState(t('notifications.empty'));
    }

    function prependToDropdown(notification) {
        items = [notification, ...items].slice(0, 8);
        renderList();
    }

    function onNotificationCreated(notification) {
        pushNotification(notification);
        updateBadge(unreadCount + 1);
        maybeAlert(notification);

        // Not loaded yet: the first opening fetches it, this one included.
        if (listLoaded) {
            prependToDropdown(notification);
        }
    }

    async function refreshCount() {
        try {
            const { data } = await api.get('/notifications/unread-count');
            updateBadge(data.data.count);
        } catch {
            // The badge keeps what it had.
        }
    }

    function loadList() {
        listLoading ??= api
            .get('/notifications', { params: { per_page: 8 } })
            .then(({ data }) => {
                items = data.data || [];
                listLoaded = true;
                renderList();
                setNotifications({ items });
            })
            .catch(() => {
                list.innerHTML = errorState(t('notifications.load_error'));
            })
            .finally(() => {
                listLoading = null;
            });

        return listLoading;
    }

    list.addEventListener('click', (event) => {
        if (event.target.closest('[data-retry]')) {
            loadList();

            return;
        }

        const item = event.target.closest('[data-notif-id]');

        if (!item) {
            return;
        }

        if (item.classList.contains('notif-item--unread')) {
            markItemsRead([item.dataset.notifId]);
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

    function markItemsRead(ids) {
        const readAt = new Date().toISOString();

        ids.forEach((id) => {
            const stored = items.find((n) => String(n.id) === String(id));

            if (stored && !stored.read_at) {
                stored.read_at = readAt;
            }

            const row = list.querySelector(
                `[data-notif-id="${CSS.escape(String(id))}"]`,
            );

            if (row?.classList.contains('notif-item--unread')) {
                row.classList.remove('notif-item--unread');
                row.querySelector('.notif-item__dot')?.remove();
            }
        });
    }

    markAllBtn?.addEventListener('click', async () => {
        try {
            await api.post('/notifications/read-all');
            markItemsRead(items.map((n) => n.id));
            updateBadge(0);
        } catch (error) {
            showToast(
                apiErrorMessage(error, t('common.error_generic')),
                'error',
            );
        }
    });

    // The list is fetched the first time the dropdown opens; after that
    // the socket keeps it current.
    dropdown
        ?.querySelector('[data-dropdown-trigger]')
        ?.addEventListener('click', () => {
            window.setTimeout(() => {
                const open = !dropdown
                    .querySelector('[data-dropdown-menu]')
                    ?.hasAttribute('hidden');

                if (open && !listLoaded) {
                    loadList();
                }
            }, 0);
        });

    // The count came with /auth/me; ask only if it somehow did not.
    if (Number.isFinite(user.unread_notifications_count)) {
        updateBadge(user.unread_notifications_count);
    } else {
        refreshCount();
    }

    const channel = getEcho()?.private(`App.Models.User.${user.id}`);

    channel?.notification((notification) =>
        onNotificationCreated(notification),
    );

    // Keeps this tab's badge/list correct even when the read happened
    // somewhere else entirely — another tab's bell/Notification Center, or
    // reading the underlying message in Chat (see MarkNotificationsRead).
    channel?.listen('.notifications.read', (payload) => {
        updateBadge(payload.unread_count ?? 0);
        markItemsRead(payload.ids || []);
    });

    // Anything broadcast while the socket was down was missed.
    onReconnect(() => {
        refreshCount();

        if (listLoaded) {
            loadList();
        }
    });
}
