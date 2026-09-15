import { escapeHtml } from './forms';
import { t } from './i18n';

/**
 * One renderer per notification `type` — add a new type here (icon + copy)
 * instead of growing an if/else chain anywhere a notification gets drawn.
 * Both the header dropdown and the full Notification Center render off of
 * this same map, so there's exactly one place that knows what each type
 * looks like.
 */
const RENDERERS = {
    system: {
        icon: '⚙',
        title: (n) => n.title || t('notifications.type_system'),
    },
    message: {
        icon: '✉',
        title: (n) => n.title || t('notifications.type_message'),
    },
    mention: {
        icon: '@',
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
            <span class="notif-item__icon" aria-hidden="true">${renderer.icon}</span>
            <span class="notif-item__body">
                <span class="notif-item__title">
                    ${escapeHtml(renderer.title(notification))}
                    ${unread ? '<span class="notif-item__dot" aria-hidden="true"></span>' : ''}
                </span>
                ${notification.body ? `<span class="notif-item__text">${escapeHtml(notification.body)}</span>` : ''}
                <span class="notif-item__time">${relativeTime(notification.created_at)}</span>
            </span>
        </button>
    `;
}
