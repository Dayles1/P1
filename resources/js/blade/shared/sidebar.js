import { api } from '../axios';
import { avatarHue } from './auth-state';
import { escapeHtml } from './forms';

/** Pinned chats listed in the sidebar at most. */
const PINNED_LIMIT = 6;

/** A visit sooner than this after the last refresh reuses it. */
const REFRESH_MS = 20000;

let lastRefresh = 0;

/**
 * The count at the end of a sidebar row: hidden at zero, "99+" past 99.
 */
function paintCount(key, count) {
    document.querySelectorAll(`[data-sidebar-count="${key}"]`).forEach((el) => {
        el.hidden = count <= 0;
        el.textContent = count > 99 ? '99+' : String(count);
    });
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

    section.hidden = pinned.length === 0;
    list.innerHTML = pinned
        .map(
            (conversation) => `
                <a href="/chat/${conversation.id}" class="sidebar-pinned__link" data-nav-link="sidebar-pinned__link">
                    <span class="sidebar-pinned__mark sidebar-pinned__mark--${avatarHue(conversation.title || '')}" aria-hidden="true"></span>
                    <span class="sidebar-pinned__name truncate">${escapeHtml(conversation.title || '')}</span>
                    ${conversation.unread_count > 0 ? `<span class="mono sidebar-link__count">${conversation.unread_count > 99 ? '99+' : conversation.unread_count}</span>` : ''}
                </a>
            `,
        )
        .join('');
}

/**
 * Unread chats and pinned conversations for the permanent sidebar,
 * refreshed on page visits (not more often than every REFRESH_MS).
 */
async function refresh() {
    if (Date.now() - lastRefresh < REFRESH_MS) {
        return;
    }

    lastRefresh = Date.now();

    try {
        const { data } = await api.get('/conversations', {
            params: { type: 'all', per_page: 50 },
        });
        const conversations = data.data || [];

        paintCount(
            'chat',
            conversations.reduce(
                (sum, conversation) => sum + (conversation.unread_count || 0),
                0,
            ),
        );
        paintPinned(conversations);
    } catch {
        // The sidebar still works without the counts.
    }
}

export function initSidebar() {
    if (!document.getElementById('app-sidebar')) {
        return;
    }

    refresh();
    document.addEventListener('turbo:load', refresh);
}
