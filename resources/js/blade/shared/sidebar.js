import { api } from '../axios';
import { avatarHue } from './auth-state';
import { getEcho, onReconnect } from './echo';
import { escapeHtml } from './forms';
import { t } from './i18n';

/** Pinned chats listed in the sidebar at most. */
const PINNED_LIMIT = 6;

/** A visit sooner than this after the last refresh reuses it. */
const REFRESH_MS = 20000;

/** Bursts of live events (a busy group) collapse into one request. */
const DEBOUNCE_MS = 400;

let lastRefresh = 0;
let unreadTimer = null;
let pinnedTimer = null;

/** Ids of the chats the pinned list shows — their counts change live. */
let pinnedIds = new Set();

/**
 * The count at the end of a sidebar row: hidden at zero, "99+" past 99.
 */
function paintCount(key, count) {
    document.querySelectorAll(`[data-sidebar-count="${key}"]`).forEach((el) => {
        el.hidden = count <= 0;
        el.textContent = count > 99 ? '99+' : String(count);
    });
}

function conversationTitle(conversation) {
    return conversation.is_saved
        ? t('chat.saved_messages')
        : conversation.title || '';
}

function paintPinned(conversations) {
    const section = document.querySelector('[data-sidebar-pinned]');
    const list = document.querySelector('[data-sidebar-pinned-list]');

    if (!section || !list) {
        return;
    }

    const pinned = conversations
        .filter((conversation) => conversation.is_pinned)
        .slice(0, PINNED_LIMIT);

    pinnedIds = new Set(pinned.map((conversation) => String(conversation.id)));
    section.hidden = pinned.length === 0;
    list.innerHTML = pinned
        .map(
            (conversation) => `
                <a href="/chat/${Number(conversation.id)}" class="sidebar-pinned__link" data-nav-link="sidebar-pinned__link">
                    <span class="sidebar-pinned__mark sidebar-pinned__mark--${escapeHtml(avatarHue(conversationTitle(conversation)))}" aria-hidden="true"></span>
                    <span class="sidebar-pinned__name truncate">${escapeHtml(conversationTitle(conversation))}</span>
                    ${conversation.unread_count > 0 ? `<span class="mono sidebar-link__count">${conversation.unread_count > 99 ? '99+' : Number(conversation.unread_count)}</span>` : ''}
                </a>
            `,
        )
        .join('');
}

/** Only the total: `GET /conversations/unread` is one cheap query. */
async function refreshUnread() {
    try {
        const { data } = await api.get('/conversations/unread');
        paintCount('chat', Number(data.data?.total) || 0);
    } catch {
        // The sidebar still works without the count.
    }
}

/** The pinned chats (and the count with them) — the full first page. */
async function refreshPinned() {
    try {
        const { data } = await api.get('/conversations', {
            params: { folder: 'all', per_page: 50 },
        });
        paintPinned(data.data || []);
    } catch {
        // Pinned chats just stay as they were.
    }
}

/**
 * Unread chats and pinned conversations for the permanent sidebar,
 * refreshed on page visits (not more often than every REFRESH_MS).
 */
async function refresh({ force = false } = {}) {
    if (!force && Date.now() - lastRefresh < REFRESH_MS) {
        return;
    }

    lastRefresh = Date.now();
    await Promise.all([refreshUnread(), refreshPinned()]);
}

function scheduleUnread() {
    window.clearTimeout(unreadTimer);
    unreadTimer = window.setTimeout(refreshUnread, DEBOUNCE_MS);
}

function schedulePinned() {
    window.clearTimeout(pinnedTimer);
    pinnedTimer = window.setTimeout(refreshPinned, DEBOUNCE_MS);
}

/**
 * `user` is the signed-in user, for their own realtime channel. A new
 * message or a read only re-asks the unread total; the pinned list is
 * fetched again only when a chat's settings or membership change.
 */
export function initSidebar(user) {
    if (!document.getElementById('app-sidebar')) {
        return;
    }

    refresh();
    document.addEventListener('turbo:load', () => refresh());
    document.addEventListener('sidebar:refresh', () =>
        refresh({ force: true }),
    );
    document.addEventListener('sidebar:unread', (event) => {
        scheduleUnread();

        if (pinnedIds.has(String(event.detail?.conversationId))) {
            schedulePinned();
        }
    });

    if (user?.id) {
        getEcho()
            ?.private(`App.Models.User.${user.id}`)
            .listen('.message.sent', (payload) => {
                scheduleUnread();

                if (pinnedIds.has(String(payload?.conversation_id))) {
                    schedulePinned();
                }
            })
            .listen('.message.deleted', scheduleUnread)
            .listen('.message.read', (payload) => {
                if (String(payload?.user_id) === String(user.id)) {
                    scheduleUnread();

                    if (pinnedIds.has(String(payload?.conversation_id))) {
                        schedulePinned();
                    }
                }
            })
            .listen('.conversation.settings', () => {
                scheduleUnread();
                schedulePinned();
            })
            .listen('.conversation.updated', schedulePinned)
            .listen('.conversation.removed', () => {
                scheduleUnread();
                schedulePinned();
            })
            .listen('.conversation.activity', () => {
                scheduleUnread();
                schedulePinned();
            });
        onReconnect(() => refresh({ force: true }));
    }
}
