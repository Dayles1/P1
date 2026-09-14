import { api } from '../axios';
import { showToast, apiErrorMessage } from '../shared/toast';
import { openModal } from '../shared/modal';
import { t } from '../shared/i18n';
import { escapeHtml } from '../shared/forms';
import { fetchCurrentUser, initials } from '../shared/auth-state';

const shell = document.querySelector('[data-chat-shell]');
const listEl = document.querySelector('[data-chat-list]');
const searchInput = document.querySelector('[data-chat-search]');
const threadHeader = document.querySelector('[data-chat-thread-header]');
const threadAvatar = document.querySelector('[data-chat-thread-avatar]');
const threadTitle = document.querySelector('[data-chat-thread-title]');
const messagesEl = document.querySelector('[data-chat-messages]');
const composer = document.querySelector('[data-chat-composer]');
const composerInput = document.querySelector('[data-chat-input]');
const backBtn = document.querySelector('[data-chat-back]');

let conversations = [];
let activeConversation = null;
let pollTimer = null;
let searchTimer = null;

/*
|--------------------------------------------------------------------------
| Conversation list
|--------------------------------------------------------------------------
*/

function renderConversationList() {
    if (!conversations.length) {
        listEl.innerHTML = `<div class="empty-state"><strong>${t('chat.empty_list')}</strong></div>`;

        return;
    }

    listEl.innerHTML = conversations
        .map((conversation) => `
            <button
                type="button"
                class="chat-list-item ${activeConversation?.id === conversation.id ? 'chat-list-item--active' : ''}"
                data-conversation-id="${conversation.id}"
            >
                <span class="avatar avatar--md">
                    ${conversation.avatar ? `<img class="avatar__image" src="${conversation.avatar}" alt="">` : `<span class="avatar__initials">${initials(conversation.title)}</span>`}
                </span>
                <div class="chat-list-item__body">
                    <div class="chat-list-item__title-row">
                        <span class="chat-list-item__name">${escapeHtml(conversation.title || t('common.unknown'))}</span>
                        <span class="chat-list-item__time">${conversation.last_message_at ? conversation.last_message_at.split(' ').pop() : ''}</span>
                    </div>
                    <div class="chat-list-item__preview">${escapeHtml(conversation.last_message?.body || '')}</div>
                </div>
                ${conversation.unread_count > 0 ? `<span class="chat-list-item__unread">${conversation.unread_count}</span>` : ''}
            </button>
        `)
        .join('');
}

async function loadConversations(search = '') {
    listEl.innerHTML = `<div class="skeleton skeleton-row" style="margin:10px;"></div>`;

    try {
        const { data } = await api.get('/conversations', {
            params: { type: 'all', search: search || undefined, per_page: 30 },
        });

        conversations = data.data || [];
        renderConversationList();
    } catch (error) {
        listEl.innerHTML = `<div class="empty-state"><strong>${t('chat.load_error')}</strong></div>`;
        showToast(apiErrorMessage(error, t('chat.load_error')), 'error');
    }
}

/*
|--------------------------------------------------------------------------
| Thread
|--------------------------------------------------------------------------
*/

function renderMessages(messages) {
    if (!messages.length) {
        messagesEl.innerHTML = `<div class="empty-state"><strong>${t('chat.empty_messages')}</strong></div>`;

        return;
    }

    // API returns newest-first; display oldest-at-top.
    const ordered = [...messages].reverse();

    messagesEl.innerHTML = ordered
        .map((message) => `
            <div class="chat-bubble-row ${message.is_mine ? 'chat-bubble-row--mine' : ''}">
                <div class="chat-bubble">
                    ${escapeHtml(message.body)}
                    <span class="chat-bubble__time">${message.created_at ?? ''}</span>
                </div>
            </div>
        `)
        .join('');

    messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function loadMessages(conversationId, { silent = false } = {}) {
    if (!silent) {
        messagesEl.innerHTML = `<div class="skeleton skeleton-row"></div>`;
    }

    try {
        const { data } = await api.get(`/conversations/${conversationId}/messages`, {
            params: { per_page: 50 },
        });

        renderMessages(data.data || []);
    } catch (error) {
        if (!silent) {
            messagesEl.innerHTML = `<div class="empty-state"><strong>${t('chat.messages_error')}</strong></div>`;
            showToast(apiErrorMessage(error, t('chat.messages_error')), 'error');
        }
    }
}

function stopPolling() {
    if (pollTimer) {
        window.clearInterval(pollTimer);
        pollTimer = null;
    }
}

function openConversation(conversation) {
    activeConversation = conversation;
    shell.dataset.view = 'conversation';

    threadHeader.hidden = false;
    composer.hidden = false;

    threadTitle.textContent = conversation.title || t('common.unknown');
    threadAvatar.innerHTML = conversation.avatar
        ? `<img class="avatar__image" src="${conversation.avatar}" alt="">`
        : `<span class="avatar__initials">${initials(conversation.title)}</span>`;

    renderConversationList();
    loadMessages(conversation.id);

    conversation.unread_count = 0;

    stopPolling();
    pollTimer = window.setInterval(() => loadMessages(conversation.id, { silent: true }), 5000);
}

listEl?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-conversation-id]');

    if (!button) {
        return;
    }

    const conversation = conversations.find((c) => String(c.id) === button.dataset.conversationId);

    if (conversation) {
        openConversation(conversation);
    }
});

backBtn?.addEventListener('click', () => {
    shell.dataset.view = 'list';
    stopPolling();
});

/*
|--------------------------------------------------------------------------
| Composer
|--------------------------------------------------------------------------
*/

composer?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const body = composerInput.value.trim();

    if (!body || !activeConversation) {
        return;
    }

    composerInput.disabled = true;

    try {
        await api.post(`/conversations/${activeConversation.id}/messages`, { body });

        composerInput.value = '';
        loadMessages(activeConversation.id, { silent: true });
    } catch (error) {
        showToast(apiErrorMessage(error, t('chat.send_error')), 'error');
    } finally {
        composerInput.disabled = false;
        composerInput.focus();
    }
});

composerInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        composer.requestSubmit();
    }
});

/*
|--------------------------------------------------------------------------
| Search (conversation list)
|--------------------------------------------------------------------------
*/

searchInput?.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => loadConversations(searchInput.value), 300);
});

/*
|--------------------------------------------------------------------------
| New conversation — user picker shared by private/group flows
|--------------------------------------------------------------------------
*/

function userPickerModal({ multi }) {
    const selected = new Map();

    const { close, modal } = openModal({
        title: multi ? t('chat.start_group') : t('chat.start_private'),
        bodyHtml: `
            ${multi ? `<div class="field-group"><input class="field-input" data-group-title placeholder="${t('chat.group_name_placeholder')}"></div>` : ''}
            <div class="field-group">
                <input class="field-input" type="search" data-user-query placeholder="${t('common.search')}" autocomplete="off">
            </div>
            <div data-user-results style="max-height:220px; overflow-y:auto;"></div>
            ${multi ? '<div data-selected-users style="margin-top:10px; display:flex; flex-wrap:wrap; gap:6px;"></div>' : ''}
        `,
        footerHtml: `
            <button type="button" class="btn btn--outline btn--sm" data-action="cancel">${t('common.cancel')}</button>
            <button type="button" class="btn btn--primary btn--sm" data-action="confirm" ${multi ? 'disabled' : 'hidden'}>${t('chat.create')}</button>
        `,
    });

    const queryInput = modal.querySelector('[data-user-query]');
    const resultsEl = modal.querySelector('[data-user-results]');
    const selectedEl = modal.querySelector('[data-selected-users]');
    const confirmBtn = modal.querySelector('[data-action="confirm"]');

    modal.querySelector('[data-action="cancel"]').addEventListener('click', close);

    function renderSelected() {
        if (!selectedEl) {
            return;
        }

        selectedEl.innerHTML = [...selected.values()]
            .map((user) => `<span class="pill pill--primary">${escapeHtml(user.name)} <button type="button" data-remove-user="${user.id}" style="border:none;background:none;color:inherit;cursor:pointer;">&times;</button></span>`)
            .join('');

        confirmBtn.disabled = selected.size === 0;
    }

    async function searchUsers(query) {
        if (query.length < 2) {
            resultsEl.innerHTML = '';

            return;
        }

        try {
            const { data } = await api.get('/chat/users/search', { params: { q: query } });
            const users = (data.data || []).filter((u) => !selected.has(u.id));

            resultsEl.innerHTML = users
                .map((user) => `
                    <button type="button" class="dropdown__item" data-pick-user='${escapeHtml(JSON.stringify(user))}'>
                        ${escapeHtml(user.name)} <span style="color:var(--ui-text-muted); font-size:11.5px;">${escapeHtml(user.email)}</span>
                    </button>
                `)
                .join('') || `<div class="field-hint" style="padding:8px;">${t('chat.empty_list')}</div>`;
        } catch {
            resultsEl.innerHTML = '';
        }
    }

    let queryTimer = null;
    queryInput.addEventListener('input', () => {
        window.clearTimeout(queryTimer);
        queryTimer = window.setTimeout(() => searchUsers(queryInput.value.trim()), 250);
    });

    resultsEl.addEventListener('click', async (event) => {
        const pick = event.target.closest('[data-pick-user]');

        if (!pick) {
            return;
        }

        const user = JSON.parse(pick.dataset.pickUser);

        if (!multi) {
            close();
            await createConversation({ type: 'private', user_ids: [user.id] });

            return;
        }

        selected.set(user.id, user);
        renderSelected();
        queryInput.value = '';
        resultsEl.innerHTML = '';
    });

    selectedEl?.addEventListener('click', (event) => {
        const remove = event.target.closest('[data-remove-user]');

        if (remove) {
            selected.delete(Number(remove.dataset.removeUser));
            renderSelected();
        }
    });

    confirmBtn.addEventListener('click', async () => {
        const title = modal.querySelector('[data-group-title]')?.value.trim();

        if (multi && !title) {
            showToast(t('chat.group_name_placeholder'), 'warning');

            return;
        }

        close();
        await createConversation({ type: 'group', title, user_ids: [...selected.keys()] });
    });

    queryInput.focus();
}

async function createConversation(payload) {
    try {
        const { data } = await api.post('/conversations', payload);

        await loadConversations();

        const created = conversations.find((c) => c.id === data.data.id) || {
            id: data.data.id,
            title: data.data.title,
            avatar: data.data.avatar,
            unread_count: 0,
        };

        openConversation(created);
    } catch (error) {
        showToast(apiErrorMessage(error, t('common.error_generic')), 'error');
    }
}

document.querySelector('[data-start-private]')?.addEventListener('click', () => userPickerModal({ multi: false }));
document.querySelector('[data-start-group]')?.addEventListener('click', () => userPickerModal({ multi: true }));

/*
|--------------------------------------------------------------------------
| Boot
|--------------------------------------------------------------------------
*/

(async () => {
    await fetchCurrentUser();
    await loadConversations();

    const match = window.location.pathname.match(/\/chat\/(\d+)/);

    if (match) {
        const conversation = conversations.find((c) => String(c.id) === match[1]);

        if (conversation) {
            openConversation(conversation);
        }
    }
})();

window.addEventListener('beforeunload', stopPolling);
