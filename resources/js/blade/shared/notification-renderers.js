import { escapeHtml } from './forms';
import { t } from './i18n';
import { icon } from './icon';

/**
 * One renderer per notification `type` — add a new type here (icon + copy)
 * instead of growing an if/else chain anywhere a notification gets drawn.
 * Both the header dropdown and the full Notification Center render off of
 * this same map, so there's exactly one place that knows what each type
 * looks like.
 */
const RENDERERS = {
    system: {
        icon: 'info',
        title: (n) => n.title || t('notifications.type_system'),
    },
    message: {
        icon: 'chat',
        title: (n) => n.title || t('notifications.type_message'),
    },
    mention: {
        icon: 'user',
        title: (n) => n.title || t('notifications.type_mention'),
    },
};

function relativeTime(iso) {
    if (!iso) {
        return '';
    }

    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.round(diffMs / 60000);

    if (minutes < 1) {
        return t('notifications.just_now');
    }

    if (minutes < 60) {
        return t('notifications.minutes_ago', { count: minutes });
    }

    const hours = Math.round(minutes / 60);

    if (hours < 24) {
        return t('notifications.hours_ago', { count: hours });
    }

    const days = Math.round(hours / 24);

    return t('notifications.days_ago', { count: days });
}

/**
 * Same target resolution for a dropdown click, a Notification Center
 * click, and an OS notification popup click — dispatches an in-page event
 * when we're already on /chat (so the persistent app shell isn't torn
 * down for a same-page conversation switch), otherwise a Turbo soft-visit
 * for an internal route so the shell survives, falling back to a real
 * navigation only for an external/non-Turbo target.
 */
export function openNotificationTarget(notification) {
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

    const target = url.pathname + url.search;

    if (window.Turbo && url.origin === window.location.origin) {
        window.Turbo.visit(target);
    } else {
        window.location.href = target;
    }
}

/**
 * Marks a notification read (fire-and-forget — the realtime
 * `notifications.read` broadcast is the authoritative sync, this is just
 * for instant feedback) and opens its target. Shared by the bell dropdown,
 * the Notification Center, and an OS notification popup click so all three
 * behave identically instead of three hand-rolled copies.
 */
export function markNotificationReadAndOpen(api, notification) {
    if (notification.id) {
        api.post(`/notifications/${notification.id}/read`).catch(() => {});
    }

    openNotificationTarget(notification);
}

/** Renders one notification as a clickable row — used in both the dropdown and the center page. */
export function notificationItemHtml(notification) {
    const renderer = RENDERERS[notification.type] || RENDERERS.system;
    const unread = !notification.read_at;

    return `
        <button
            type="button"
            class="notif-item ${unread ? 'notif-item--unread' : ''} notif-item--${notification.type}"
            data-notif-id="${notification.id}"
            data-notif-url="${escapeHtml(notification.action_url || '')}"
            ${notification.data?.conversation_id ? `data-notif-conversation-id="${notification.data.conversation_id}"` : ''}
            ${notification.data?.message_id ? `data-notif-message-id="${notification.data.message_id}"` : ''}
        >
            <span class="notif-item__icon">${icon(renderer.icon, { size: 16 })}</span>
            <span class="notif-item__body">
                <span class="notif-item__title">${escapeHtml(renderer.title(notification))}</span>
                ${notification.body ? `<span class="notif-item__text">${escapeHtml(notification.body)}</span>` : ''}
                <span class="notif-item__time">${relativeTime(notification.created_at)}</span>
            </span>
            ${unread ? '<span class="notif-item__dot" aria-hidden="true"></span>' : ''}
        </button>
    `;
}
