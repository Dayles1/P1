import { api } from '../axios';
import { setActiveConversationId } from '../shared/active-context';
import { fetchCurrentUser, initials } from '../shared/auth-state';
import { confirmDialog } from '../shared/confirm';
import { openContextMenu, attachLongPress } from '../shared/context-menu';
import { getEcho } from '../shared/echo';
import { escapeHtml } from '../shared/forms';
import { t } from '../shared/i18n';
import { renderMessageBody, mentionToken } from '../shared/mentions';
import { openModal } from '../shared/modal';
import { isOnline, onPresenceChange, initPresence } from '../shared/presence';
import { emptyState } from '../shared/skeleton';
import { showToast, apiErrorMessage } from '../shared/toast';

/*
|--------------------------------------------------------------------------
| DOM
|--------------------------------------------------------------------------
*/

const shell = document.querySelector('[data-chat-shell]');
const threadPane = document.querySelector('[data-chat-thread-pane]');
const listEl = document.querySelector('[data-chat-list]');
const searchInput = document.querySelector('[data-chat-search]');
const threadHeader = document.querySelector('[data-chat-thread-header]');
const threadAvatar = document.querySelector('[data-chat-thread-avatar]');
const threadTitle = document.querySelector('[data-chat-thread-title]');
const threadStatus = document.querySelector('[data-chat-thread-status]');
const pinnedBar = document.querySelector('[data-chat-pinned-bar]');
const pinnedText = document.querySelector('[data-chat-pinned-text]');
const messagesEl = document.querySelector('[data-chat-messages]');
const typingEl = document.querySelector('[data-chat-typing]');
const scrollBottomBtn = document.querySelector('[data-chat-scroll-bottom]');
const replyPreview = document.querySelector('[data-chat-reply-preview]');
const replyPreviewText = document.querySelector(
    '[data-chat-reply-preview-text]',
);
const editPreview = document.querySelector('[data-chat-edit-preview]');
const composer = document.querySelector('[data-chat-composer]');
const composerInput = document.querySelector('[data-chat-input]');
const composerAttachmentsEl = document.querySelector(
    '[data-chat-composer-attachments]',
);
const fileInput = document.querySelector('[data-chat-file-input]');
const mentionsEl = document.querySelector('[data-chat-mentions]');
const backBtn = document.querySelector('[data-chat-back]');
const searchPanel = document.querySelector('[data-chat-search-panel]');
const searchPanelInput = document.querySelector('[data-chat-search-input]');
const searchPanelResults = document.querySelector('[data-chat-search-results]');
const detailsContent = document.querySelector('[data-chat-details-content]');

/*
|--------------------------------------------------------------------------
| State
|--------------------------------------------------------------------------
*/

let currentUser = null;
let conversations = [];
let activeConversation = null;
let messages = []; // oldest-first, currently loaded page for the active conversation
let members = []; // full member list of the active conversation (for mentions/details)
const subscribedChannels = new Map(); // conversationId -> Echo channel
const typingByConversation = new Map(); // conversationId -> Map(userId -> {name, timer})
let replyTarget = null;
let editTarget = null;
let pendingAttachments = [];
let searchTimer = null;
let mentionQuery = null; // {start, end} range in the textarea when the autocomplete is open
let globalSearchMode = false;

const DRAFT_PREFIX = 'chat-draft-';

/*
|--------------------------------------------------------------------------
| Drafts (localStorage, per conversation)
|--------------------------------------------------------------------------
*/

function loadDraft(conversationId) {
    try {
        return localStorage.getItem(DRAFT_PREFIX + conversationId) || '';
    } catch {
        return '';
    }
}

function saveDraft(conversationId, value) {
    try {
        if (value) {
            localStorage.setItem(DRAFT_PREFIX + conversationId, value);
        } else {
            localStorage.removeItem(DRAFT_PREFIX + conversationId);
        }
    } catch {
        // Storage unavailable (private mode etc) — drafts just don't persist.
    }
}

let draftSaveTimer = null;

function scheduleDraftSave() {
    if (!activeConversation) {
        return;
    }

    window.clearTimeout(draftSaveTimer);
    draftSaveTimer = window.setTimeout(
        () => saveDraft(activeConversation.id, composerInput.value),
        300,
    );
}

/*
|--------------------------------------------------------------------------
| Conversation list
|--------------------------------------------------------------------------
*/

function conversationSubtitle(conversation) {
    const typing = [
        ...(typingByConversation.get(conversation.id)?.values() || []),
    ].map((u) => u.name);

    if (typing.length === 1) {
        return `<span class="chat-list-item__typing">${escapeHtml(t('chat.is_typing', { name: typing[0] }))}</span>`;
    }

    if (typing.length > 1) {
        return `<span class="chat-list-item__typing">${escapeHtml(t('chat.are_typing'))}</span>`;
    }

    const last = conversation.last_message;

    if (!last) {
        return `<span>${escapeHtml(t('chat.empty_messages'))}</span>`;
    }

    const prefix = last.sender ? `${escapeHtml(last.sender)}: ` : '';

    return `<span>${prefix}${escapeHtml(last.body || t('chat.attachment_preview'))}</span>`;
}

function renderConversationList() {
    if (!conversations.length) {
        listEl.innerHTML = emptyState(t('chat.empty_list'));

        return;
    }

    const pinned = conversations.filter((c) => c.is_pinned);
    const rest = conversations.filter((c) => !c.is_pinned);

    const row = (conversation) => {
        const online = conversation.other_user_id
            ? isOnline(conversation.other_user_id)
            : false;

        return `
            <button
                type="button"
                class="chat-list-item ${activeConversation?.id === conversation.id ? 'chat-list-item--active' : ''}"
                data-conversation-id="${conversation.id}"
            >
                <span class="avatar avatar--md chat-list-item__avatar">
                    ${conversation.avatar ? `<img class="avatar__image" src="${conversation.avatar}" alt="">` : `<span class="avatar__initials">${initials(conversation.title)}</span>`}
                    ${online ? '<span class="chat-list-item__online-dot"></span>' : ''}
                </span>
                <div class="chat-list-item__body">
                    <div class="chat-list-item__title-row">
                        <span class="chat-list-item__name">
                            ${conversation.is_pinned ? '<span class="chat-list-item__pin-icon" aria-hidden="true">&#128204;</span>' : ''}
                            ${escapeHtml(conversation.title || t('common.unknown'))}
                        </span>
                        <span class="chat-list-item__time">${conversation.last_message_at ? conversation.last_message_at.split(' ').pop() : ''}</span>
                    </div>
                    <div class="chat-list-item__preview">${conversationSubtitle(conversation)}</div>
                </div>
                ${conversation.unread_count > 0 ? `<span class="chat-list-item__unread">${conversation.unread_count}</span>` : ''}
            </button>
        `;
    };

    listEl.innerHTML = `
        ${pinned.length ? `<div class="chat-list-section-label">${t('chat.pinned_conversations')}</div>${pinned.map(row).join('')}` : ''}
        ${rest.map(row).join('')}
    `;
}

async function loadConversations(search = '') {
    if (!search) {
        listEl.innerHTML = `<div class="skeleton skeleton-row" style="margin:10px;"></div>`;
    }

    try {
        const { data } = await api.get('/conversations', {
            params: { type: 'all', search: search || undefined, per_page: 50 },
        });

        conversations = data.data || [];
        renderConversationList();
        conversations.forEach((c) => subscribeToConversation(c.id));
    } catch (error) {
        listEl.innerHTML = emptyState(t('chat.load_error'));
        showToast(apiErrorMessage(error, t('chat.load_error')), 'error');
    }
}

function updateConversationSummary(conversationId, patch) {
    const conversation = conversations.find((c) => c.id === conversationId);

    if (conversation) {
        Object.assign(conversation, patch);
    }

    renderConversationList();
}

/*
|--------------------------------------------------------------------------
| Realtime subscriptions
|--------------------------------------------------------------------------
*/

function subscribeToConversation(id) {
    if (subscribedChannels.has(id)) {
        return;
    }

    const echo = getEcho();

    if (!echo) {
        return;
    }

    const channel = echo
        .private(`conversation.${id}`)
        .listen('.message.sent', (payload) => onMessageSent(id, payload))
        .listen('.message.edited', (payload) => onMessageEdited(id, payload))
        .listen('.message.deleted', (payload) => onMessageDeleted(id, payload))
        .listen('.message.reaction.toggled', (payload) =>
            onReactionToggled(id, payload),
        )
        .listen('.message.read', (payload) => onMessageReadEvent(id, payload))
        .listen('.user.typing', (payload) => onUserTyping(id, payload));

    subscribedChannels.set(id, channel);
}

function unsubscribeAll() {
    const echo = getEcho();

    subscribedChannels.forEach((_, id) => echo?.leave(`conversation.${id}`));
    subscribedChannels.clear();
}

/*
|--------------------------------------------------------------------------
| Realtime event handlers
|--------------------------------------------------------------------------
*/

function markMessageMine(message) {
    return {
        ...message,
        is_mine: Number(message.sender?.id) === Number(currentUser?.id),
    };
}

/*
|--------------------------------------------------------------------------
| Per-conversation message cache
|--------------------------------------------------------------------------
|
| Every conversation channel is subscribed to as soon as it appears in the
| list (see subscribeToConversation), whether or not it's the one currently
| open — so realtime events for a *background* conversation still land here
| and keep its cache correct. Re-opening a conversation already visited
| this session then just re-renders from cache instead of re-fetching, and
| still ends up consistent with anything that happened while it was in the
| background (spec: cache must reconcile via Reverb events, not go stale).
|
| Each entry: { messages: [oldest...newest], hasMoreOlder, ids: Set<id> }
| `ids` is the actual dedup source of truth — message ids, not array
| position — since the same message can arrive twice (our own send's HTTP
| response *and* the broadcast echoing back, see ingestMessage).
*/
const MAX_MESSAGES_IN_MEMORY = 200;
const INITIAL_CHUNK_SIZE = 10;
const INITIAL_PREWARM_CHUNKS = 2; // beyond the first, loaded quietly in the background
const conversationCache = new Map();

function getCache(conversationId) {
    if (!conversationCache.has(conversationId)) {
        conversationCache.set(conversationId, {
            messages: [],
            hasMoreOlder: true,
            ids: new Set(),
        });
    }

    return conversationCache.get(conversationId);
}

function isActive(conversationId) {
    return activeConversation?.id === conversationId;
}

/**
 * Handles a message arriving both from our own successful send (the
 * synchronous HTTP response, `is_mine` already correct) and from the
 * `.message.sent` broadcast (which reaches every participant, our own
 * other tabs included — there's no per-socket exclusion wired up, so this
 * function has to be safe to call twice for the same message). Message id
 * is the only thing that decides "have I already got this", never array
 * position or count.
 */
function ingestMessage(conversationId, message) {
    const cache = getCache(conversationId);

    if (cache.ids.has(message.id)) {
        return;
    }

    cache.ids.add(message.id);
    cache.messages.push(message);

    if (cache.messages.length > MAX_MESSAGES_IN_MEMORY) {
        const dropped = cache.messages.shift();
        cache.ids.delete(dropped.id);
        cache.hasMoreOlder = true; // we just trimmed our own tail, so there's always "more" above it now

        if (isActive(conversationId)) {
            messagesEl
                .querySelector(`[data-message-id="${dropped.id}"]`)
                ?.remove();
        }
    }

    if (isActive(conversationId)) {
        const wasAtBottom = isScrolledToBottom();
        appendMessageDOM(message);

        if (message.is_mine || wasAtBottom) {
            scrollToBottom();
            markRead(conversationId, message.id);
        } else {
            scrollBottomBtn.hidden = false;
        }
    }

    updateConversationSummary(conversationId, {
        last_message: {
            body: message.body,
            sender: message.sender?.name,
            type: message.type,
        },
        last_message_at: message.created_at,
        unread_count: isActive(conversationId)
            ? 0
            : (conversations.find((c) => c.id === conversationId)
                  ?.unread_count || 0) + (message.is_mine ? 0 : 1),
    });

    clearTyping(conversationId, message.sender?.id);
}

function onMessageSent(conversationId, payload) {
    ingestMessage(conversationId, markMessageMine(payload));
}

function onMessageEdited(conversationId, payload) {
    const message = markMessageMine(payload);
    const cache = getCache(conversationId);
    const index = cache.messages.findIndex((m) => m.id === message.id);

    if (index === -1) {
        return;
    }

    cache.messages[index] = message;

    if (isActive(conversationId)) {
        patchMessageDOM(message);
    }
}

function onMessageDeleted(conversationId, payload) {
    const cache = getCache(conversationId);
    const index = cache.messages.findIndex((m) => m.id === payload.message_id);

    if (index === -1) {
        return;
    }

    // Mutates in place (splice) rather than `filter()` + reassign — the
    // module-level `messages` alias (see openConversation) points at this
    // exact array instance, and a reassignment would silently detach it.
    cache.messages.splice(index, 1);
    cache.ids.delete(payload.message_id);

    if (isActive(conversationId)) {
        // `index` now points at whoever took the removed message's place
        // (post-splice) — i.e. the message that followed it, if any.
        removeMessageDOM(
            payload.message_id,
            cache.messages[index] ?? null,
            index,
        );
    }
}

function onReactionToggled(conversationId, payload) {
    const cache = getCache(conversationId);
    const message = cache.messages.find((m) => m.id === payload.message_id);

    if (!message) {
        return;
    }

    message.reactions = payload.reactions;

    if (isActive(conversationId)) {
        patchMessageDOM(message);
    }
}

function onMessageReadEvent(conversationId, payload) {
    // The backend marks "read up to and including this id" in one batch
    // (see MarkMessageRead), so the event means the same thing here — not
    // just the one message id it carries.
    const cache = getCache(conversationId);
    const active = isActive(conversationId);

    cache.messages
        .filter((m) => m.id <= payload.message_id)
        .forEach((message) => {
            if (!message.read_by?.includes(payload.user_id)) {
                message.read_by = [
                    ...new Set([...(message.read_by || []), payload.user_id]),
                ];

                if (active) {
                    patchMessageDOM(message);
                }
            }
        });
}

function onUserTyping(conversationId, payload) {
    if (Number(payload.user_id) === Number(currentUser?.id)) {
        return;
    }

    if (!typingByConversation.has(conversationId)) {
        typingByConversation.set(conversationId, new Map());
    }

    const bucket = typingByConversation.get(conversationId);
    window.clearTimeout(bucket.get(payload.user_id)?.timer);

    const timer = window.setTimeout(() => {
        bucket.delete(payload.user_id);
        renderTypingIndicator();
        renderConversationList();
    }, 4000);

    bucket.set(payload.user_id, { name: payload.user_name, timer });
    renderTypingIndicator();
    renderConversationList();
}

function clearTyping(conversationId, userId) {
    const bucket = typingByConversation.get(conversationId);
    const entry = bucket?.get(userId);

    if (entry) {
        window.clearTimeout(entry.timer);
        bucket.delete(userId);
        renderTypingIndicator();
    }
}

function renderTypingIndicator() {
    if (!activeConversation) {
        typingEl.textContent = '';

        return;
    }

    const names = [
        ...(typingByConversation.get(activeConversation.id)?.values() || []),
    ].map((u) => u.name);

    if (!names.length) {
        typingEl.textContent = '';
    } else if (names.length === 1) {
        typingEl.textContent = t('chat.is_typing', { name: names[0] });
    } else {
        typingEl.textContent = t('chat.are_typing');
    }
}

/*
|--------------------------------------------------------------------------
| Message rendering
|--------------------------------------------------------------------------
*/

function dayLabel(iso) {
    if (!iso) {
        return '';
    }

    const date = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const sameDay = (a, b) => a.toDateString() === b.toDateString();

    if (sameDay(date, today)) {
        return t('chat.today');
    }

    if (sameDay(date, yesterday)) {
        return t('chat.yesterday');
    }

    return date.toLocaleDateString();
}

function reactionBar(message) {
    if (!message.reactions?.length) {
        return '';
    }

    return `
        <div class="chat-bubble__reactions">
            ${message.reactions
                .map(
                    (r) => `
                <button
                    type="button"
                    class="chat-reaction-pill ${r.user_ids.includes(currentUser?.id) ? 'chat-reaction-pill--mine' : ''}"
                    data-react="${message.id}"
                    data-emoji="${r.emoji}"
                >${r.emoji} ${r.count}</button>
            `,
                )
                .join('')}
        </div>
    `;
}

function readTicks(message) {
    if (!message.is_mine) {
        return '';
    }

    const otherReaders = (message.read_by || []).filter(
        (id) => Number(id) !== Number(currentUser?.id),
    );
    const isRead = otherReaders.length > 0;

    return `<span class="chat-bubble__ticks ${isRead ? 'chat-bubble__ticks--read' : ''}" title="${isRead ? t('chat.read') : t('chat.sent')}">${isRead ? '✓✓' : '✓'}</span>`;
}

function attachmentsHtml(message) {
    if (!message.attachments?.length) {
        return '';
    }

    return `
        <div class="chat-bubble__attachments">
            ${message.attachments
                .map((a) => {
                    if ((a.mime_type || '').startsWith('image/')) {
                        return `<img class="chat-attachment-image" src="${a.url}" alt="${escapeHtml(a.original_name || '')}" data-lightbox="${a.url}">`;
                    }

                    return `
                    <a class="chat-attachment-file" href="${a.url}" target="_blank" rel="noopener" download>
                        <span class="chat-attachment-file__icon" aria-hidden="true">&#128196;</span>
                        <span class="chat-attachment-file__name">${escapeHtml(a.original_name || '')}</span>
                    </a>
                `;
                })
                .join('')}
        </div>
    `;
}

/** Telegram-style grouping: same sender, same day, within 5 minutes of the previous message — no repeated name label, tighter spacing. */
function isGroupedWithPrevious(previous, current) {
    if (
        !previous ||
        Number(previous.sender?.id) !== Number(current.sender?.id)
    ) {
        return false;
    }

    if (
        dayLabel(previous.created_at_iso) !== dayLabel(current.created_at_iso)
    ) {
        return false;
    }

    const prevTime = previous.created_at_iso
        ? new Date(previous.created_at_iso).getTime()
        : null;
    const currTime = current.created_at_iso
        ? new Date(current.created_at_iso).getTime()
        : null;

    return (
        prevTime !== null &&
        currTime !== null &&
        Math.abs(currTime - prevTime) < 5 * 60 * 1000
    );
}

function bubbleHtml(message, { grouped = false } = {}) {
    const reply = message.reply_to
        ? `
            <button type="button" class="chat-bubble__reply" data-scroll-to="${message.reply_to.id}">
                <span class="chat-bubble__reply-name">${escapeHtml(message.reply_to.sender_name || '')}</span>
                <span class="chat-bubble__reply-text">${escapeHtml(message.reply_to.body || '')}</span>
            </button>
        `
        : '';

    return `
        <div class="chat-bubble-row ${message.is_mine ? 'chat-bubble-row--mine' : ''} ${grouped ? 'chat-bubble-row--grouped' : ''}" data-message-id="${message.id}">
            <div class="chat-bubble-wrap">
                <div class="chat-bubble" data-bubble="${message.id}">
                    ${message.is_pinned ? '<span class="chat-bubble__pin-icon" aria-hidden="true">&#128204;</span>' : ''}
                    ${!message.is_mine && !grouped ? `<span class="chat-bubble__sender">${escapeHtml(message.sender?.name || '')}</span>` : ''}
                    ${reply}
                    ${message.body ? `<div class="chat-bubble__body">${renderMessageBody(message.body)}</div>` : ''}
                    ${attachmentsHtml(message)}
                    <div class="chat-bubble__footer">
                        ${message.edited_at ? `<span class="chat-bubble__edited">${t('chat.edited')}</span>` : ''}
                        <span>${message.created_at ?? ''}</span>
                        ${readTicks(message)}
                    </div>
                    ${reactionBar(message)}
                </div>
            </div>
        </div>
    `;
}

/**
 * Builds the HTML for a run of messages (day dividers + grouping), given
 * whatever message immediately precedes the run in the full timeline (or
 * null if this run starts the conversation) — needed so a prepended older
 * batch groups correctly against the batch already on screen, and so the
 * initial/full render groups correctly within itself.
 */
function messagesHtml(list, precedingMessage) {
    let html = '';
    let previous = precedingMessage;
    let lastDay = precedingMessage
        ? dayLabel(precedingMessage.created_at_iso)
        : null;

    list.forEach((message) => {
        const day = dayLabel(message.created_at_iso);

        if (day !== lastDay) {
            html += `<div class="chat-day-divider">${escapeHtml(day)}</div>`;
            lastDay = day;
            previous = null; // a day boundary always restarts a group, even same sender
        }

        html += bubbleHtml(message, {
            grouped: isGroupedWithPrevious(previous, message),
        });
        previous = message;
    });

    return html;
}

/** Full rebuild — only for the initial open of a conversation (or recovering from an error state). Everything else patches the DOM incrementally. */
function renderMessageList() {
    if (!messages.length) {
        messagesEl.innerHTML = emptyState(t('chat.empty_messages'));
        renderPinnedBar();

        return;
    }

    messagesEl.innerHTML = messagesHtml(messages, null);
    renderPinnedBar();
}

function appendMessageDOM(message) {
    // The caller (ingestMessage) has already pushed `message` onto the
    // array before calling this, so `messages.length` is never 0 here —
    // length === 1 is the "conversation was empty a moment ago" case, and
    // the DOM still shows the emptyState() placeholder from renderMessageList(),
    // not an empty container. A plain append would land the new bubble
    // *after* that stale placeholder instead of replacing it.
    if (messages.length <= 1) {
        renderMessageList();
        scrollToBottom();

        return;
    }

    // The message immediately before this one in the full timeline is
    // whichever one is currently last in the array *before* the caller
    // pushed this one on — i.e. messages[length - 2].
    const previous =
        messages.length >= 2 ? messages[messages.length - 2] : null;
    messagesEl.insertAdjacentHTML(
        'beforeend',
        messagesHtml([message], previous),
    );
    renderPinnedBar();
}

function patchMessageDOM(message, groupedOverride = null) {
    const row = messagesEl.querySelector(`[data-message-id="${message.id}"]`);

    if (!row) {
        return;
    }

    const grouped =
        groupedOverride ?? row.classList.contains('chat-bubble-row--grouped');
    row.outerHTML = bubbleHtml(message, { grouped });
    renderPinnedBar();
}

/** `following`/`followingIndex`: the message (if any) that now sits where the removed one used to be, in the already-spliced array. */
function removeMessageDOM(messageId, following, followingIndex) {
    messagesEl.querySelector(`[data-message-id="${messageId}"]`)?.remove();

    // That message may have only been grouped (no repeated sender label)
    // *because of* the one that just got removed — recompute against its
    // new actual predecessor rather than leaving a stray hidden label.
    if (following) {
        const newPrevious =
            followingIndex > 0 ? messages[followingIndex - 1] : null;
        patchMessageDOM(
            following,
            isGroupedWithPrevious(newPrevious, following),
        );
    }

    if (!messages.length) {
        messagesEl.innerHTML = emptyState(t('chat.empty_messages'));
    }

    renderPinnedBar();
}

/**
 * Prepends an older page (oldest-first) above whatever's currently
 * rendered, without moving the reader's eye — the classic "load more
 * history" scroll-jump bug. Fix: measure scrollHeight before inserting,
 * insert, then add exactly the height that was added back onto scrollTop
 * (browsers don't do this for you; inserting content above the viewport
 * leaves scrollTop numerically unchanged, which visually *is* the jump).
 */
function prependMessagesDOM(olderBatch) {
    const firstCurrent = messages[olderBatch.length] ?? null; // after unshift, this is what was previously first
    const lastOlder = olderBatch[olderBatch.length - 1];
    const heightBefore = messagesEl.scrollHeight;

    // A day boundary at the seam between the new batch and what's already
    // rendered needs its own divider too — messagesHtml() only handles
    // transitions *within* the list it's given, not against content that
    // already exists in the DOM before it.
    const seamNeedsDivider =
        firstCurrent &&
        dayLabel(lastOlder?.created_at_iso) !==
            dayLabel(firstCurrent.created_at_iso);
    const seamHtml = seamNeedsDivider
        ? `<div class="chat-day-divider">${escapeHtml(dayLabel(firstCurrent.created_at_iso))}</div>`
        : '';

    messagesEl.insertAdjacentHTML(
        'afterbegin',
        messagesHtml(olderBatch, null) + seamHtml,
    );

    // The previously-first message was rendered assuming it had no
    // predecessor (grouped: false) — now that older history sits above it,
    // that boundary needs re-evaluating against its real new neighbor
    // (never grouped across a day divider, so skip it in that case).
    if (firstCurrent && !seamNeedsDivider) {
        patchMessageDOM(
            firstCurrent,
            isGroupedWithPrevious(lastOlder, firstCurrent),
        );
    }

    messagesEl.scrollTop += messagesEl.scrollHeight - heightBefore;
    renderPinnedBar();
}

function renderPinnedBar() {
    const pinned = messages.filter((m) => m.is_pinned);

    if (!pinned.length) {
        pinnedBar.hidden = true;

        return;
    }

    pinnedBar.hidden = false;
    const latest = pinned[pinned.length - 1];
    pinnedText.textContent = latest.body || t('chat.attachment_preview');
}

function isScrolledToBottom() {
    return (
        messagesEl.scrollHeight -
            messagesEl.scrollTop -
            messagesEl.clientHeight <
        80
    );
}

function isNearTop() {
    return messagesEl.scrollTop < 120;
}

function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
    scrollBottomBtn.hidden = true;
}

let olderLoadInFlight = false;

async function maybeLoadOlder() {
    if (!activeConversation || olderLoadInFlight) {
        return;
    }

    const cache = getCache(activeConversation.id);

    if (!cache.hasMoreOlder || !isNearTop()) {
        return;
    }

    await loadOlderMessages(activeConversation.id);
}

messagesEl?.addEventListener('scroll', () => {
    if (isScrolledToBottom()) {
        scrollBottomBtn.hidden = true;
    }

    maybeLoadOlder();
});

scrollBottomBtn?.addEventListener('click', () => {
    scrollToBottom();

    if (activeConversation && messages.length) {
        markRead(activeConversation.id, messages[messages.length - 1].id);
    }
});

/*
|--------------------------------------------------------------------------
| Read receipts
|--------------------------------------------------------------------------
*/

async function markRead(conversationId, messageId) {
    try {
        await api.post(
            `/conversations/${conversationId}/messages/${messageId}/read`,
        );
    } catch {
        // Non-critical.
    }
}

/*
|--------------------------------------------------------------------------
| Message history loading
|--------------------------------------------------------------------------
|
| Opening a conversation never fires one big request. It fetches the
| newest INITIAL_CHUNK_SIZE messages, renders them immediately, then keeps
| quietly fetching a couple more chunks further back (sequentially — a
| deliberate choice, not an oversight: awaiting each one before requesting
| the next means there's no concurrent-request ordering to reason about at
| all, which is worth far more here than shaving a few hundred ms off a
| background prefetch). Scrolling near the top of the pane later triggers
| the exact same "load one older chunk" path.
|--------------------------------------------------------------------------
*/

async function fetchMessagePage(conversationId, { beforeId } = {}) {
    const { data } = await api.get(
        `/conversations/${conversationId}/messages`,
        {
            params: { per_page: INITIAL_CHUNK_SIZE, before_id: beforeId },
        },
    );

    // API returns newest-first; this module always works oldest-first.
    return [...(data.data || [])].reverse().map(markMessageMine);
}

/** The one place that mutates a cache's message array in bulk (prepend) — everything else pushes/splices one at a time via ingestMessage/onMessageDeleted. */
function prependToCache(cache, olderBatch) {
    olderBatch.forEach((m) => {
        if (!cache.ids.has(m.id)) {
            cache.ids.add(m.id);
        }
    });

    cache.messages.unshift(
        ...olderBatch.filter(
            (m, i) => olderBatch.findIndex((x) => x.id === m.id) === i,
        ),
    );
}

async function loadOlderMessages(conversationId) {
    const cache = getCache(conversationId);

    if (!cache.hasMoreOlder || olderLoadInFlight) {
        return;
    }

    olderLoadInFlight = true;

    try {
        const oldestId = cache.messages[0]?.id;
        const batch = await fetchMessagePage(conversationId, {
            beforeId: oldestId,
        });

        if (batch.length < INITIAL_CHUNK_SIZE) {
            cache.hasMoreOlder = false;
        }

        if (!batch.length) {
            return;
        }

        prependToCache(cache, batch);

        if (isActive(conversationId)) {
            prependMessagesDOM(batch);
        }
    } catch {
        // A failed "load more" isn't fatal — the user can just scroll/retry; no need for a disruptive toast.
    } finally {
        olderLoadInFlight = false;
    }
}

async function loadMessages(conversationId) {
    const cache = getCache(conversationId);

    if (cache.messages.length) {
        // Already have this conversation cached from earlier this session
        // (and kept correct in the background via realtime events) — no
        // need to hit the network again at all.
        renderMessageList();
        scrollToBottom();
        markRead(conversationId, cache.messages[cache.messages.length - 1].id);
        updateConversationSummary(conversationId, { unread_count: 0 });

        return;
    }

    messagesEl.innerHTML = `<div class="skeleton skeleton-row"></div>`;

    try {
        const firstChunk = await fetchMessagePage(conversationId);

        if (firstChunk.length < INITIAL_CHUNK_SIZE) {
            cache.hasMoreOlder = false;
        }

        prependToCache(cache, firstChunk);

        // The very first paint happens the instant this first small chunk
        // is in — the user is never waiting on the full prewarm below.
        if (isActive(conversationId)) {
            renderMessageList();
            scrollToBottom();
        }

        const last = cache.messages[cache.messages.length - 1];

        if (last) {
            markRead(conversationId, last.id);
        }

        updateConversationSummary(conversationId, { unread_count: 0 });

        // Sequential (awaited each time), not concurrent — see the module
        // docblock above for why that's the deliberate choice here.
        for (
            let i = 0;
            i < INITIAL_PREWARM_CHUNKS && cache.hasMoreOlder;
            i += 1
        ) {
            await loadOlderMessages(conversationId);
        }
    } catch (error) {
        if (isActive(conversationId)) {
            messagesEl.innerHTML = emptyState(t('chat.messages_error'));
            showToast(
                apiErrorMessage(error, t('chat.messages_error')),
                'error',
            );
        }
    }
}

async function loadMembers(conversationId) {
    try {
        const { data } = await api.get(
            `/conversations/${conversationId}/members`,
        );
        members = data.data || [];
    } catch {
        members = [];
    }
}

function otherMemberStatus(conversation) {
    if (conversation.type !== 'private' || !conversation.other_user_id) {
        return '';
    }

    if (isOnline(conversation.other_user_id)) {
        threadStatus.classList.add('chat-thread-header__status--online');

        return t('chat.online');
    }

    threadStatus.classList.remove('chat-thread-header__status--online');

    const member = members.find((m) => m.id === conversation.other_user_id);

    return member?.last_seen_at
        ? t('chat.last_seen', {
              time: new Date(member.last_seen_at).toLocaleString(),
          })
        : '';
}

async function openConversation(conversation) {
    if (activeConversation?.id !== conversation.id) {
        saveDraft(activeConversation?.id, composerInput.value);
        cancelReply();
        cancelEdit();
        pendingAttachments = [];
        renderPendingAttachments();
    }

    activeConversation = conversation;
    setActiveConversationId(conversation.id);
    // The module-level `messages` is an alias for this conversation's cache
    // array — every render/patch function below reads/mutates through it,
    // so re-pointing it here is the one place "switching conversations"
    // actually happens for the message list.
    messages = getCache(conversation.id).messages;
    shell.dataset.view = 'conversation';

    threadHeader.hidden = false;
    composer.hidden = false;

    threadTitle.textContent = conversation.title || t('common.unknown');
    threadAvatar.innerHTML = conversation.avatar
        ? `<img class="avatar__image" src="${conversation.avatar}" alt="">`
        : `<span class="avatar__initials">${initials(conversation.title)}</span>`;

    renderConversationList();
    subscribeToConversation(conversation.id);

    await loadMembers(conversation.id);
    threadStatus.textContent = otherMemberStatus(conversation);

    composerInput.value = loadDraft(conversation.id);
    autoGrow();

    await loadMessages(conversation.id);
    renderTypingIndicator();
    composerInput.focus();
}

listEl?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-conversation-id]');

    if (!button) {
        return;
    }

    const conversation = conversations.find(
        (c) => String(c.id) === button.dataset.conversationId,
    );

    if (conversation) {
        openConversation(conversation);
    }
});

backBtn?.addEventListener('click', () => {
    shell.dataset.view = 'list';
    // Mobile-only affordance (stacked single-pane view) — leaving the
    // thread for the list means this conversation is no longer the one
    // "on screen," so notification suppression for it should lift too.
    setActiveConversationId(null);
});

document
    .querySelector('[data-chat-details-back]')
    ?.addEventListener('click', () => {
        shell.removeAttribute('data-details-open');
        shell.dataset.view = 'conversation';
    });

threadHeader?.addEventListener('click', (event) => {
    if (event.target.closest('[data-chat-back], [data-chat-search-toggle]')) {
        return;
    }

    openDetails();
});

/*
|--------------------------------------------------------------------------
| Presence -> live status updates
|--------------------------------------------------------------------------
*/

onPresenceChange(() => {
    renderConversationList();

    if (activeConversation) {
        threadStatus.textContent = otherMemberStatus(activeConversation);
    }
});

/*
|--------------------------------------------------------------------------
| Composer: send, reply, edit
|--------------------------------------------------------------------------
*/

function autoGrow() {
    composerInput.style.height = 'auto';
    composerInput.style.height = `${Math.min(composerInput.scrollHeight, 120)}px`;
}

function setReplyTarget(message) {
    replyTarget = message;
    editTarget = null;
    editPreview.hidden = true;
    replyPreview.hidden = false;
    replyPreviewText.textContent = message.body || t('chat.attachment_preview');
    composerInput.focus();
}

function cancelReply() {
    replyTarget = null;
    replyPreview.hidden = true;
}

function setEditTarget(message) {
    editTarget = message;
    replyTarget = null;
    replyPreview.hidden = true;
    editPreview.hidden = false;
    composerInput.value = message.body || '';
    autoGrow();
    composerInput.focus();
}

function cancelEdit() {
    editTarget = null;
    editPreview.hidden = true;
    composerInput.value = '';
    autoGrow();
}

document
    .querySelector('[data-chat-reply-cancel]')
    ?.addEventListener('click', cancelReply);
document
    .querySelector('[data-chat-edit-cancel]')
    ?.addEventListener('click', cancelEdit);

function renderPendingAttachments() {
    if (!pendingAttachments.length) {
        composerAttachmentsEl.hidden = true;
        composerAttachmentsEl.innerHTML = '';

        return;
    }

    composerAttachmentsEl.hidden = false;
    composerAttachmentsEl.innerHTML = pendingAttachments
        .map(
            (file, index) => `
            <span class="chat-composer__attachment-chip">
                ${escapeHtml(file.name)}
                <button type="button" data-remove-attachment="${index}" aria-label="${t('common.delete')}">&times;</button>
            </span>
        `,
        )
        .join('');
}

composerAttachmentsEl?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-attachment]');

    if (button) {
        pendingAttachments.splice(Number(button.dataset.removeAttachment), 1);
        renderPendingAttachments();
    }
});

document
    .querySelector('[data-chat-attach]')
    ?.addEventListener('click', () => fileInput.click());

fileInput?.addEventListener('change', () => {
    pendingAttachments.push(...fileInput.files);
    renderPendingAttachments();
    fileInput.value = '';
});

let dragCounter = 0;

threadPane?.addEventListener('dragenter', (event) => {
    if (!activeConversation) {
        return;
    }

    event.preventDefault();
    dragCounter += 1;
    threadPane.setAttribute('data-dragging', '');
});

threadPane?.addEventListener('dragover', (event) => event.preventDefault());

threadPane?.addEventListener('dragleave', () => {
    dragCounter = Math.max(0, dragCounter - 1);

    if (dragCounter === 0) {
        threadPane.removeAttribute('data-dragging');
    }
});

threadPane?.addEventListener('drop', (event) => {
    event.preventDefault();
    dragCounter = 0;
    threadPane.removeAttribute('data-dragging');

    if (!activeConversation) {
        return;
    }

    pendingAttachments.push(...(event.dataTransfer?.files || []));
    renderPendingAttachments();
});

let typingSentAt = 0;

function notifyTyping() {
    if (!activeConversation) {
        return;
    }

    const now = Date.now();

    if (now - typingSentAt < 2000) {
        return;
    }

    typingSentAt = now;
    api.post(`/conversations/${activeConversation.id}/typing`).catch(() => {});
}

composerInput?.addEventListener('input', () => {
    autoGrow();
    scheduleDraftSave();
    notifyTyping();
    handleMentionTyping();
});

composer?.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!activeConversation) {
        return;
    }

    if (editTarget) {
        await submitEdit();

        return;
    }

    const body = composerInput.value.trim();

    if (!body && !pendingAttachments.length) {
        return;
    }

    composerInput.disabled = true;

    try {
        let payload;
        const headers = {};

        if (pendingAttachments.length) {
            payload = new FormData();

            if (body) {
                payload.append('body', body);
            }

            if (replyTarget) {
                payload.append('parent_message_id', replyTarget.id);
            }

            pendingAttachments.forEach((file) =>
                payload.append('attachments[]', file),
            );
            headers['Content-Type'] = 'multipart/form-data';
        } else {
            payload = { body, parent_message_id: replyTarget?.id ?? undefined };
        }

        const conversationId = activeConversation.id;
        const { data } = await api.post(
            `/conversations/${conversationId}/messages`,
            payload,
            { headers },
        );

        // Render immediately from the response rather than waiting on the
        // (queued) broadcast to round-trip back to us — see ingestMessage's
        // dedup for why it's still safe if that broadcast does arrive too.
        ingestMessage(conversationId, markMessageMine(data.data));

        composerInput.value = '';
        pendingAttachments = [];
        renderPendingAttachments();
        cancelReply();
        saveDraft(activeConversation.id, '');
        autoGrow();
    } catch (error) {
        showToast(apiErrorMessage(error, t('chat.send_error')), 'error');
    } finally {
        composerInput.disabled = false;
        composerInput.focus();
    }
});

async function submitEdit() {
    const body = composerInput.value.trim();

    if (!body || !activeConversation || !editTarget) {
        return;
    }

    try {
        await api.patch(
            `/conversations/${activeConversation.id}/messages/${editTarget.id}`,
            { body },
        );
        cancelEdit();
    } catch (error) {
        showToast(apiErrorMessage(error, t('chat.edit_error')), 'error');
    }
}

composerInput?.addEventListener('keydown', (event) => {
    if (
        mentionQuery &&
        ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)
    ) {
        handleMentionKeydown(event);

        return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        composer.requestSubmit();

        return;
    }

    if (event.key === 'Escape') {
        if (editTarget) {
            cancelEdit();
        } else if (replyTarget) {
            cancelReply();
        }

        return;
    }

    if (event.key === 'ArrowUp' && !composerInput.value && !editTarget) {
        const lastMine = [...messages].reverse().find((m) => m.is_mine);

        if (lastMine) {
            event.preventDefault();
            setEditTarget(lastMine);
        }
    }
});

/*
|--------------------------------------------------------------------------
| Mentions autocomplete
|--------------------------------------------------------------------------
*/

let mentionActiveIndex = 0;
let mentionMatches = [];

function handleMentionTyping() {
    const cursor = composerInput.selectionStart;
    const value = composerInput.value.slice(0, cursor);
    const match = value.match(/(?:^|\s)@([^\s@]{0,32})$/);

    if (!match) {
        mentionQuery = null;
        mentionsEl.hidden = true;

        return;
    }

    const query = match[1].toLowerCase();
    mentionQuery = { start: cursor - match[1].length - 1, end: cursor };

    mentionMatches = members
        .filter((m) => !currentUser || m.id !== currentUser.id)
        .filter((m) => m.name.toLowerCase().includes(query))
        .slice(0, 6);

    if (!mentionMatches.length) {
        mentionsEl.hidden = true;

        return;
    }

    mentionActiveIndex = 0;
    renderMentionList();
}

function renderMentionList() {
    mentionsEl.hidden = false;
    mentionsEl.setAttribute('role', 'listbox');
    mentionsEl.setAttribute('aria-label', t('chat.members'));
    mentionsEl.innerHTML = mentionMatches
        .map(
            (m, index) => `
            <button
                type="button"
                class="mention-autocomplete__item ${index === mentionActiveIndex ? 'mention-autocomplete__item--active' : ''}"
                data-mention-index="${index}"
                role="option"
                id="mention-option-${index}"
                aria-selected="${index === mentionActiveIndex}"
            >
                <span class="avatar avatar--sm">${m.avatar ? `<img class="avatar__image" src="${m.avatar}" alt="">` : `<span class="avatar__initials">${initials(m.name)}</span>`}</span>
                ${escapeHtml(m.name)}
            </button>
        `,
        )
        .join('');
}

function applyMention(member) {
    const before = composerInput.value.slice(0, mentionQuery.start);
    const after = composerInput.value.slice(mentionQuery.end);
    const token = `${mentionToken(member.name, member.id)} `;

    composerInput.value = `${before}${token}${after}`;
    const cursor = before.length + token.length;
    composerInput.setSelectionRange(cursor, cursor);
    mentionQuery = null;
    mentionsEl.hidden = true;
    composerInput.focus();
    scheduleDraftSave();
}

function handleMentionKeydown(event) {
    if (event.key === 'Escape') {
        mentionQuery = null;
        mentionsEl.hidden = true;

        return;
    }

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        mentionActiveIndex = (mentionActiveIndex + 1) % mentionMatches.length;
        renderMentionList();

        return;
    }

    if (event.key === 'ArrowUp') {
        event.preventDefault();
        mentionActiveIndex =
            (mentionActiveIndex - 1 + mentionMatches.length) %
            mentionMatches.length;
        renderMentionList();

        return;
    }

    if (event.key === 'Enter') {
        event.preventDefault();
        applyMention(mentionMatches[mentionActiveIndex]);
    }
}

mentionsEl?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-mention-index]');

    if (button) {
        applyMention(mentionMatches[Number(button.dataset.mentionIndex)]);
    }
});

/*
|--------------------------------------------------------------------------
| Message interactions: reply-quote scroll, reactions, context menu
|--------------------------------------------------------------------------
*/

messagesEl?.addEventListener('click', (event) => {
    const scrollTarget = event.target.closest('[data-scroll-to]');

    if (scrollTarget) {
        scrollToMessage(Number(scrollTarget.dataset.scrollTo));

        return;
    }

    const reactionPill = event.target.closest('[data-react]');

    if (reactionPill) {
        toggleReaction(
            Number(reactionPill.dataset.react),
            reactionPill.dataset.emoji,
        );

        return;
    }

    const lightboxImg = event.target.closest('[data-lightbox]');

    if (lightboxImg) {
        openLightbox(lightboxImg.dataset.lightbox);
    }
});

function scrollToMessage(messageId) {
    const row = messagesEl.querySelector(`[data-message-id="${messageId}"]`);

    if (!row) {
        return;
    }

    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('chat-bubble-row--highlight');
    window.setTimeout(
        () => row.classList.remove('chat-bubble-row--highlight'),
        1600,
    );
}

/**
 * Same as scrollToMessage, but for a target that might sit further back
 * than whatever's currently loaded (a search hit, or a notification click
 * for a message from before the conversation was opened) — walks the same
 * `before_id` cursor infinite-scroll already uses, one page at a time,
 * until the row exists or there's genuinely nothing older left to fetch.
 */
async function scrollToMessageOrLoad(conversationId, messageId, attempt = 0) {
    if (!isActive(conversationId)) {
        return;
    }

    if (messagesEl.querySelector(`[data-message-id="${messageId}"]`)) {
        scrollToMessage(messageId);

        return;
    }

    const cache = getCache(conversationId);

    if (!cache.hasMoreOlder || attempt >= 25) {
        return;
    }

    await loadOlderMessages(conversationId);
    await scrollToMessageOrLoad(conversationId, messageId, attempt + 1);
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

async function toggleReaction(messageId, emoji) {
    if (!activeConversation) {
        return;
    }

    try {
        const { data } = await api.post(
            `/conversations/${activeConversation.id}/messages/${messageId}/reactions`,
            { emoji },
        );
        const message = messages.find((m) => m.id === messageId);

        if (message) {
            message.reactions = data.data.reactions;
            patchMessageDOM(message);
        }
    } catch (error) {
        showToast(apiErrorMessage(error, t('common.error_generic')), 'error');
    }
}

function messageContextItems(message) {
    const items = [
        {
            label: t('chat.reply'),
            icon: '↩',
            onClick: () => setReplyTarget(message),
        },
        {
            label: t('chat.copy'),
            icon: '⧉',
            onClick: () => navigator.clipboard?.writeText(message.body || ''),
        },
        {
            label: t('chat.react'),
            icon: '☺',
            onClick: (event) => openReactionPicker(message, event),
        },
    ];

    if (message.is_mine) {
        items.push({
            label: t('common.edit'),
            icon: '✎',
            onClick: () => setEditTarget(message),
        });
        items.push({
            label: t('common.delete'),
            icon: '🗑',
            danger: true,
            onClick: () => deleteMessage(message),
        });
    }

    items.push({
        label: message.is_pinned ? t('chat.unpin') : t('chat.pin'),
        icon: '📌',
        onClick: () => togglePin(message),
    });

    return items;
}

messagesEl?.addEventListener('contextmenu', (event) => {
    const row = event.target.closest('[data-message-id]');

    if (!row) {
        return;
    }

    event.preventDefault();
    const message = messages.find(
        (m) => m.id === Number(row.dataset.messageId),
    );

    if (message) {
        openContextMenu(
            event.clientX,
            event.clientY,
            messageContextItems(message),
        );
    }
});

function wireLongPress() {
    attachLongPress(messagesEl, (x, y, event) => {
        const row = event.target.closest('[data-message-id]');

        if (!row) {
            return;
        }

        const message = messages.find(
            (m) => m.id === Number(row.dataset.messageId),
        );

        if (message) {
            openContextMenu(x, y, messageContextItems(message));
        }
    });
}

function openReactionPicker(message, event) {
    const picker = document.createElement('div');
    picker.className = 'reaction-picker';
    picker.innerHTML = QUICK_REACTIONS.map(
        (emoji) =>
            `<button type="button" data-emoji="${emoji}">${emoji}</button>`,
    ).join('');

    const x = event?.clientX ?? window.innerWidth / 2;
    const y = event?.clientY ?? window.innerHeight / 2;

    document.body.appendChild(picker);
    const rect = picker.getBoundingClientRect();
    picker.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
    picker.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;

    const close = () => picker.remove();

    picker.addEventListener('click', (e) => {
        const button = e.target.closest('[data-emoji]');

        if (button) {
            toggleReaction(message.id, button.dataset.emoji);
        }

        close();
    });

    window.setTimeout(
        () =>
            document.addEventListener('click', close, {
                once: true,
                capture: true,
            }),
        0,
    );
}

async function deleteMessage(message) {
    if (!activeConversation) {
        return;
    }

    try {
        const confirmed = await confirmDialog({
            title: t('chat.delete_message_title'),
            message: t('chat.delete_message_body'),
            confirmText: t('common.delete'),
            cancelText: t('common.cancel'),
            danger: true,
            onConfirm: () =>
                api.delete(
                    `/conversations/${activeConversation.id}/messages/${message.id}`,
                ),
        });

        if (confirmed) {
            // Reuses the exact same path the realtime broadcast drives —
            // one source of truth for "a message was removed", and safe to
            // run twice if that broadcast also arrives (onMessageDeleted
            // no-ops once the id is already gone).
            onMessageDeleted(activeConversation.id, { message_id: message.id });
        }
    } catch (error) {
        showToast(apiErrorMessage(error, t('common.error_generic')), 'error');
    }
}

async function togglePin(message) {
    if (!activeConversation) {
        return;
    }

    try {
        const method = message.is_pinned ? 'delete' : 'post';
        const { data } = await api[method](
            `/conversations/${activeConversation.id}/messages/${message.id}/pin`,
        );

        const local = messages.find((m) => m.id === message.id);

        if (local) {
            local.is_pinned = data.data.is_pinned;
            patchMessageDOM(local);
        }
    } catch (error) {
        showToast(apiErrorMessage(error, t('common.error_generic')), 'error');
    }
}

pinnedBar?.addEventListener('click', () => {
    const pinned = messages.filter((m) => m.is_pinned);

    if (pinned.length) {
        scrollToMessage(pinned[pinned.length - 1].id);
    }
});

/*
|--------------------------------------------------------------------------
| Lightbox
|--------------------------------------------------------------------------
*/

function openLightbox(url) {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.innerHTML = `
        <img src="${url}" alt="">
        <a class="lightbox__download" href="${url}" download aria-label="${t('chat.download')}">&#8681;</a>
        <button type="button" class="lightbox__close" aria-label="${t('common.close')}">&times;</button>
    `;
    document.body.appendChild(box);

    const close = () => box.remove();
    box.querySelector('.lightbox__close').addEventListener('click', close);
    box.addEventListener('click', (e) => {
        if (e.target === box) {
            close();
        }
    });
    document.addEventListener('keydown', function onKey(e) {
        if (e.key === 'Escape') {
            close();
            document.removeEventListener('keydown', onKey);
        }
    });
}

/*
|--------------------------------------------------------------------------
| Search — all conversations + within one conversation
|--------------------------------------------------------------------------
*/

function highlightQuery(text, query) {
    if (!query) {
        return escapeHtml(text);
    }

    const escaped = escapeHtml(text);
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    return escaped.replace(
        new RegExp(`(${escapedQuery})`, 'ig'),
        '<mark>$1</mark>',
    );
}

function renderSearchResults(results, query) {
    if (!results.length) {
        searchPanelResults.innerHTML = emptyState(t('chat.no_results'));

        return;
    }

    searchPanelResults.innerHTML = results
        .map(
            (message) => `
            <button type="button" class="chat-search-result" data-search-result-conversation="${message.conversation_id}" data-search-result-message="${message.id}">
                <div class="chat-search-result__meta">
                    <span>${escapeHtml(message.sender?.name || '')}</span>
                    <span>${message.created_at ?? ''}</span>
                </div>
                <div class="chat-search-result__body">${highlightQuery(message.body || '', query)}</div>
            </button>
        `,
        )
        .join('');
}

async function runSearch(query, scopedToConversation) {
    if (!query) {
        searchPanelResults.innerHTML = '';

        return;
    }

    searchPanelResults.innerHTML = `<div class="skeleton skeleton-row" style="margin:10px;"></div>`;

    try {
        const params = { q: query, per_page: 30 };

        if (scopedToConversation && activeConversation) {
            params.conversation_id = activeConversation.id;
        }

        const { data } = await api.get('/messages/search', { params });
        renderSearchResults(data.data || [], query);
    } catch (error) {
        searchPanelResults.innerHTML = emptyState(
            apiErrorMessage(error, t('common.error_generic')),
        );
    }
}

function openSearchPanel(scopedToConversation) {
    globalSearchMode = !scopedToConversation;
    searchPanel.hidden = false;
    searchPanelInput.value = '';
    searchPanelResults.innerHTML = '';
    searchPanelInput.focus();
}

document
    .querySelector('[data-chat-global-search]')
    ?.addEventListener('click', () => openSearchPanel(false));
document
    .querySelector('[data-chat-search-toggle]')
    ?.addEventListener('click', () => openSearchPanel(true));
document
    .querySelector('[data-chat-search-close]')
    ?.addEventListener('click', () => {
        searchPanel.hidden = true;
    });

searchPanelInput?.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(
        () => runSearch(searchPanelInput.value.trim(), !globalSearchMode),
        300,
    );
});

searchPanelResults?.addEventListener('click', async (event) => {
    const result = event.target.closest('[data-search-result-conversation]');

    if (!result) {
        return;
    }

    const conversationId = Number(result.dataset.searchResultConversation);
    const messageId = Number(result.dataset.searchResultMessage);
    const conversation = conversations.find((c) => c.id === conversationId);

    searchPanel.hidden = true;

    if (conversation && activeConversation?.id !== conversationId) {
        await openConversation(conversation);
    }

    scrollToMessageOrLoad(conversationId, messageId);
});

/*
|--------------------------------------------------------------------------
| Details sidebar
|--------------------------------------------------------------------------
*/

function openDetails() {
    if (!activeConversation) {
        return;
    }

    shell.setAttribute('data-details-open', '');
    shell.dataset.view = 'details';
    renderDetails();
}

function renderDetails() {
    const conversation = activeConversation;
    const media = messages.flatMap((m) =>
        (m.attachments || []).filter((a) =>
            (a.mime_type || '').startsWith('image/'),
        ),
    );
    const pinned = messages.filter((m) => m.is_pinned);

    detailsContent.innerHTML = `
        <div class="chat-details-header">
            <span class="avatar avatar--lg">
                ${conversation.avatar ? `<img class="avatar__image" src="${conversation.avatar}" alt="">` : `<span class="avatar__initials">${initials(conversation.title)}</span>`}
            </span>
            <div style="font-weight:700; font-size:15px;">${escapeHtml(conversation.title || '')}</div>
            <div style="font-size:12px; color:var(--ui-text-secondary);">${escapeHtml(otherMemberStatus(conversation))}</div>
        </div>

        ${
            conversation.type === 'group'
                ? `
            <div class="chat-details-section">
                <h3 class="chat-details-section__title">${t('chat.members')}</h3>
                ${members
                    .map(
                        (m) => `
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                        <span class="avatar avatar--sm">${m.avatar ? `<img class="avatar__image" src="${m.avatar}" alt="">` : `<span class="avatar__initials">${initials(m.name)}</span>`}</span>
                        <span style="font-size:13px;">${escapeHtml(m.name)}</span>
                    </div>
                `,
                    )
                    .join('')}
            </div>
        `
                : ''
        }

        <div class="chat-details-section">
            <h3 class="chat-details-section__title">${t('chat.pinned_messages')}</h3>
            ${
                pinned.length
                    ? pinned
                          .map(
                              (m) =>
                                  `<div class="chat-pinned-item" data-details-scroll-to="${m.id}">${escapeHtml(m.body || t('chat.attachment_preview'))}</div>`,
                          )
                          .join('')
                    : `<div style="font-size:12px; color:var(--ui-text-muted);">${t('chat.no_pinned_messages')}</div>`
            }
        </div>

        <div class="chat-details-section">
            <h3 class="chat-details-section__title">${t('chat.shared_media')}</h3>
            ${
                media.length
                    ? `<div class="chat-media-grid">${media.map((a) => `<img src="${a.url}" alt="" data-details-lightbox="${a.url}">`).join('')}</div>`
                    : `<div style="font-size:12px; color:var(--ui-text-muted);">${t('chat.no_shared_media')}</div>`
            }
        </div>
    `;
}

detailsContent?.addEventListener('click', (event) => {
    const scrollTarget = event.target.closest('[data-details-scroll-to]');

    if (scrollTarget) {
        shell.dataset.view = 'conversation';
        window.setTimeout(
            () => scrollToMessage(Number(scrollTarget.dataset.detailsScrollTo)),
            150,
        );

        return;
    }

    const img = event.target.closest('[data-details-lightbox]');

    if (img) {
        openLightbox(img.dataset.detailsLightbox);
    }
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

    modal
        .querySelector('[data-action="cancel"]')
        .addEventListener('click', close);

    function renderSelected() {
        if (!selectedEl) {
            return;
        }

        selectedEl.innerHTML = [...selected.values()]
            .map(
                (user) =>
                    `<span class="pill pill--primary">${escapeHtml(user.name)} <button type="button" data-remove-user="${user.id}" style="border:none;background:none;color:inherit;cursor:pointer;">&times;</button></span>`,
            )
            .join('');

        confirmBtn.disabled = selected.size === 0;
    }

    async function searchUsers(query) {
        if (query.length < 2) {
            resultsEl.innerHTML = '';

            return;
        }

        try {
            const { data } = await api.get('/chat/users/search', {
                params: { q: query },
            });
            const users = (data.data || []).filter((u) => !selected.has(u.id));

            resultsEl.innerHTML =
                users
                    .map(
                        (user) => `
                    <button type="button" class="dropdown__item" data-pick-user='${escapeHtml(JSON.stringify(user))}'>
                        ${escapeHtml(user.name)} <span style="color:var(--ui-text-muted); font-size:11.5px;">${escapeHtml(user.email)}</span>
                    </button>
                `,
                    )
                    .join('') ||
                `<div class="field-hint" style="padding:8px;">${t('chat.empty_list')}</div>`;
        } catch {
            resultsEl.innerHTML = '';
        }
    }

    let queryTimer = null;
    queryInput.addEventListener('input', () => {
        window.clearTimeout(queryTimer);
        queryTimer = window.setTimeout(
            () => searchUsers(queryInput.value.trim()),
            250,
        );
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
        await createConversation({
            type: 'group',
            title,
            user_ids: [...selected.keys()],
        });
    });

    queryInput.focus();
}

async function createConversation(payload) {
    try {
        const { data } = await api.post('/conversations', payload);

        await loadConversations();
        subscribeToConversation(data.data.id);

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

document
    .querySelector('[data-start-private]')
    ?.addEventListener('click', () => userPickerModal({ multi: false }));
document
    .querySelector('[data-start-group]')
    ?.addEventListener('click', () => userPickerModal({ multi: true }));

/*
|--------------------------------------------------------------------------
| Conversation search (left pane)
|--------------------------------------------------------------------------
*/

let conversationSearchTimer = null;

searchInput?.addEventListener('input', () => {
    window.clearTimeout(conversationSearchTimer);
    conversationSearchTimer = window.setTimeout(
        () => loadConversations(searchInput.value),
        300,
    );
});

/*
|--------------------------------------------------------------------------
| Reconciliation on tab focus (catch up on anything missed while backgrounded)
|--------------------------------------------------------------------------
|
| Deliberately NOT loadMessages() — its cache-hit branch does a full
| renderMessageList() + scrollToBottom(), which would yank the reader back
| to the bottom every time the tab regains focus even if they were reading
| scrolled-up history. Fetching just the newest chunk and feeding it through
| ingestMessage (the same dedup/scroll-if-at-bottom path realtime events
| use) catches up on anything the socket missed while backgrounded without
| touching scroll position for anyone not already at the bottom.
*/

async function reconcileActiveConversation(conversationId) {
    try {
        const latest = await fetchMessagePage(conversationId);
        latest.forEach((message) => ingestMessage(conversationId, message));
    } catch {
        // Best-effort catch-up only — realtime events cover the normal case.
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && activeConversation) {
        reconcileActiveConversation(activeConversation.id);
    }
});

/*
|--------------------------------------------------------------------------
| Opening a specific conversation/message from outside the chat pane —
| either a full page load (?message= query param, e.g. from a notification
| click while on some other page) or, while already inside the chat app, a
| same-page custom event so a notification click never forces a reload of
| the page it's already sitting on (see notification-bell.js).
|--------------------------------------------------------------------------
*/

async function openConversationById(conversationId, messageId) {
    let conversation = conversations.find((c) => c.id === conversationId);

    if (!conversation) {
        // Could be a conversation that started after this page's list was
        // loaded (e.g. someone's very first message to you) — refresh once.
        await loadConversations();
        conversation = conversations.find((c) => c.id === conversationId);
    }

    if (!conversation) {
        return;
    }

    await openConversation(conversation);

    if (messageId) {
        scrollToMessageOrLoad(conversationId, messageId);
    }
}

document.addEventListener('chat:open-conversation', (event) => {
    openConversationById(event.detail.conversationId, event.detail.messageId);
});

/*
|--------------------------------------------------------------------------
| Boot
|--------------------------------------------------------------------------
*/

(async () => {
    currentUser = await fetchCurrentUser();
    initPresence();
    wireLongPress();

    await loadConversations();

    const match = window.location.pathname.match(/\/chat\/(\d+)/);
    const messageParam = new URLSearchParams(window.location.search).get(
        'message',
    );

    if (match) {
        const conversation = conversations.find(
            (c) => String(c.id) === match[1],
        );

        if (conversation) {
            await openConversation(conversation);

            if (messageParam) {
                scrollToMessageOrLoad(conversation.id, Number(messageParam));
            }
        }
    }
})();

window.addEventListener('beforeunload', () => {
    if (activeConversation) {
        saveDraft(activeConversation.id, composerInput.value);
    }

    unsubscribeAll();
});
