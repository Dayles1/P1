import { api } from '../axios';
import { setActiveConversationId } from '../shared/active-context';
import { bootstrapAppState } from '../shared/app-state';
import {
    avatarHue,
    avatarMedia,
    hasRole,
    initials,
} from '../shared/auth-state';
import { confirmDialog } from '../shared/confirm';
import { openContextMenu, attachLongPress } from '../shared/context-menu';
import { getEcho, onReconnect } from '../shared/echo';
import { escapeHtml } from '../shared/forms';
import { t, tChoice } from '../shared/i18n';
import { icon } from '../shared/icon';
import { mentionToken } from '../shared/mentions';
import { openModal } from '../shared/modal';
import { bootOnPage } from '../shared/page-boot';
import { isOnline, onPresenceChange, initPresence } from '../shared/presence';
import { emptyState } from '../shared/skeleton';
import { showToast, apiErrorMessage } from '../shared/toast';
import { chooseDialog } from './chat/dialogs';
import { ALL_REACTIONS, EMOJIS, QUICK_REACTIONS } from './chat/emoji';
import {
    isEmojiOnly,
    plainText,
    renderRichText,
    wrapSelection,
} from './chat/format';
import { conversationTitle, openForwardDialog } from './chat/forward';
import { openConversationInfo, openMessageInfo } from './chat/info';
import { conversationMenuItems, muteMenuItems } from './chat/list-menu';
import {
    attachmentKind,
    attachmentsHtml,
    fileHtml,
    forwardedHtml,
    kindLabel,
    linkPreviewHtml,
    messagePreview,
    pollHtml,
    systemHtml,
} from './chat/message-parts';
import { openPollDialog } from './chat/polls';
import {
    configureTime,
    dayKey,
    dayLabel,
    formatDate,
    formatDuration,
    formatTime,
    lastSeenText,
    listTime,
} from './chat/time';

// A module-scope bridge so things that must only ever be registered ONCE
// on `document`/`window` (which persist across Turbo navigations, unlike
// everything inside <main>) can still call into whatever the CURRENT
// boot() cycle's real handler is, without stacking a duplicate listener
// on every revisit to /chat.
let currentCleanup = null;
let handleOpenConversationEvent = null;
let handleVisibilityChange = null;

/** Messages fetched per window load (newest, older, newer, around). */
const PAGE_SIZE = 40;
/** The loaded window never grows past this; the far side is dropped. */
const MAX_MESSAGES_IN_MEMORY = 300;
/** Conversations per list page. */
const LIST_PAGE_SIZE = 50;
/** One shared player for every voice message on the page. */
let audioPlayer = null;

function boot() {
    const controller = new AbortController();
    const { signal } = controller;

    /*
    |--------------------------------------------------------------------------
    | DOM
    |--------------------------------------------------------------------------
    */

    const $ = (selector) => document.querySelector(selector);

    const shell = $('[data-chat-shell]');
    const threadPane = $('[data-chat-thread-pane]');
    const listEl = $('[data-chat-list]');
    const peopleEl = $('[data-chat-people]');
    const searchInput = $('[data-chat-search]');
    const threadHeader = $('[data-chat-thread-header]');
    const threadAvatar = $('[data-chat-thread-avatar]');
    const threadTitle = $('[data-chat-thread-title]');
    const threadStatus = $('[data-chat-thread-status]');
    const pinnedBar = $('[data-chat-pinned-bar]');
    const pinnedSegments = $('[data-chat-pinned-segments]');
    const pinnedLabel = $('[data-chat-pinned-label]');
    const pinnedText = $('[data-chat-pinned-text]');
    const messagesEl = $('[data-chat-messages]');
    const typingEl = $('[data-chat-typing]');
    const typingText = $('[data-chat-typing-text]');
    const scrollBottomBtn = $('[data-chat-scroll-bottom]');
    const scrollBottomCount = $('[data-chat-scroll-bottom-count]');
    const jumpTopBtn = $('[data-chat-jump-top]');
    const replyPreview = $('[data-chat-reply-preview]');
    const replyPreviewName = $('[data-chat-reply-preview-name]');
    const replyPreviewText = $('[data-chat-reply-preview-text]');
    const editPreview = $('[data-chat-edit-preview]');
    const editPreviewText = $('[data-chat-edit-preview-text]');
    const composer = $('[data-chat-composer]');
    const composerInput = $('[data-chat-input]');
    const composerAttachmentsEl = $('[data-chat-composer-attachments]');
    const fileInput = $('[data-chat-file-input]');
    const mentionsEl = $('[data-chat-mentions]');
    const recordingEl = $('[data-chat-recording]');
    const recordingTime = $('[data-chat-recording-time]');
    const blockedEl = $('[data-chat-blocked]');
    const blockedText = $('[data-chat-blocked-text]');
    const unblockBtn = $('[data-chat-unblock]');
    const selectBar = $('[data-chat-select-bar]');
    const selectCount = $('[data-chat-select-count]');
    const searchPanel = $('[data-chat-search-panel]');
    const searchPanelInput = $('[data-chat-search-input]');
    const searchPanelResults = $('[data-chat-search-results]');
    const detailsTitle = $('[data-chat-details-title]');
    const detailsBack = $('[data-chat-details-back]');
    const detailsContent = $('[data-chat-details-content]');

    /*
    |--------------------------------------------------------------------------
    | State
    |--------------------------------------------------------------------------
    */

    let currentUser = null;
    let listType = 'all';
    /** 'all' or 'archived' — the archive is its own list, as in Telegram. */
    let listFolder = 'all';
    let conversations = [];
    let listPage = 1;
    let listLastPage = 1;
    let archivedUnread = 0;
    let activeConversation = null;
    /** `GET /conversations/{c}` of the open chat: permissions, settings. */
    let activeShow = null;
    let messages = []; // oldest-first, the loaded window of the active conversation
    let members = []; // everyone in the active conversation
    let pinned = []; // the active conversation's pinned messages, newest pin first
    let pinnedIndex = 0; // which of them the pinned bar shows
    const typingByConversation = new Map(); // conversationId -> Map(userId -> {name, kind, timer})
    const profileCache = new Map(); // userId -> public profile
    let replyTarget = null;
    let editTarget = null;
    let pendingAttachments = [];
    let searchTimer = null;
    let mentionQuery = null; // {start, end} range in the textarea when the autocomplete is open
    let globalSearchMode = false;
    /** Selection mode: ids of the picked messages (null when off). */
    let selection = null;
    /** Poll options picked but not sent yet (multiple-choice polls). */
    const pollPicks = new Map();

    // The info pane is a small stack: the conversation, then a person,
    // then maybe one of their groups — "back" walks it.
    let detailsStack = [];

    const DRAFT_PREFIX = 'chat-draft-';

    /*
    |--------------------------------------------------------------------------
    | Small helpers
    |--------------------------------------------------------------------------
    */

    const sameId = (a, b) => String(a) === String(b);
    const isTemporary = (message) => String(message.id).startsWith('tmp-');
    const isAlive = () => !signal.aborted;

    function findMessage(id) {
        return messages.find((m) => sameId(m.id, id)) ?? null;
    }

    function findConversation(id) {
        return conversations.find((c) => sameId(c.id, id)) ?? null;
    }

    function titleOf(conversation) {
        return conversationTitle(conversation);
    }

    function isManagerRole(role) {
        return ['creator', 'owner', 'admin'].includes(role);
    }

    function avatarHtml(name, url, { className = '', online = false } = {}) {
        const hue = url ? '' : `avatar--hue-${avatarHue(name || '')}`;
        const inner = url
            ? avatarMedia(url, name || '')
            : `<span class="avatar__initials">${escapeHtml(initials(name || ''))}</span>`;

        return `<span class="avatar ${hue} ${className}">${inner}${online ? '<span class="chat-online-dot"></span>' : ''}</span>`;
    }

    function conversationAvatarHtml(conversation, className, online = false) {
        if (conversation.is_saved) {
            return `<span class="avatar chat-avatar--saved ${className}">${icon('bookmark', { size: 15 })}</span>`;
        }

        if (conversation.type === 'private') {
            return avatarHtml(titleOf(conversation), conversation.avatar, {
                className,
                online,
            });
        }

        return `<span class="avatar ${className} ${conversation.avatar ? '' : `avatar--hue-${avatarHue(conversation.title || '')}`}">${conversation.avatar ? avatarMedia(conversation.avatar) : icon(conversation.type === 'channel' ? 'megaphone' : 'users', { size: 15 })}</span>`;
    }

    function newClientId() {
        if (window.crypto?.randomUUID) {
            return window.crypto.randomUUID();
        }

        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;

            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
    }

    /** A message as this viewer sees it (broadcasts carry no `is_mine`). */
    function forViewer(message) {
        return {
            ...message,
            is_mine: sameId(message.sender?.id, currentUser?.id),
        };
    }

    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            showToast(t('chat.copied'), 'success');
        } catch {
            showToast(t('chat.copy_failed'), 'error');
        }
    }

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
        if (!conversationId) {
            return;
        }

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
        if (!activeConversation || editTarget) {
            return;
        }

        const conversationId = activeConversation.id;

        window.clearTimeout(draftSaveTimer);
        draftSaveTimer = window.setTimeout(() => {
            saveDraft(conversationId, composerInput.value);
            renderConversationList();
        }, 300);
    }

    /*
    |--------------------------------------------------------------------------
    | Conversation list
    |--------------------------------------------------------------------------
    */

    function typingEntries(conversationId) {
        return [
            ...(typingByConversation.get(String(conversationId))?.values() ||
                []),
        ];
    }

    function typingLabel(conversationId, { withName = true } = {}) {
        const entries = typingEntries(conversationId);

        if (!entries.length) {
            return '';
        }

        if (entries.length > 1) {
            return t('chat.are_typing');
        }

        const kind = ['recording', 'uploading'].includes(entries[0].kind)
            ? entries[0].kind
            : 'typing';

        return withName
            ? t(`chat.typing_kind.${kind}_named`, { name: entries[0].name })
            : t(`chat.typing_kind.${kind}`);
    }

    function lastMessageTicks(conversation) {
        const last = conversation.last_message;

        if (
            !last ||
            !sameId(last.sender_id, currentUser?.id) ||
            last.type === 'system' ||
            conversation.is_saved
        ) {
            return '';
        }

        return `<span class="chat-list-item__ticks ${last.is_read ? 'chat-list-item__ticks--read' : ''}">${icon(last.is_read ? 'checks' : 'check', { size: 14 })}</span>`;
    }

    function conversationSubtitle(conversation) {
        const typing = typingLabel(conversation.id, {
            withName: conversation.type !== 'private',
        });

        if (typing) {
            return `<span class="chat-list-item__typing">${escapeHtml(typing)}</span>`;
        }

        const draft = isActiveId(conversation.id)
            ? ''
            : loadDraft(conversation.id);

        if (draft) {
            return `<span class="chat-list-item__draft">${escapeHtml(t('chat.draft'))}</span> ${escapeHtml(plainText(draft))}`;
        }

        const last = conversation.last_message;

        if (!last) {
            return `<span>${escapeHtml(t('chat.no_messages_yet'))}</span>`;
        }

        const isMine = sameId(last.sender_id, currentUser?.id);
        const sender = isMine
            ? t('chat.you')
            : last.sender_name || last.sender || '';
        const prefix =
            last.type !== 'system' &&
            !conversation.is_saved &&
            (conversation.type !== 'private' || isMine) &&
            sender
                ? `<span class="chat-list-item__sender">${escapeHtml(sender)}:</span> `
                : '';
        const kind = last.attachment_kind
            ? `${icon(last.attachment_kind === 'image' ? 'image' : last.attachment_kind === 'voice' ? 'mic' : last.attachment_kind === 'video' ? 'video' : 'file', { size: 13, className: 'chat-list-item__kind' })}`
            : '';

        return `${prefix}${kind}<span>${escapeHtml(last.preview || (last.body ? plainText(last.body) : t('chat.attachment_preview')))}</span>`;
    }

    function unreadBadges(conversation) {
        const count = conversation.unread_count || 0;
        const mentions = conversation.unread_mentions_count || 0;
        let html = '';

        if (mentions > 0) {
            html += `<span class="chat-list-item__mention" title="${escapeHtml(t('chat.list_menu.mentions'))}">@</span>`;
        }

        if (count > 0) {
            html += `<span class="mono chat-list-item__unread">${count > 99 ? '99+' : count}</span>`;
        } else if (conversation.marked_unread) {
            html +=
                '<span class="chat-list-item__unread chat-list-item__unread--dot"></span>';
        } else if (conversation.is_pinned) {
            html += icon('pin', {
                size: 13,
                className: 'chat-list-item__pin-icon',
            });
        }

        return html;
    }

    function conversationRow(conversation) {
        const online = conversation.other_user_id
            ? isOnline(conversation.other_user_id)
            : false;
        const time =
            conversation.last_message?.created_at_iso ||
            conversation.last_message_at_iso;

        return `
            <button
                type="button"
                class="chat-list-item ${isActiveId(conversation.id) ? 'chat-list-item--active' : ''} ${conversation.is_muted ? 'chat-list-item--muted' : ''}"
                data-conversation-id="${Number(conversation.id)}"
            >
                ${conversationAvatarHtml(conversation, 'chat-list-item__avatar', online)}
                <span class="chat-list-item__body">
                    <span class="chat-list-item__title-row">
                        <span class="chat-list-item__name">
                            ${escapeHtml(titleOf(conversation))}
                            ${conversation.is_muted ? icon('bell-off', { size: 12, className: 'chat-list-item__muted-icon' }) : ''}
                        </span>
                        ${lastMessageTicks(conversation)}
                        <span class="mono chat-list-item__time">${escapeHtml(listTime(time))}</span>
                    </span>
                    <span class="chat-list-item__preview-row">
                        <span class="chat-list-item__preview">${conversationSubtitle(conversation)}</span>
                        ${unreadBadges(conversation)}
                    </span>
                </span>
            </button>
        `;
    }

    function archiveRow() {
        return `
            <button type="button" class="chat-list-item chat-list-item--archive" data-open-archive>
                <span class="avatar chat-list-item__avatar chat-avatar--archive">${icon('archive', { size: 15 })}</span>
                <span class="chat-list-item__body">
                    <span class="chat-list-item__title-row">
                        <span class="chat-list-item__name">${escapeHtml(t('chat.archive'))}</span>
                    </span>
                    <span class="chat-list-item__preview-row">
                        <span class="chat-list-item__preview">${escapeHtml(t('chat.archive_hint'))}</span>
                        ${archivedUnread > 0 ? `<span class="mono chat-list-item__unread chat-list-item__unread--muted">${archivedUnread > 99 ? '99+' : archivedUnread}</span>` : ''}
                    </span>
                </span>
            </button>
        `;
    }

    function archiveHeader() {
        return `
            <div class="chat-list-folder">
                <button type="button" class="icon-btn icon-btn--sm" data-close-archive aria-label="${escapeHtml(t('common.back'))}">${icon('back', { size: 16 })}</button>
                <span>${escapeHtml(t('chat.archive'))}</span>
            </div>
        `;
    }

    function renderConversationList() {
        if (listType === 'people') {
            return;
        }

        const scroll = listEl.scrollTop;

        // "All / Private / Groups" above the list filters what is loaded.
        const visible = conversations.filter(
            (c) =>
                listType === 'all' ||
                (listType === 'private'
                    ? c.type === 'private' || c.is_saved
                    : !['private', 'saved'].includes(c.type)),
        );

        const head =
            listFolder === 'archived'
                ? archiveHeader()
                : !searchInput?.value.trim() &&
                    archivedUnread >= 0 &&
                    hasArchive
                  ? archiveRow()
                  : '';

        if (!visible.length) {
            listEl.innerHTML =
                head +
                emptyState(
                    escapeHtml(
                        t(
                            listFolder === 'archived'
                                ? 'chat.archive_empty'
                                : 'chat.empty_list',
                        ),
                    ),
                );

            return;
        }

        const pinnedChats = visible.filter((c) => c.is_pinned);
        const rest = visible.filter((c) => !c.is_pinned);

        listEl.innerHTML = `
            ${head}
            ${pinnedChats.length ? `<div class="chat-list-section-label">${escapeHtml(t('chat.pinned_conversations'))}</div>${pinnedChats.map(conversationRow).join('')}` : ''}
            ${rest.map(conversationRow).join('')}
            ${listPage < listLastPage ? '<div class="skeleton skeleton-row m-3" data-list-more></div>' : ''}
        `;
        listEl.scrollTop = scroll;
    }

    let conversationsRequest = 0;
    /** Whether the archive row is shown (there is something archived). */
    let hasArchive = false;

    async function loadUnreadSummary() {
        try {
            const { data } = await api.get('/conversations/unread');
            archivedUnread = Number(data.data?.archived_unread) || 0;
        } catch {
            // The archive row just shows no count.
        }
    }

    async function loadConversations(search = '', { append = false } = {}) {
        const requestId = ++conversationsRequest;
        const page = append ? listPage + 1 : 1;

        try {
            const requests = [
                api.get('/conversations', {
                    params: {
                        folder: listFolder,
                        search: search || undefined,
                        per_page: LIST_PAGE_SIZE,
                        page,
                    },
                }),
            ];

            if (!append && listFolder === 'all') {
                requests.push(
                    api
                        .get('/conversations', {
                            params: { folder: 'archived', per_page: 1 },
                        })
                        .catch(() => null),
                    loadUnreadSummary(),
                );
            }

            const [{ data }, archived] = await Promise.all(requests);

            // An older search answering after a newer one is dropped.
            if (requestId !== conversationsRequest || !isAlive()) {
                return;
            }

            if (archived !== undefined) {
                hasArchive = (archived?.data?.data || []).length > 0;
            }

            const fresh = data.data || [];
            conversations = append
                ? [
                      ...conversations,
                      ...fresh.filter((c) => !findConversation(c.id)),
                  ]
                : fresh;
            listPage = data.pagination?.current_page ?? page;
            listLastPage = data.pagination?.last_page ?? page;

            if (activeConversation) {
                const current = findConversation(activeConversation.id);

                if (current) {
                    Object.assign(activeConversation, current);
                }
            }

            renderConversationList();
        } catch (error) {
            if (requestId !== conversationsRequest || !isAlive()) {
                return;
            }

            if (!append) {
                listEl.innerHTML = emptyState(escapeHtml(t('chat.load_error')));
            }

            showToast(apiErrorMessage(error, t('chat.load_error')), 'error');
        }
    }

    let listLoadingMore = false;

    // The list is endless: the next page loads near its end.
    listEl?.addEventListener(
        'scroll',
        async () => {
            if (
                listLoadingMore ||
                listPage >= listLastPage ||
                listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight >
                    200
            ) {
                return;
            }

            listLoadingMore = true;

            try {
                await loadConversations(searchInput?.value || '', {
                    append: true,
                });
            } finally {
                listLoadingMore = false;
            }
        },
        { signal, passive: true },
    );

    /** Puts a conversation where the list order (pinned, then newest) wants it. */
    function placeConversation(conversation) {
        const index = conversations.indexOf(conversation);

        if (index !== -1) {
            conversations.splice(index, 1);
        }

        if (conversation.is_pinned) {
            conversations.unshift(conversation);

            return;
        }

        const firstUnpinned = conversations.findIndex((c) => !c.is_pinned);
        conversations.splice(
            firstUnpinned === -1 ? conversations.length : firstUnpinned,
            0,
            conversation,
        );
    }

    /** Patches a conversation's summary; a new message also moves it up. */
    function updateConversationSummary(
        conversationId,
        patch,
        { bump = false } = {},
    ) {
        const conversation = findConversation(conversationId);

        if (!conversation) {
            return;
        }

        Object.assign(conversation, patch);

        if (isActiveId(conversationId) && activeConversation !== conversation) {
            Object.assign(activeConversation, patch);
        }

        if (bump) {
            placeConversation(conversation);
        }

        renderConversationList();
    }

    /** A chat that is not in the loaded list: its row is fetched and slotted in. */
    async function fetchSummary(conversationId) {
        try {
            const { data } = await api.get(
                `/conversations/${conversationId}/summary`,
            );
            const summary = data.data;

            if (!isAlive() || !summary) {
                return null;
            }

            const belongs =
                listFolder === 'archived'
                    ? summary.is_archived
                    : !summary.is_archived;
            const existing = findConversation(summary.id);

            if (existing) {
                Object.assign(existing, summary);
                placeConversation(existing);
            } else if (belongs && !searchInput?.value.trim()) {
                placeConversation(summary);
            }

            if (isActiveId(summary.id)) {
                Object.assign(activeConversation, summary);
                renderComposerState();
            }

            renderConversationList();

            return summary;
        } catch {
            return null;
        }
    }

    function removeConversationFromList(conversationId) {
        const index = conversations.findIndex((c) =>
            sameId(c.id, conversationId),
        );

        if (index !== -1) {
            conversations.splice(index, 1);
        }

        renderConversationList();
    }

    /*
    |--------------------------------------------------------------------------
    | People — everyone you can write to
    |--------------------------------------------------------------------------
    */

    let people = [];
    let peoplePage = 1;
    let peopleLastPage = 1;
    let peopleRequest = 0;

    function personStatus(person) {
        if (isOnline(person.id)) {
            return `<span class="chat-list-item__typing">${escapeHtml(t('chat.online'))}</span>`;
        }

        return escapeHtml(
            person.department || lastSeenText(person.last_seen_at),
        );
    }

    function personRow(person) {
        return `
            <button type="button" class="chat-list-item" data-person-id="${Number(person.id)}">
                ${avatarHtml(person.name, person.avatar, { className: 'chat-list-item__avatar', online: isOnline(person.id) })}
                <span class="chat-list-item__body">
                    <span class="chat-list-item__title-row">
                        <span class="chat-list-item__name">${escapeHtml(person.name)}</span>
                        ${person.is_banned ? `<span class="chat-list-item__badge">${escapeHtml(t('chat.banned'))}</span>` : ''}
                    </span>
                    <span class="chat-list-item__preview-row">
                        <span class="chat-list-item__preview">${personStatus(person)}</span>
                    </span>
                </span>
            </button>
        `;
    }

    function renderPeople() {
        if (!people.length) {
            peopleEl.innerHTML = emptyState(escapeHtml(t('chat.people_empty')));

            return;
        }

        peopleEl.innerHTML = `
            ${people.map(personRow).join('')}
            ${peoplePage < peopleLastPage ? `<button type="button" class="btn btn--ghost btn--sm chat-list-more" data-people-more>${escapeHtml(t('chat.load_more'))}</button>` : ''}
        `;
    }

    async function loadPeople({ append = false } = {}) {
        const requestId = ++peopleRequest;
        const page = append ? peoplePage + 1 : 1;

        if (!append) {
            peopleEl.innerHTML =
                '<div class="skeleton skeleton-row m-3"></div>';
        }

        try {
            const { data } = await api.get('/users', {
                params: {
                    q: searchInput.value.trim() || undefined,
                    per_page: 50,
                    page,
                },
            });

            if (requestId !== peopleRequest || !isAlive()) {
                return;
            }

            people = append
                ? [...people, ...(data.data || [])]
                : data.data || [];
            peoplePage = data.pagination?.current_page ?? page;
            peopleLastPage = data.pagination?.last_page ?? page;
            renderPeople();
        } catch (error) {
            if (requestId === peopleRequest && isAlive()) {
                peopleEl.innerHTML = emptyState(
                    escapeHtml(apiErrorMessage(error, t('chat.load_error'))),
                );
            }
        }
    }

    peopleEl?.addEventListener(
        'click',
        (event) => {
            if (event.target.closest('[data-people-more]')) {
                loadPeople({ append: true });

                return;
            }

            const row = event.target.closest('[data-person-id]');

            if (row) {
                openPrivateChatWith(Number(row.dataset.personId));
            }
        },
        { signal },
    );

    /** Opens the private chat with a person, starting it if there is none yet. */
    async function openPrivateChatWith(userId) {
        const existing = conversations.find(
            (c) => c.type === 'private' && sameId(c.other_user_id, userId),
        );

        if (existing) {
            selectListType('all');
            await openConversation(existing);

            return;
        }

        // Yourself: Saved Messages ("Избранное").
        await createConversation({ type: 'private', user_ids: [userId] });
    }

    async function openSaved() {
        try {
            const { data } = await api.get('/conversations/saved');
            const saved = data.data;

            if (!findConversation(saved.id)) {
                await fetchSummary(saved.id);
            }

            selectListType('all');
            await openConversation(findConversation(saved.id) || saved);
        } catch (error) {
            showToast(
                apiErrorMessage(error, t('common.error_generic')),
                'error',
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Realtime — one subscription, the user's own channel
    |--------------------------------------------------------------------------
    |
    | Every chat event reaches each member on their private user channel
    | and names its conversation, so this page subscribes once (no
    | per-conversation channels, no /broadcasting/auth per chat) and
    | dispatches by `conversation_id`.
    */

    const userEvents = {
        '.message.sent': (p) => onMessageSent(p),
        '.message.edited': (p) => onMessageEdited(p),
        '.message.deleted': (p) => onMessagesDeleted(p),
        '.message.hidden': (p) => onMessagesHidden(p),
        '.message.reaction.toggled': (p) => onReactionToggled(p),
        '.message.read': (p) => onMessageReadEvent(p),
        '.poll.updated': (p) => onPollUpdated(p),
        '.user.typing': (p) => onUserTyping(p),
        '.conversation.updated': (p) => onConversationUpdated(p),
        '.conversation.settings': (p) => onConversationSettings(p),
        '.conversation.removed': (p) => onConversationRemoved(p),
        '.conversation.activity': (p) => onConversationActivity(p),
    };
    let userChannel = null;

    function subscribeToUser() {
        if (!currentUser || userChannel) {
            return;
        }

        userChannel =
            getEcho()?.private(`App.Models.User.${currentUser.id}`) ?? null;

        Object.entries(userEvents).forEach(([event, handler]) =>
            userChannel?.listen(event, handler),
        );
    }

    function unsubscribeUser() {
        Object.entries(userEvents).forEach(([event, handler]) =>
            userChannel?.stopListening(event, handler),
        );
        userChannel = null;
    }

    /*
    |--------------------------------------------------------------------------
    | Per-conversation message windows
    |--------------------------------------------------------------------------
    |
    | Each conversation keeps the window of messages it has loaded, oldest
    | first, plus whether there is more before and after it. A window that
    | ends at the newest message (`hasMoreAfter` false) follows live
    | events; one parked in history only counts what arrives. `ids` is the
    | dedup source of truth — a message can arrive twice (the send's
    | response and a broadcast).
    */
    const conversationCache = new Map();

    function getCache(conversationId) {
        const key = String(conversationId);

        if (!conversationCache.has(key)) {
            conversationCache.set(key, {
                messages: [],
                ids: new Set(),
                hasMoreBefore: true,
                hasMoreAfter: false,
                loaded: false,
                unreadDividerId: null,
            });
        }

        return conversationCache.get(key);
    }

    function isActiveId(conversationId) {
        return activeConversation
            ? sameId(activeConversation.id, conversationId)
            : false;
    }

    /** Replaces the window (a jump, an open) — the array stays the same instance. */
    function setWindow(cache, list, meta) {
        cache.messages.splice(0, cache.messages.length, ...list);
        cache.ids = new Set(list.map((m) => String(m.id)));
        cache.hasMoreBefore = Boolean(meta?.has_more_before);
        cache.hasMoreAfter = Boolean(meta?.has_more_after);
        cache.loaded = true;
    }

    /** Where a real message goes: by id, before any message still being sent. */
    function insertSorted(cache, message) {
        const list = cache.messages;
        let index = list.length;

        while (
            index > 0 &&
            (isTemporary(list[index - 1]) ||
                Number(list[index - 1].id) > Number(message.id))
        ) {
            if (isTemporary(message)) {
                break;
            }

            index -= 1;
        }

        list.splice(index, 0, message);
        cache.ids.add(String(message.id));

        return index;
    }

    /**
     * Adds a message to a conversation — an optimistic one being sent,
     * the server's answer, or a broadcast. Safe to call twice for the
     * same message.
     */
    function ingestMessage(conversationId, message, { scroll = null } = {}) {
        const cache = getCache(conversationId);
        const active = isActiveId(conversationId);

        if (cache.ids.has(String(message.id))) {
            return;
        }

        // Our own message, sent from this tab, coming back from elsewhere
        // before the send answered: it takes the pending copy's place.
        if (message.client_id) {
            const pendingCopy = cache.messages.find(
                (m) => isTemporary(m) && m.client_id === message.client_id,
            );

            if (pendingCopy) {
                replaceMessage(conversationId, pendingCopy.id, message);

                return;
            }
        }

        // A window parked in history (or never opened) does not take live
        // messages; they are fetched when the reader gets there.
        if (!cache.loaded || (cache.hasMoreAfter && !isTemporary(message))) {
            if (active) {
                renderJumpButtons();
            }

            return;
        }

        const wasAtBottom = active && isScrolledToBottom();
        const index = insertSorted(cache, message);
        const atEnd = index === cache.messages.length - 1;

        if (active) {
            if (atEnd) {
                appendMessageDOM(message);
            } else {
                renderMessagesKeepingPlace();
            }

            if (
                scroll === 'bottom' ||
                (message.is_mine && isTemporary(message)) ||
                wasAtBottom
            ) {
                scrollToBottom();
            }

            trimWindow(cache, 'start');
            renderJumpButtons();
            scheduleReadCheck();
        } else {
            trimWindow(cache, 'start');
        }
    }

    /** Keeps a window under MAX_MESSAGES_IN_MEMORY by dropping one side. */
    function trimWindow(cache, side) {
        const extra = cache.messages.length - MAX_MESSAGES_IN_MEMORY;

        if (extra <= 0) {
            return;
        }

        const dropped =
            side === 'start'
                ? cache.messages.splice(0, extra)
                : cache.messages.splice(cache.messages.length - extra, extra);

        dropped.forEach((m) => cache.ids.delete(String(m.id)));

        if (side === 'start') {
            cache.hasMoreBefore = true;
        } else {
            cache.hasMoreAfter = true;
        }

        if (cache.messages === messages) {
            renderMessagesKeepingPlace();
        }
    }

    /** Swaps a message (a pending copy) for another in place — list and DOM. */
    function replaceMessage(conversationId, oldId, message) {
        const cache = getCache(conversationId);
        const index = cache.messages.findIndex((m) => sameId(m.id, oldId));

        if (index === -1) {
            ingestMessage(conversationId, message);

            return;
        }

        cache.ids.delete(String(oldId));
        cache.messages.splice(index, 1);

        // The real one got here first: just drop the copy.
        if (cache.ids.has(String(message.id))) {
            if (isActiveId(conversationId)) {
                renderMessagesKeepingPlace();
            }

            return;
        }

        insertSorted(cache, message);

        if (isActiveId(conversationId)) {
            const row = messagesEl.querySelector(
                `[data-message-id="${CSS.escape(String(oldId))}"]`,
            );
            const stillLast =
                cache.messages[cache.messages.length - 1] === message ||
                cache.messages.slice(index).every(isTemporary);

            if (row && stillLast && index === cache.messages.indexOf(message)) {
                row.outerHTML = messageHtml(message, {
                    grouped: row.classList.contains('chat-msg--grouped'),
                });
            } else {
                renderMessagesKeepingPlace();
            }
        }

        const conversation = findConversation(conversationId);

        if (
            conversation?.last_message &&
            sameId(conversation.last_message.id, oldId)
        ) {
            conversation.last_message.id = message.id;
        }
    }

    function summaryFromMessage(message) {
        const attachment = message.attachments?.[0];

        return {
            id: message.id,
            type: message.type,
            preview: messagePreview(message),
            body: message.body,
            sender_id: message.sender?.id ?? null,
            sender_name: message.sender?.name ?? null,
            created_at_iso: message.created_at_iso,
            attachment_kind:
                message.body || !attachment ? null : attachmentKind(attachment),
            is_read: false,
        };
    }

    function onMessageSent(payload) {
        const conversationId = payload.conversation_id;
        const message = forViewer(payload.message);
        const conversation = findConversation(conversationId);

        clearTyping(conversationId, message.sender?.id);
        ingestMessage(conversationId, message);

        if (!conversation) {
            fetchSummary(conversationId);

            return;
        }

        const counts = !message.is_mine && message.type !== 'system';
        const mentionsMe = new RegExp(
            `@\\[[^\\]]+\\]\\(${Number(currentUser?.id)}\\)`,
        ).test(message.body || '');

        updateConversationSummary(
            conversationId,
            {
                last_message: summaryFromMessage(message),
                last_message_at_iso: message.created_at_iso,
                unread_count: counts
                    ? (conversation.unread_count || 0) + 1
                    : message.is_mine
                      ? 0
                      : conversation.unread_count || 0,
                unread_mentions_count:
                    counts && mentionsMe
                        ? (conversation.unread_mentions_count || 0) + 1
                        : conversation.unread_mentions_count || 0,
                // A new message brings an archived, unmuted chat back.
                is_archived:
                    conversation.is_archived && !conversation.is_muted && counts
                        ? false
                        : conversation.is_archived,
            },
            { bump: true },
        );

        if (listFolder === 'archived' && conversation.is_archived === false) {
            removeConversationFromList(conversationId);
        }

        if (isActiveId(conversationId)) {
            renderJumpButtons();
        }
    }

    function mergeMessage(conversationId, incoming) {
        const cache = getCache(conversationId);
        const index = cache.messages.findIndex((m) =>
            sameId(m.id, incoming.id),
        );

        if (index === -1) {
            return null;
        }

        const current = cache.messages[index];
        const merged = { ...current, ...incoming };

        // Broadcasts carry no viewer-specific bits.
        if (incoming.poll && current.poll && !incoming.poll.my_votes) {
            merged.poll = { ...incoming.poll, my_votes: current.poll.my_votes };
        }

        cache.messages[index] = merged;

        if (isActiveId(conversationId)) {
            patchMessageDOM(merged);
        }

        return merged;
    }

    function onMessageEdited(payload) {
        const conversationId = payload.conversation_id;
        const message = forViewer(payload.message);
        const merged = mergeMessage(conversationId, message) ?? message;

        if (isActiveId(conversationId)) {
            syncPinned(merged);
        }

        const conversation = findConversation(conversationId);

        if (
            conversation?.last_message &&
            sameId(conversation.last_message.id, message.id)
        ) {
            conversation.last_message.preview = messagePreview(merged);
            renderConversationList();
        }
    }

    function dropMessages(conversationId, ids) {
        const cache = getCache(conversationId);
        const wanted = new Set(ids.map(String));
        let removed = false;

        for (let i = cache.messages.length - 1; i >= 0; i -= 1) {
            if (wanted.has(String(cache.messages[i].id))) {
                cache.ids.delete(String(cache.messages[i].id));
                cache.messages.splice(i, 1);
                removed = true;
            }
        }

        if (isActiveId(conversationId)) {
            ids.forEach((id) => {
                removePinned(id);
                selection?.delete(String(id));
            });

            if (replyTarget && wanted.has(String(replyTarget.id))) {
                cancelReply();
            }

            if (editTarget && wanted.has(String(editTarget.id))) {
                cancelEdit();
            }

            if (removed) {
                renderMessagesKeepingPlace();
            }

            renderSelection();
        }
    }

    function onMessagesDeleted(payload) {
        dropMessages(payload.conversation_id, payload.message_ids || []);

        if ('last_message' in payload) {
            const conversation = findConversation(payload.conversation_id);

            if (conversation) {
                conversation.last_message = payload.last_message;
                renderConversationList();
            }
        }
    }

    function onMessagesHidden(payload) {
        dropMessages(payload.conversation_id, payload.message_ids || []);
        fetchSummary(payload.conversation_id);
    }

    function onReactionToggled(payload) {
        const message = getCache(payload.conversation_id).messages.find((m) =>
            sameId(m.id, payload.message_id),
        );

        if (!message) {
            return;
        }

        message.reactions = payload.reactions;

        if (isActiveId(payload.conversation_id)) {
            patchMessageDOM(message);
        }
    }

    function onPollUpdated(payload) {
        const message = getCache(payload.conversation_id).messages.find((m) =>
            sameId(m.id, payload.message_id),
        );

        if (!message) {
            return;
        }

        message.poll = {
            ...payload.poll,
            my_votes: payload.poll?.my_votes ?? message.poll?.my_votes ?? [],
        };

        if (isActiveId(payload.conversation_id)) {
            patchMessageDOM(message);
        }
    }

    function onMessageReadEvent(payload) {
        const conversationId = payload.conversation_id;

        // My own other tab or device read it: the counts follow.
        if (sameId(payload.user_id, currentUser?.id)) {
            updateConversationSummary(conversationId, {
                unread_count: payload.unread_count ?? 0,
                last_read_message_id: payload.message_id,
                marked_unread: false,
                unread_mentions_count:
                    (payload.unread_count ?? 0) === 0
                        ? 0
                        : (findConversation(conversationId)
                              ?.unread_mentions_count ?? 0),
            });

            if (isActiveId(conversationId)) {
                renderJumpButtons();
            }

            return;
        }

        // Someone else read up to this id: my messages up to it are read.
        getCache(conversationId)
            .messages.filter(
                (m) =>
                    !isTemporary(m) &&
                    m.is_mine &&
                    !m.is_read &&
                    Number(m.id) <= Number(payload.message_id),
            )
            .forEach((message) => {
                message.is_read = true;
                message.read_count = (message.read_count || 0) + 1;

                if (isActiveId(conversationId)) {
                    patchMessageDOM(message);
                }
            });

        const conversation = findConversation(conversationId);

        if (
            conversation?.last_message &&
            Number(conversation.last_message.id) <= Number(payload.message_id)
        ) {
            conversation.last_message.is_read = true;
            renderConversationList();
        }
    }

    function onUserTyping(payload) {
        const conversationId = String(payload.conversation_id);

        if (sameId(payload.user_id, currentUser?.id)) {
            return;
        }

        if (!typingByConversation.has(conversationId)) {
            typingByConversation.set(conversationId, new Map());
        }

        const bucket = typingByConversation.get(conversationId);
        window.clearTimeout(bucket.get(payload.user_id)?.timer);

        const timer = window.setTimeout(() => {
            bucket.delete(payload.user_id);
            renderTyping(conversationId);
        }, 4500);

        bucket.set(payload.user_id, {
            name: payload.user_name,
            kind: payload.kind || 'typing',
            timer,
        });
        renderTyping(conversationId);
    }

    function clearTyping(conversationId, userId) {
        const bucket = typingByConversation.get(String(conversationId));
        const entry = bucket?.get(userId);

        if (entry) {
            window.clearTimeout(entry.timer);
            bucket.delete(userId);
            renderTyping(conversationId);
        }
    }

    /** Typing shows in three places: the list, the header and under the last message. */
    function renderTyping(conversationId) {
        renderConversationList();

        if (!isActiveId(conversationId)) {
            return;
        }

        const label = typingLabel(conversationId);

        typingEl.hidden = !label;
        typingText.textContent = label;
        renderThreadStatus();
    }

    function onConversationUpdated(payload) {
        const patch = {
            title: payload.title,
            description: payload.description,
            avatar: payload.avatar,
            members_count: payload.members_count,
        };
        const conversation = findConversation(payload.conversation_id);

        if (conversation && conversation.type !== 'private') {
            updateConversationSummary(payload.conversation_id, patch);
        }

        if (isActiveId(payload.conversation_id)) {
            if (activeConversation.type !== 'private') {
                Object.assign(activeConversation, patch);
            }

            renderThreadHeader();
            loadMembers(activeConversation.id).then(() => {
                renderThreadStatus();
                refreshDetails({ quiet: true });
            });
        }
    }

    function onConversationSettings(payload) {
        const patch = {
            is_muted: payload.is_muted,
            muted_until_iso: payload.muted_until_iso,
            is_archived: payload.is_archived,
            is_pinned: payload.is_pinned,
            marked_unread: payload.marked_unread,
        };

        if (payload.unread_count !== undefined) {
            patch.unread_count = payload.unread_count;
        }

        applySettings(payload.conversation_id, patch);
    }

    /** A chat's per-member settings changed (here or on another device). */
    function applySettings(conversationId, patch) {
        const conversation = findConversation(conversationId);
        const wrongFolder =
            patch.is_archived !== undefined &&
            (listFolder === 'archived') !== Boolean(patch.is_archived);

        if (conversation) {
            Object.assign(conversation, patch);
            placeConversation(conversation);
        }

        if (wrongFolder) {
            removeConversationFromList(conversationId);
            hasArchive = hasArchive || Boolean(patch.is_archived);
            loadUnreadSummary().then(renderConversationList);
        } else if (!conversation) {
            fetchSummary(conversationId);
        }

        if (isActiveId(conversationId)) {
            Object.assign(activeConversation, patch);

            if (activeShow?.settings) {
                Object.assign(activeShow.settings, patch);
            }
        }

        renderConversationList();
    }

    function onConversationRemoved(payload) {
        const conversationId = payload.conversation_id;

        conversationCache.delete(String(conversationId));

        if (payload.reason === 'cleared') {
            if (isActiveId(conversationId)) {
                reloadActiveWindow();
            }

            fetchSummary(conversationId);

            return;
        }

        removeConversationFromList(conversationId);

        if (isActiveId(conversationId)) {
            closeConversation();
            showToast(
                t(
                    payload.reason === 'deleted'
                        ? 'chat.removed.deleted'
                        : payload.reason === 'left'
                          ? 'chat.removed.left'
                          : 'chat.removed.removed',
                ),
                'info',
            );
        }
    }

    function onConversationActivity(payload) {
        if (!findConversation(payload.conversation_id)) {
            fetchSummary(payload.conversation_id);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Thread header
    |--------------------------------------------------------------------------
    */

    function onlineMembers() {
        return members.filter((m) => isOnline(m.id));
    }

    function renderThreadStatus() {
        const conversation = activeConversation;

        if (!conversation) {
            return;
        }

        threadStatus.classList.remove(
            'chat-thread-header__status--online',
            'chat-thread-header__status--typing',
        );

        if (conversation.is_saved) {
            threadStatus.textContent = t('chat.saved_hint');

            return;
        }

        const typing = typingLabel(conversation.id, {
            withName: conversation.type !== 'private',
        });

        if (typing) {
            threadStatus.classList.add('chat-thread-header__status--typing');
            threadStatus.textContent = typing;

            return;
        }

        if (conversation.type === 'private') {
            if (isOnline(conversation.other_user_id)) {
                threadStatus.classList.add(
                    'chat-thread-header__status--online',
                );
                threadStatus.textContent = t('chat.online');

                return;
            }

            threadStatus.textContent = lastSeenText(
                conversation.other_user?.last_seen_at_iso ||
                    members.find((m) =>
                        sameId(m.id, conversation.other_user_id),
                    )?.last_seen_at,
            );

            return;
        }

        const count = conversation.members_count || members.length;
        const online = onlineMembers().length;

        threadStatus.textContent = count
            ? `${tChoice('chat.members_plural', count)}${online ? ` · ${t('chat.online_count', { count: online })}` : ''}`
            : '';
    }

    function renderThreadHeader() {
        const conversation = activeConversation;

        threadTitle.textContent = titleOf(conversation);
        // The element stays (others hold it); only its look changes.
        const template = document.createElement('template');
        template.innerHTML = conversationAvatarHtml(
            conversation,
            'chat-thread-header__avatar',
        ).trim();
        threadAvatar.className = template.content.firstElementChild.className;
        threadAvatar.innerHTML = template.content.firstElementChild.innerHTML;
        renderThreadStatus();
    }

    /** The composer, or a banner saying why this chat cannot be written to. */
    function renderComposerState() {
        const conversation = activeConversation;

        if (!conversation) {
            composer.hidden = true;
            blockedEl.hidden = true;

            return;
        }

        const canSend = conversation.can_send !== false;

        composer.hidden = !canSend || Boolean(selection);
        blockedEl.hidden = canSend;
        unblockBtn.hidden = !(
            conversation.type === 'private' && conversation.is_blocked
        );

        if (!canSend) {
            blockedText.textContent =
                conversation.type === 'channel'
                    ? t('chat.block.channel_read_only')
                    : conversation.is_blocked
                      ? t('chat.block.you_blocked')
                      : t('chat.block.cannot_send');
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Message rendering — cards, yours on the right
    |--------------------------------------------------------------------------
    */

    function reactionBar(message) {
        if (!message.reactions?.length) {
            return '';
        }

        return `
            <div class="chat-msg__reactions">
                ${message.reactions
                    .map(
                        (r) => `
                    <button
                        type="button"
                        class="chat-reaction-pill ${(r.user_ids || []).some((id) => sameId(id, currentUser?.id)) ? 'chat-reaction-pill--mine' : ''}"
                        data-react="${escapeHtml(message.id)}"
                        data-emoji="${escapeHtml(r.emoji)}"
                    >${escapeHtml(r.emoji)} <span class="mono">${Number(r.count) || 0}</span></button>
                `,
                    )
                    .join('')}
            </div>
        `;
    }

    function statusIcon(message) {
        if (!message.is_mine || activeConversation?.is_saved) {
            return '';
        }

        if (message.status === 'failed') {
            return `<span class="chat-card__ticks--failed" title="${escapeHtml(t('chat.failed'))}">${icon('alert', { size: 13 })}</span>`;
        }

        if (isTemporary(message)) {
            return `<span title="${escapeHtml(t('chat.sending'))}">${icon('clock', { size: 13 })}</span>`;
        }

        const isRead =
            Boolean(message.is_read) || (message.read_count || 0) > 0;

        return `<span class="${isRead ? 'chat-card__ticks--read' : ''}" title="${escapeHtml(isRead ? t('chat.read') : t('chat.sent'))}">${icon(isRead ? 'checks' : 'check', { size: 14 })}</span>`;
    }

    /** Telegram-style runs: same sender, same day, within 10 minutes. */
    function isGroupedWithPrevious(previous, current) {
        if (
            !previous ||
            previous.type === 'system' ||
            current.type === 'system' ||
            !sameId(previous.sender?.id, current.sender?.id)
        ) {
            return false;
        }

        if (
            dayKey(previous.created_at_iso) !== dayKey(current.created_at_iso)
        ) {
            return false;
        }

        const prevTime = new Date(previous.created_at_iso).getTime();
        const currTime = new Date(current.created_at_iso).getTime();

        return (
            Number.isFinite(prevTime) &&
            Number.isFinite(currTime) &&
            Math.abs(currTime - prevTime) < 10 * 60 * 1000
        );
    }

    function canClosePoll(message) {
        return message.is_mine || isManagerRole(activeConversation?.my_role);
    }

    function messageHtml(message, { grouped = false } = {}) {
        if (message.type === 'system') {
            return systemHtml(message);
        }

        const mine = message.is_mine;
        const isGroupChat =
            activeConversation &&
            !['private', 'saved'].includes(activeConversation.type);
        const pending = isTemporary(message);
        const senderName = message.sender?.name || '';
        const senderId = message.sender?.id;
        const selected = selection?.has(String(message.id));
        const bigEmoji =
            !message.attachments?.length && isEmojiOnly(message.body);

        const classes = [
            'chat-msg',
            mine ? 'chat-msg--mine' : '',
            grouped ? 'chat-msg--grouped' : '',
            isGroupChat ? '' : 'chat-msg--private',
            pending && message.status !== 'failed' ? 'chat-msg--pending' : '',
            message.status === 'failed' ? 'chat-msg--failed' : '',
            selected ? 'chat-msg--selected' : '',
            bigEmoji ? 'chat-msg--emoji' : '',
        ]
            .filter(Boolean)
            .join(' ');

        const avatar =
            !mine && isGroupChat && !grouped
                ? `<button type="button" class="chat-msg__avatar-btn" data-profile-user="${Number(senderId)}" aria-label="${escapeHtml(t('chat.profile_of', { name: senderName }))}">${avatarHtml(senderName, message.sender?.avatar, { className: 'chat-msg__avatar', online: isOnline(senderId) })}</button>`
                : '';

        const sender =
            !mine && isGroupChat && !grouped
                ? `<button type="button" class="chat-card__sender chat-card__sender--${avatarHue(senderName)}" data-profile-user="${Number(senderId)}">${escapeHtml(senderName)}</button>`
                : '';

        const reply = message.reply_to
            ? `
                <button type="button" class="chat-card__reply" data-scroll-to="${Number(message.reply_to.id)}">
                    <span class="chat-card__reply-name">${escapeHtml(message.reply_to.sender_name || '')}</span>
                    <span class="chat-card__reply-text">${escapeHtml(message.reply_to.body ? plainText(message.reply_to.body) : kindLabel(message.reply_to.attachment_kind))}</span>
                </button>
            `
            : '';

        const actions =
            pending || selection
                ? ''
                : `
                <div class="chat-msg__actions" role="toolbar">
                    <button type="button" class="chat-msg__action" data-msg-action="react" aria-label="${escapeHtml(t('chat.react'))}" title="${escapeHtml(t('chat.react'))}">${icon('smile', { size: 15 })}</button>
                    <button type="button" class="chat-msg__action" data-msg-action="reply" aria-label="${escapeHtml(t('chat.reply'))}" title="${escapeHtml(t('chat.reply'))}">${icon('reply', { size: 15 })}</button>
                    <button type="button" class="chat-msg__action" data-msg-action="forward" aria-label="${escapeHtml(t('chat.menu.forward'))}" title="${escapeHtml(t('chat.menu.forward'))}">${icon('forward', { size: 15 })}</button>
                    <button type="button" class="chat-msg__action" data-msg-action="info" aria-label="${escapeHtml(t('chat.menu.info'))}" title="${escapeHtml(t('chat.menu.info'))}">${icon('info', { size: 15 })}</button>
                    <button type="button" class="chat-msg__action" data-msg-action="more" aria-label="${escapeHtml(t('chat.more'))}" title="${escapeHtml(t('chat.more'))}">${icon('more', { size: 15 })}</button>
                </div>
            `;

        const body =
            message.type === 'poll'
                ? pollHtml(message, {
                      canClose: canClosePoll(message),
                      picked: pollPicks.get(String(message.id)) || [],
                  })
                : message.body
                  ? `<div class="chat-card__body">${renderRichText(message.body)}</div>`
                  : '';

        return `
            <div class="${classes}" data-message-id="${escapeHtml(message.id)}">
                ${selection ? `<span class="chat-msg__check" aria-hidden="true">${selected ? icon('check', { size: 12 }) : ''}</span>` : ''}
                <div class="chat-msg__avatar-slot">${avatar}</div>
                <div class="chat-msg__column">
                    <div class="chat-card">
                        ${sender}
                        ${forwardedHtml(message)}
                        ${reply}
                        ${attachmentsHtml(message)}
                        ${body}
                        ${linkPreviewHtml(message)}
                        <span class="chat-card__meta">
                            ${message.is_pinned ? icon('pin', { size: 11, className: 'chat-card__pin-icon' }) : ''}
                            ${message.edited_at_iso || message.edit_count ? `<span class="chat-card__edited">${escapeHtml(t('chat.edited'))}</span>` : ''}
                            <span class="mono" title="${escapeHtml(formatTime(message.created_at_iso, { seconds: true }))}">${escapeHtml(formatTime(message.created_at_iso))}</span>
                            ${statusIcon(message)}
                        </span>
                    </div>
                    ${message.status === 'failed' ? `<button type="button" class="chat-card__retry" data-retry="${escapeHtml(message.id)}">${icon('refresh', { size: 12 })} ${escapeHtml(t('chat.retry'))}</button>` : ''}
                    ${reactionBar(message)}
                </div>
                ${actions}
            </div>
        `;
    }

    function unreadDividerHtml() {
        return `<div class="chat-unread-divider" data-unread-divider><span>${escapeHtml(t('chat.unread_divider'))}</span></div>`;
    }

    function dayOpen(message) {
        return `<section class="chat-day" data-day="${escapeHtml(dayKey(message.created_at_iso))}"><div class="chat-day-divider"><span>${escapeHtml(dayLabel(message.created_at_iso))}</span></div>`;
    }

    /**
     * The whole window as day sections (each day's chip is sticky only
     * inside its own section, so chips never pile up), with the
     * "unread messages" divider before the first unread one.
     */
    function messagesHtml(list) {
        const cache = activeConversation
            ? getCache(activeConversation.id)
            : null;
        let html = '';
        let previous = null;
        let currentDay = null;

        list.forEach((message) => {
            const day = dayKey(message.created_at_iso);

            if (day !== currentDay) {
                html += `${currentDay !== null ? '</section>' : ''}${dayOpen(message)}`;
                currentDay = day;
                previous = null;
            }

            if (
                cache?.unreadDividerId &&
                sameId(cache.unreadDividerId, message.id)
            ) {
                html += unreadDividerHtml();
                previous = null;
            }

            html += messageHtml(message, {
                grouped: isGroupedWithPrevious(previous, message),
            });
            previous = message;
        });

        return currentDay !== null ? `${html}</section>` : html;
    }

    function renderMessageList() {
        if (!messages.length) {
            messagesEl.innerHTML = emptyState(
                escapeHtml(
                    activeConversation?.is_saved
                        ? t('chat.saved_empty')
                        : t('chat.empty_messages'),
                ),
            );

            return;
        }

        messagesEl.innerHTML = messagesHtml(messages);
    }

    /** The first row at least partly in view and how far down it sits. */
    function viewAnchor() {
        const top = messagesEl.getBoundingClientRect().top;
        const rows = messagesEl.querySelectorAll('[data-message-id]');

        for (const row of rows) {
            const rect = row.getBoundingClientRect();

            if (rect.bottom > top) {
                return { id: row.dataset.messageId, offset: rect.top - top };
            }
        }

        return null;
    }

    /** Re-renders the window without moving what the reader is looking at. */
    function renderMessagesKeepingPlace() {
        const atBottom = isScrolledToBottom();
        const anchor = atBottom ? null : viewAnchor();

        renderMessageList();

        if (atBottom) {
            scrollToBottom();

            return;
        }

        const row = anchor
            ? messagesEl.querySelector(
                  `[data-message-id="${CSS.escape(anchor.id)}"]`,
              )
            : null;

        if (row) {
            const top = messagesEl.getBoundingClientRect().top;
            messagesEl.scrollTop +=
                row.getBoundingClientRect().top - top - anchor.offset;
        }
    }

    function appendMessageDOM(message) {
        const index = messages.indexOf(message);
        const previous = index > 0 ? messages[index - 1] : null;
        const lastSection = messagesEl.querySelector(
            ':scope > .chat-day:last-of-type',
        );

        if (!previous || !lastSection) {
            renderMessageList();

            return;
        }

        if (lastSection.dataset.day === dayKey(message.created_at_iso)) {
            lastSection.insertAdjacentHTML(
                'beforeend',
                messageHtml(message, {
                    grouped: isGroupedWithPrevious(previous, message),
                }),
            );
        } else {
            messagesEl.insertAdjacentHTML(
                'beforeend',
                `${dayOpen(message)}${messageHtml(message)}</section>`,
            );
        }
    }

    function patchMessageDOM(message) {
        const row = messagesEl.querySelector(
            `[data-message-id="${CSS.escape(String(message.id))}"]`,
        );

        if (!row) {
            return;
        }

        row.outerHTML = messageHtml(message, {
            grouped: row.classList.contains('chat-msg--grouped'),
        });
    }

    function isScrolledToBottom() {
        return (
            messagesEl.scrollHeight -
                messagesEl.scrollTop -
                messagesEl.clientHeight <
            80
        );
    }

    function scrollToBottom() {
        messagesEl.scrollTop = messagesEl.scrollHeight;
        stickToBottom = true;
        renderJumpButtons();
    }

    /** The floating ↑ and ↓ buttons, with the unread count on ↓. */
    function renderJumpButtons() {
        if (!activeConversation) {
            jumpTopBtn.hidden = true;
            scrollBottomBtn.hidden = true;

            return;
        }

        const cache = getCache(activeConversation.id);
        const distanceFromBottom =
            messagesEl.scrollHeight -
            messagesEl.scrollTop -
            messagesEl.clientHeight;
        const unread =
            findConversation(activeConversation.id)?.unread_count ??
            activeConversation.unread_count ??
            0;

        scrollBottomBtn.hidden = !(
            cache.hasMoreAfter || distanceFromBottom > 300
        );
        scrollBottomCount.hidden = !unread;
        scrollBottomCount.textContent = unread > 99 ? '99+' : String(unread);
        jumpTopBtn.hidden = !(
            messages.length &&
            (cache.hasMoreBefore ||
                messagesEl.scrollTop > messagesEl.clientHeight)
        );
    }

    let windowLoadInFlight = false;
    /** The reader is at the newest message: layout changes keep them there. */
    let stickToBottom = false;

    messagesEl?.addEventListener(
        'scroll',
        () => {
            stickToBottom =
                isScrolledToBottom() &&
                !(
                    activeConversation &&
                    getCache(activeConversation.id).hasMoreAfter
                );
            renderJumpButtons();
            scheduleReadCheck();

            if (!activeConversation || windowLoadInFlight) {
                return;
            }

            const cache = getCache(activeConversation.id);

            if (
                cache.loaded &&
                cache.hasMoreBefore &&
                messagesEl.scrollTop < 300
            ) {
                loadBefore(activeConversation.id);
            } else if (
                cache.loaded &&
                cache.hasMoreAfter &&
                messagesEl.scrollHeight -
                    messagesEl.scrollTop -
                    messagesEl.clientHeight <
                    300
            ) {
                loadAfter(activeConversation.id);
            }
        },
        { signal, passive: true },
    );

    scrollBottomBtn?.addEventListener('click', () => jumpToEnd(), { signal });
    jumpTopBtn?.addEventListener('click', () => jumpToStart(), { signal });

    // The jump buttons float just above whatever sits under the thread
    // (the composer grows with replies, files and long text).
    const bottomObserver = new ResizeObserver(() => {
        if (stickToBottom) {
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        const offset =
            threadPane.getBoundingClientRect().bottom -
            messagesEl.getBoundingClientRect().bottom;

        threadPane.style.setProperty(
            '--chat-bottom-offset',
            `${Math.max(0, Math.round(offset))}px`,
        );
    });

    bottomObserver.observe(messagesEl);

    // A photo or video that finishes loading must not push the newest
    // message out of view.
    messagesEl?.addEventListener(
        'load',
        () => {
            if (stickToBottom) {
                messagesEl.scrollTop = messagesEl.scrollHeight;
            }
        },
        { signal, capture: true },
    );

    /*
    |--------------------------------------------------------------------------
    | Read receipts — what was actually on screen, one request per chat
    |--------------------------------------------------------------------------
    */

    const readQueue = new Map(); // conversationId -> newest message id to mark
    let readTimer = null;
    let readCheckFrame = 0;

    function scheduleReadCheck() {
        if (readCheckFrame) {
            return;
        }

        readCheckFrame = window.requestAnimationFrame(() => {
            readCheckFrame = 0;
            checkRead();
        });
    }

    /**
     * Marks read up to the newest message the reader can see — only while
     * this page is alive, the tab is visible and the window is focused-ish.
     */
    function checkRead() {
        if (
            !isAlive() ||
            !activeConversation ||
            document.visibilityState !== 'visible' ||
            !messagesEl.isConnected
        ) {
            return;
        }

        const conversation =
            findConversation(activeConversation.id) || activeConversation;
        const bottom = messagesEl.getBoundingClientRect().bottom;
        const rows = [...messagesEl.querySelectorAll('[data-message-id]')];
        let visibleId = null;

        for (let i = rows.length - 1; i >= 0; i -= 1) {
            const id = rows[i].dataset.messageId;

            if (String(id).startsWith('tmp-')) {
                continue;
            }

            if (rows[i].getBoundingClientRect().top < bottom - 12) {
                visibleId = Number(id);
                break;
            }
        }

        if (!visibleId) {
            return;
        }

        const readUpTo = Number(conversation.last_read_message_id) || 0;

        if (
            visibleId > readUpTo ||
            conversation.marked_unread ||
            (conversation.unread_count > 0 &&
                !getCache(activeConversation.id).hasMoreAfter &&
                isScrolledToBottom())
        ) {
            scheduleMarkRead(
                activeConversation.id,
                Math.max(visibleId, readUpTo),
            );
        }
    }

    /** The newest id already sent per chat, and when — no repeats. */
    const readPosted = new Map();

    function scheduleMarkRead(conversationId, messageId) {
        const posted = readPosted.get(String(conversationId));
        const conversation = findConversation(conversationId);

        if (
            posted &&
            Number(messageId) <= posted.id &&
            Date.now() - posted.at < 5000 &&
            !conversation?.marked_unread
        ) {
            return;
        }

        const queued = readQueue.get(String(conversationId));

        if (!queued || Number(messageId) > Number(queued)) {
            readQueue.set(String(conversationId), messageId);
        }

        window.clearTimeout(readTimer);
        readTimer = window.setTimeout(flushReads, 300);
    }

    async function markRead(conversationId, messageId = null) {
        try {
            const { data } = await api.post(
                `/conversations/${conversationId}/read`,
                messageId ? { message_id: messageId } : {},
            );
            const state = data.data || {};

            updateConversationSummary(conversationId, {
                unread_count: state.unread_count ?? 0,
                last_read_message_id: state.last_read_message_id ?? messageId,
                marked_unread: Boolean(state.marked_unread),
                unread_mentions_count:
                    (state.unread_count ?? 0) === 0
                        ? 0
                        : (findConversation(conversationId)
                              ?.unread_mentions_count ?? 0),
            });

            if (isActiveId(conversationId)) {
                activeConversation.last_read_message_id =
                    state.last_read_message_id ?? messageId;
                renderJumpButtons();
            }

            // This tab's own read never comes back over the socket.
            document.dispatchEvent(
                new CustomEvent('sidebar:unread', {
                    detail: { conversationId },
                }),
            );
        } catch {
            // The next scroll tries again.
        }
    }

    function flushReads() {
        const batch = [...readQueue.entries()];
        readQueue.clear();

        batch.forEach(([conversationId, messageId]) => {
            const conversation = findConversation(conversationId);

            readPosted.set(String(conversationId), {
                id: Number(messageId),
                at: Date.now(),
            });

            // Optimistic: no second request for the same id meanwhile.
            if (conversation) {
                conversation.last_read_message_id = Math.max(
                    Number(conversation.last_read_message_id) || 0,
                    Number(messageId),
                );
            }

            markRead(conversationId, messageId);
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Message history — windows: newest, older, newer, around, first
    |--------------------------------------------------------------------------
    */

    async function fetchWindow(conversationId, params) {
        const { data } = await api.get(
            `/conversations/${conversationId}/messages`,
            { params: { limit: PAGE_SIZE, ...params } },
        );

        return {
            list: (data.data || []).map(forViewer),
            meta: data.meta || {},
        };
    }

    /** Older messages above the window. */
    async function loadBefore(conversationId) {
        const cache = getCache(conversationId);
        const oldest = cache.messages.find((m) => !isTemporary(m));

        if (!cache.hasMoreBefore || windowLoadInFlight || !oldest) {
            return;
        }

        windowLoadInFlight = true;
        const token = windowToken;

        try {
            const { list, meta } = await fetchWindow(conversationId, {
                before_id: oldest.id,
            });

            if (token !== windowToken || !isAlive()) {
                return;
            }

            cache.hasMoreBefore = Boolean(meta.has_more_before);
            const fresh = list.filter((m) => !cache.ids.has(String(m.id)));
            fresh.forEach((m) => cache.ids.add(String(m.id)));
            cache.messages.unshift(...fresh);
            trimWindow(cache, 'end');

            if (isActiveId(conversationId)) {
                renderMessagesKeepingPlace();
            }
        } catch {
            // A failed "load more" isn't fatal — scrolling again retries.
        } finally {
            windowLoadInFlight = false;
            renderJumpButtons();
        }
    }

    /** Newer messages below a window parked in history. */
    async function loadAfter(conversationId) {
        const cache = getCache(conversationId);
        const newest = [...cache.messages]
            .reverse()
            .find((m) => !isTemporary(m));

        if (!cache.hasMoreAfter || windowLoadInFlight || !newest) {
            return;
        }

        windowLoadInFlight = true;
        const token = windowToken;

        try {
            const { list, meta } = await fetchWindow(conversationId, {
                after_id: newest.id,
            });

            if (token !== windowToken || !isAlive()) {
                return;
            }

            cache.hasMoreAfter = Boolean(meta.has_more_after);
            list.filter((m) => !cache.ids.has(String(m.id))).forEach((m) => {
                cache.ids.add(String(m.id));
                cache.messages.push(m);
            });

            if (isActiveId(conversationId)) {
                renderMessagesKeepingPlace();
                trimWindow(cache, 'start');
            }
        } catch {
            // Scrolling again retries.
        } finally {
            windowLoadInFlight = false;
            renderJumpButtons();
            scheduleReadCheck();
        }
    }

    /** A token per window replacement: a slower, older load is ignored. */
    let windowToken = 0;

    async function replaceWindow(conversationId, params) {
        const token = ++windowToken;
        const result = await fetchWindow(conversationId, params);

        if (token !== windowToken || !isAlive()) {
            return null;
        }

        setWindow(getCache(conversationId), result.list, result.meta);

        return result;
    }

    /** "В самый верх": the very first message of the chat. */
    async function jumpToStart() {
        if (!activeConversation) {
            return;
        }

        const conversationId = activeConversation.id;
        const cache = getCache(conversationId);

        if (!cache.hasMoreBefore) {
            messagesEl.scrollTo({ top: 0, behavior: 'smooth' });

            return;
        }

        try {
            if (!(await replaceWindow(conversationId, { from: 'start' }))) {
                return;
            }

            if (isActiveId(conversationId)) {
                renderMessageList();
                messagesEl.scrollTop = 0;
                renderJumpButtons();
            }
        } catch (error) {
            showToast(
                apiErrorMessage(error, t('chat.messages_error')),
                'error',
            );
        }
    }

    /** "В самый низ": the newest message (loads it when the window is parked). */
    async function jumpToEnd() {
        if (!activeConversation) {
            return;
        }

        const conversationId = activeConversation.id;
        const cache = getCache(conversationId);

        if (!cache.hasMoreAfter) {
            messagesEl.scrollTo({
                top: messagesEl.scrollHeight,
                behavior: 'smooth',
            });
            scheduleMarkReadLatest();

            return;
        }

        try {
            if (!(await replaceWindow(conversationId, { from: 'end' }))) {
                return;
            }

            if (isActiveId(conversationId)) {
                renderMessageList();
                scrollToBottom();
                scheduleMarkReadLatest();
            }
        } catch (error) {
            showToast(
                apiErrorMessage(error, t('chat.messages_error')),
                'error',
            );
        }
    }

    function scheduleMarkReadLatest() {
        const latest = [...messages].reverse().find((m) => !isTemporary(m));
        const conversation =
            activeConversation && findConversation(activeConversation.id);

        if (
            latest &&
            conversation &&
            (conversation.unread_count > 0 || conversation.marked_unread) &&
            document.visibilityState === 'visible'
        ) {
            scheduleMarkRead(activeConversation.id, latest.id);
        }
    }

    function highlightRow(row) {
        row.classList.remove('chat-msg--highlight');
        void row.offsetWidth;
        row.classList.add('chat-msg--highlight');
        window.setTimeout(
            () => row.classList.remove('chat-msg--highlight'),
            1600,
        );
    }

    /**
     * Shows one message: scrolls to it when loaded, otherwise loads the
     * window around it first. One request at most — never a loop.
     */
    async function jumpToMessage(
        conversationId,
        messageId,
        { smooth = true } = {},
    ) {
        if (!isActiveId(conversationId)) {
            return;
        }

        const selector = `[data-message-id="${CSS.escape(String(messageId))}"]`;
        let row = messagesEl.querySelector(selector);

        if (!row) {
            try {
                if (
                    !(await replaceWindow(conversationId, {
                        around_id: messageId,
                    }))
                ) {
                    return;
                }
            } catch (error) {
                showToast(
                    apiErrorMessage(error, t('chat.messages_error')),
                    'error',
                );

                return;
            }

            if (!isActiveId(conversationId)) {
                return;
            }

            renderMessageList();
            row = messagesEl.querySelector(selector);
            smooth = false;
        }

        if (!row) {
            showToast(t('chat.message_gone'), 'info');

            return;
        }

        row.scrollIntoView({
            behavior: smooth ? 'smooth' : 'auto',
            block: 'center',
        });
        highlightRow(row);
        renderJumpButtons();
    }

    /**
     * The first load of a chat: at the first unread message (with the
     * divider) when there is one, otherwise at the newest.
     */
    async function loadInitialWindow(conversation) {
        const conversationId = conversation.id;
        const cache = getCache(conversationId);
        const unread = (conversation.unread_count || 0) > 0;
        const lastRead = Number(conversation.last_read_message_id) || 0;

        if (cache.loaded && !cache.hasMoreAfter && !unread) {
            cache.unreadDividerId = null;
            renderMessageList();
            scrollToBottom();

            return;
        }

        messagesEl.innerHTML =
            '<div class="chat-messages__loading"><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div></div>';

        try {
            const result = await replaceWindow(
                conversationId,
                unread && lastRead
                    ? { around_id: lastRead, limit: 60 }
                    : unread
                      ? { from: 'start', limit: 60 }
                      : { from: 'end' },
            );

            if (!result || !isActiveId(conversationId)) {
                return;
            }

            cache.unreadDividerId = unread ? result.meta.first_unread_id : null;
            renderMessageList();

            const divider = messagesEl.querySelector('[data-unread-divider]');

            if (divider) {
                // Just under the sticky day chip.
                messagesEl.scrollTop +=
                    divider.getBoundingClientRect().top -
                    messagesEl.getBoundingClientRect().top -
                    44;
            } else {
                scrollToBottom();
            }

            renderJumpButtons();
            scheduleReadCheck();
        } catch (error) {
            if (isActiveId(conversationId)) {
                messagesEl.innerHTML = emptyState(
                    escapeHtml(t('chat.messages_error')),
                );
                showToast(
                    apiErrorMessage(error, t('chat.messages_error')),
                    'error',
                );
            }
        }
    }

    /** A history clear or a reconnect: the open chat's newest window again. */
    async function reloadActiveWindow() {
        if (!activeConversation) {
            return;
        }

        const conversationId = activeConversation.id;
        const atBottom = isScrolledToBottom();
        const cache = getCache(conversationId);

        try {
            const params =
                cache.hasMoreAfter && !atBottom ? null : { from: 'end' };

            if (!params) {
                return;
            }

            if (!(await replaceWindow(conversationId, params))) {
                return;
            }

            if (isActiveId(conversationId)) {
                renderMessagesKeepingPlace();

                if (atBottom) {
                    scrollToBottom();
                }

                scheduleReadCheck();
            }
        } catch {
            // Realtime events cover the normal case.
        }
    }

    async function loadMembers(conversationId) {
        try {
            const { data } = await api.get(
                `/conversations/${conversationId}/members`,
                { params: { per_page: 100 } },
            );

            if (isActiveId(conversationId)) {
                members = data.data || [];
            }
        } catch {
            if (isActiveId(conversationId)) {
                members = [];
            }
        }
    }

    async function loadShow(conversationId) {
        try {
            const { data } = await api.get(`/conversations/${conversationId}`);

            if (isActiveId(conversationId)) {
                activeShow = data.data;
                activeConversation.my_role =
                    activeShow.my_role ?? activeConversation.my_role;
            }
        } catch {
            if (isActiveId(conversationId)) {
                activeShow = null;
            }
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Opening a conversation
    |--------------------------------------------------------------------------
    */

    async function openConversation(conversation) {
        if (!isActiveId(conversation.id)) {
            if (activeConversation && !editTarget) {
                saveDraft(activeConversation.id, composerInput.value);
            }

            flushReads();
            exitSelection();
            cancelReply();
            cancelEdit({ restoreDraft: false });
            stopRecording({ send: false });
            pendingAttachments = [];
            renderPendingAttachments();
            members = [];
            activeShow = null;
            pinned = [];
            pinnedIndex = 0;
            typingSentAt = 0;
        }

        activeConversation = conversation;
        setActiveConversationId(conversation.id);

        // The module-level `messages` is an alias for this conversation's
        // cache array — every render/patch function reads through it.
        messages = getCache(conversation.id).messages;
        shell.dataset.view = 'conversation';

        if (!window.location.pathname.endsWith(`/chat/${conversation.id}`)) {
            window.history.pushState(
                window.history.state,
                '',
                `/chat/${conversation.id}`,
            );
        }

        threadHeader.hidden = false;
        searchPanel.hidden = true;

        renderThreadHeader();
        renderComposerState();
        renderConversationList();
        renderPinnedBar();

        typingEl.hidden = !typingLabel(conversation.id);
        typingText.textContent = typingLabel(conversation.id);

        composerInput.value = loadDraft(conversation.id);
        autoGrow();

        if (window.matchMedia('(hover: hover)').matches && !composer.hidden) {
            composerInput.focus();
        }

        // Info opens beside the thread wherever there is room for it,
        // unless the user closed it last time.
        const infoWanted = detailsPreferred() && window.innerWidth > 1200;

        if (infoWanted) {
            openDetails({ mode: 'info' }, { reset: true });
        } else if (shell.hasAttribute('data-details-open')) {
            showDetails([{ mode: 'info' }]);
        }

        // Messages, members, pins and permissions load side by side.
        await Promise.all([
            loadInitialWindow(conversation),
            loadMembers(conversation.id).then(() => {
                if (isActiveId(conversation.id)) {
                    renderThreadStatus();
                    refreshDetails();
                }
            }),
            loadShow(conversation.id).then(() => {
                if (isActiveId(conversation.id)) {
                    refreshDetails({ quiet: true });
                }
            }),
            loadPinned(conversation.id),
        ]);
    }

    /** Back to "no chat open" (removed from it, or it was deleted). */
    function closeConversation() {
        exitSelection();
        activeConversation = null;
        activeShow = null;
        messages = [];
        setActiveConversationId(null);
        threadHeader.hidden = true;
        composer.hidden = true;
        blockedEl.hidden = true;
        pinnedBar.hidden = true;
        typingEl.hidden = true;
        closeDetails();
        messagesEl.innerHTML = emptyState(escapeHtml(t('chat.empty_thread')));
        shell.dataset.view = 'list';
        renderJumpButtons();
        window.history.replaceState(window.history.state, '', '/chat');
        renderConversationList();
    }

    listEl?.addEventListener(
        'click',
        (event) => {
            if (event.target.closest('[data-open-archive]')) {
                openArchive(true);

                return;
            }

            if (event.target.closest('[data-close-archive]')) {
                openArchive(false);

                return;
            }

            const button = event.target.closest('[data-conversation-id]');
            const conversation = button
                ? findConversation(button.dataset.conversationId)
                : null;

            if (conversation) {
                openConversation(conversation);
            }
        },
        { signal },
    );

    function openArchive(open) {
        listFolder = open ? 'archived' : 'all';
        selectListType('all');
        listEl.innerHTML = '<div class="skeleton skeleton-row m-3"></div>';
        loadConversations(searchInput?.value || '');
    }

    function conversationActions(conversation) {
        return {
            settings: (patch) => updateSettings(conversation, patch),
            muteMenu: () => openMuteMenu(conversation),
            markRead: () => markRead(conversation.id),
            clear: () => clearHistory(conversation),
            remove: () => deleteConversation(conversation),
            leave: () => leaveConversation(conversation),
        };
    }

    let lastMenuPoint = { x: 0, y: 0 };

    function openListMenu(conversation, x, y) {
        lastMenuPoint = { x, y };
        openContextMenu(
            x,
            y,
            conversationMenuItems(
                conversation,
                conversationActions(conversation),
            ),
        );
    }

    function openMuteMenu(conversation) {
        window.setTimeout(
            () =>
                openContextMenu(
                    lastMenuPoint.x,
                    lastMenuPoint.y,
                    muteMenuItems((value) =>
                        updateSettings(conversation, { mute: value }),
                    ),
                ),
            0,
        );
    }

    listEl?.addEventListener(
        'contextmenu',
        (event) => {
            const row = event.target.closest('[data-conversation-id]');
            const conversation = row
                ? findConversation(row.dataset.conversationId)
                : null;

            if (conversation) {
                event.preventDefault();
                openListMenu(conversation, event.clientX, event.clientY);
            }
        },
        { signal },
    );

    async function updateSettings(conversation, patch) {
        try {
            const { data } = await api.patch(
                `/conversations/${conversation.id}/settings`,
                patch,
            );
            const item = data.data || {};

            applySettings(conversation.id, {
                is_muted: item.is_muted,
                muted_until_iso: item.muted_until_iso,
                is_archived: item.is_archived,
                is_pinned: item.is_pinned,
                marked_unread: item.marked_unread,
                unread_count: item.unread_count,
            });

            if (patch.archived !== undefined) {
                showToast(
                    t(
                        patch.archived
                            ? 'chat.list_menu.archived_done'
                            : 'chat.list_menu.unarchived_done',
                    ),
                    'success',
                );
            }

            document.dispatchEvent(new CustomEvent('sidebar:refresh'));
        } catch (error) {
            showToast(
                apiErrorMessage(error, t('common.error_generic')),
                'error',
            );
        }
    }

    async function clearHistory(conversation) {
        try {
            const confirmed = await confirmDialog({
                title: t('chat.list_menu.clear_title'),
                message: t('chat.list_menu.clear_body'),
                confirmText: t('chat.list_menu.clear'),
                danger: true,
                onConfirm: () =>
                    api.post(`/conversations/${conversation.id}/clear`),
            });

            if (confirmed) {
                conversationCache.delete(String(conversation.id));

                if (isActiveId(conversation.id)) {
                    messages = getCache(conversation.id).messages;
                    pinned = [];
                    renderPinnedBar();
                    await loadInitialWindow({
                        ...conversation,
                        unread_count: 0,
                    });
                }

                fetchSummary(conversation.id);
            }
        } catch (error) {
            showToast(
                apiErrorMessage(error, t('common.error_generic')),
                'error',
            );
        }
    }

    async function deleteConversation(conversation) {
        const isGroup = ['group', 'channel'].includes(conversation.type);

        try {
            const confirmed = await confirmDialog({
                title: t(
                    isGroup
                        ? 'chat.list_menu.delete_group_title'
                        : 'chat.list_menu.delete_chat_title',
                ),
                message: t(
                    isGroup
                        ? 'chat.list_menu.delete_group_body'
                        : 'chat.list_menu.delete_chat_body',
                ),
                confirmText: t('common.delete'),
                danger: true,
                onConfirm: () =>
                    api.delete(`/conversations/${conversation.id}`),
            });

            if (confirmed) {
                forgetConversation(conversation.id);
            }
        } catch (error) {
            showToast(
                apiErrorMessage(error, t('common.error_generic')),
                'error',
            );
        }
    }

    async function leaveConversation(conversation) {
        try {
            const confirmed = await confirmDialog({
                title: t('chat.list_menu.leave_title'),
                message: t('chat.list_menu.leave_body', {
                    title: titleOf(conversation),
                }),
                confirmText: t('chat.list_menu.leave'),
                danger: true,
                onConfirm: () =>
                    api.post(`/conversations/${conversation.id}/leave`),
            });

            if (confirmed) {
                forgetConversation(conversation.id);
            }
        } catch (error) {
            showToast(
                apiErrorMessage(error, t('common.error_generic')),
                'error',
            );
        }
    }

    function forgetConversation(conversationId) {
        conversationCache.delete(String(conversationId));
        saveDraft(conversationId, '');
        removeConversationFromList(conversationId);

        if (isActiveId(conversationId)) {
            closeConversation();
        }

        document.dispatchEvent(new CustomEvent('sidebar:refresh'));
    }

    $('[data-chat-back]')?.addEventListener(
        'click',
        () => {
            shell.dataset.view = 'list';
            // Leaving the thread for the list means this conversation is no
            // longer on screen, so notification suppression for it lifts.
            setActiveConversationId(null);
        },
        { signal },
    );

    $('[data-chat-open-info]')?.addEventListener(
        'click',
        () => {
            openDetails({ mode: 'info' }, { reset: true });
            rememberDetails(true);
        },
        { signal },
    );

    $('[data-chat-details-toggle]')?.addEventListener(
        'click',
        () => {
            if (shell.hasAttribute('data-details-open')) {
                closeDetails();
                rememberDetails(false);
            } else {
                openDetails({ mode: 'info' }, { reset: true });
                rememberDetails(true);
            }
        },
        { signal },
    );

    /** The thread header's ⋯ menu. */
    function headerMenuItems() {
        const conversation = activeConversation;
        const settings = findConversation(conversation.id) || conversation;
        const items = [
            {
                label: escapeHtml(t('chat.conv_info.open')),
                icon: 'info',
                onClick: () =>
                    openConversationInfo({
                        conversation,
                        title: titleOf(conversation),
                    }),
            },
            {
                label: escapeHtml(t('common.search')),
                icon: 'search',
                onClick: () => openSearchPanel(true),
            },
            {
                label: escapeHtml(t('chat.select.start')),
                icon: 'check-circle',
                onClick: () => enterSelection(),
            },
        ];

        if (!conversation.is_saved) {
            items.push(
                settings.is_muted
                    ? {
                          label: escapeHtml(t('chat.list_menu.unmute')),
                          icon: 'bell',
                          onClick: () =>
                              updateSettings(conversation, { mute: 'off' }),
                      }
                    : {
                          label: `${escapeHtml(t('chat.list_menu.mute'))} …`,
                          icon: 'bell-off',
                          onClick: () => openMuteMenu(conversation),
                      },
            );
        }

        if (conversation.type === 'private' && conversation.other_user_id) {
            items.push({
                label: escapeHtml(
                    t(
                        conversation.is_blocked
                            ? 'chat.block.unblock'
                            : 'chat.block.block',
                    ),
                ),
                icon: 'ban',
                danger: !conversation.is_blocked,
                onClick: () => toggleBlock(conversation),
            });
        }

        const listItems = conversationMenuItems(
            settings,
            conversationActions(settings),
        ).filter((item) =>
            ['refresh', 'trash', 'logout', 'archive'].includes(item.icon),
        );

        return [...items, { divider: true }, ...listItems];
    }

    $('[data-chat-header-menu]')?.addEventListener(
        'click',
        (event) => {
            if (!activeConversation) {
                return;
            }

            const rect = event.currentTarget.getBoundingClientRect();
            lastMenuPoint = { x: rect.left - 160, y: rect.bottom + 4 };
            openContextMenu(
                lastMenuPoint.x,
                lastMenuPoint.y,
                headerMenuItems(),
            );
        },
        { signal },
    );

    async function toggleBlock(conversation) {
        const userId = conversation.other_user_id;
        const blocking = !conversation.is_blocked;

        try {
            if (blocking) {
                const confirmed = await confirmDialog({
                    title: t('chat.block.confirm_title', {
                        name: titleOf(conversation),
                    }),
                    message: t('chat.block.confirm_body'),
                    confirmText: t('chat.block.block'),
                    danger: true,
                    icon: 'ban',
                    onConfirm: () => api.post(`/users/${userId}/block`),
                });

                if (!confirmed) {
                    return;
                }
            } else {
                await api.delete(`/users/${userId}/block`);
            }

            profileCache.delete(Number(userId));
            await fetchSummary(conversation.id);
            renderComposerState();
            refreshDetails({ quiet: true });
            showToast(
                t(
                    blocking
                        ? 'chat.block.blocked_done'
                        : 'chat.block.unblocked_done',
                ),
                'success',
            );
        } catch (error) {
            showToast(
                apiErrorMessage(error, t('common.error_generic')),
                'error',
            );
        }
    }

    unblockBtn?.addEventListener(
        'click',
        () => activeConversation && toggleBlock(activeConversation),
        { signal },
    );

    /*
    |--------------------------------------------------------------------------
    | Presence -> live status updates
    |--------------------------------------------------------------------------
    */

    const unsubscribePresence = onPresenceChange(() => {
        renderConversationList();

        if (listType === 'people' && people.length) {
            renderPeople();
        }

        if (activeConversation) {
            renderThreadStatus();
        }

        refreshDetails({ quiet: true });
    });

    /*
    |--------------------------------------------------------------------------
    | Pinned messages — Telegram-style
    |--------------------------------------------------------------------------
    |
    | Every pin of the conversation (not only the loaded ones) comes from
    | /messages/pinned, newest pin first. The bar shows one; clicking it
    | jumps to that message and moves on to the pin before it, round and
    | round. The list button shows them all in the info pane.
    */

    async function loadPinned(conversationId) {
        try {
            const { data } = await api.get(
                `/conversations/${conversationId}/messages/pinned`,
            );

            if (!isActiveId(conversationId)) {
                return;
            }

            pinned = (data.data || []).map(forViewer);
            pinnedIndex = 0;
            renderPinnedBar();
            refreshDetails({ quiet: true });
        } catch {
            // The bar just stays hidden.
        }
    }

    function renderPinnedBar() {
        if (!pinned.length || !activeConversation) {
            pinnedBar.hidden = true;

            return;
        }

        pinnedIndex = Math.min(pinnedIndex, pinned.length - 1);
        const current = pinned[pinnedIndex];
        const total = pinned.length;

        pinnedBar.hidden = false;
        pinnedLabel.textContent =
            total > 1
                ? t('chat.pinned_number', { number: total - pinnedIndex })
                : t('chat.pinned_message');
        pinnedText.textContent = messagePreview(current);

        // Up to four segments; the current one lights up.
        const visible = Math.min(total, 4);
        const litSegment = pinnedIndex % visible;
        pinnedSegments.innerHTML = Array.from(
            { length: visible },
            (_, i) => `<i ${i === litSegment ? 'data-current' : ''}></i>`,
        ).join('');
    }

    /** A message's pin changed (here or elsewhere): the list follows. */
    function syncPinned(message) {
        const index = pinned.findIndex((m) => sameId(m.id, message.id));

        if (message.is_pinned && index === -1) {
            pinned.unshift(message);
            pinnedIndex = 0;
        } else if (!message.is_pinned && index !== -1) {
            pinned.splice(index, 1);
        } else if (index !== -1) {
            pinned[index] = { ...pinned[index], ...message };
        }

        renderPinnedBar();
        refreshDetails({ quiet: true });
    }

    function removePinned(messageId) {
        const index = pinned.findIndex((m) => sameId(m.id, messageId));

        if (index !== -1) {
            pinned.splice(index, 1);
            renderPinnedBar();
            refreshDetails({ quiet: true });
        }
    }

    $('[data-chat-pinned-jump]')?.addEventListener(
        'click',
        () => {
            if (!pinned.length || !activeConversation) {
                return;
            }

            jumpToMessage(activeConversation.id, pinned[pinnedIndex].id);
            pinnedIndex = (pinnedIndex + 1) % pinned.length;
            renderPinnedBar();
        },
        { signal },
    );

    $('[data-chat-pinned-list]')?.addEventListener(
        'click',
        () => openDetails({ mode: 'pinned' }, { reset: true }),
        { signal },
    );

    async function togglePin(message) {
        if (!activeConversation || isTemporary(message)) {
            return;
        }

        const conversationId = activeConversation.id;
        const wasPinned = Boolean(message.is_pinned);

        // Shown at once; put back if the server says no.
        const apply = (isPinned) => {
            const local = getCache(conversationId).messages.find((m) =>
                sameId(m.id, message.id),
            );

            if (local) {
                local.is_pinned = isPinned;
                patchMessageDOM(local);
            }

            syncPinned({ ...(local ?? message), is_pinned: isPinned });
        };

        apply(!wasPinned);

        try {
            const { data } = await api[wasPinned ? 'delete' : 'post'](
                `/conversations/${conversationId}/messages/${message.id}/pin`,
            );

            if (isActiveId(conversationId) && data?.data) {
                mergeMessage(conversationId, forViewer(data.data));
                syncPinned(forViewer(data.data));
            }
        } catch (error) {
            if (isActiveId(conversationId)) {
                apply(wasPinned);
            }

            showToast(
                apiErrorMessage(error, t('common.error_generic')),
                'error',
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Composer: send, reply, edit
    |--------------------------------------------------------------------------
    */

    function autoGrow() {
        composerInput.style.height = 'auto';
        composerInput.style.height = `${Math.min(composerInput.scrollHeight, 160)}px`;
    }

    function setReplyTarget(message) {
        if (editTarget) {
            cancelEdit();
        }

        replyTarget = message;
        replyPreview.hidden = false;
        replyPreviewName.textContent = message.is_mine
            ? t('chat.you')
            : message.sender?.name || '';
        replyPreviewText.textContent = messagePreview(message);
        composerInput.focus();
    }

    function cancelReply() {
        replyTarget = null;
        replyPreview.hidden = true;
    }

    function setEditTarget(message) {
        if (!message.body || message.type !== 'text') {
            return;
        }

        cancelReply();
        window.clearTimeout(draftSaveTimer);

        if (activeConversation) {
            saveDraft(activeConversation.id, composerInput.value);
        }

        editTarget = message;
        editPreview.hidden = false;
        editPreviewText.textContent = messagePreview(message);
        composerInput.value = message.body || '';
        autoGrow();
        composerInput.focus();
        composerInput.setSelectionRange(
            composerInput.value.length,
            composerInput.value.length,
        );
    }

    function cancelEdit({ restoreDraft = true } = {}) {
        if (!editTarget) {
            return;
        }

        editTarget = null;
        editPreview.hidden = true;
        composerInput.value =
            restoreDraft && activeConversation
                ? loadDraft(activeConversation.id)
                : '';
        autoGrow();
    }

    $('[data-chat-reply-cancel]')?.addEventListener('click', cancelReply, {
        signal,
    });
    $('[data-chat-edit-cancel]')?.addEventListener(
        'click',
        () => cancelEdit(),
        { signal },
    );

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
                    ${icon((file.type || '').startsWith('image/') ? 'image' : 'file', { size: 14 })}
                    <span>${escapeHtml(file.name)}</span>
                    <button type="button" data-remove-attachment="${index}" aria-label="${escapeHtml(t('common.delete'))}">${icon('x', { size: 12 })}</button>
                </span>
            `,
            )
            .join('');
    }

    /** Files the server would refuse are left out here, with a toast. */
    function addAttachments(files) {
        const blocked =
            /\.(svg|html?|xhtml|xml|js|mjs|php|phtml|exe|bat|cmd|sh)$/i;
        const accepted = [];

        [...files].forEach((file) => {
            if (blocked.test(file.name)) {
                showToast(
                    t('chat.file_type_refused', { name: file.name }),
                    'error',
                );
            } else if (pendingAttachments.length + accepted.length >= 10) {
                showToast(t('chat.too_many_files'), 'warning');
            } else {
                accepted.push(file);
            }
        });

        pendingAttachments.push(...accepted);
        renderPendingAttachments();
    }

    composerAttachmentsEl?.addEventListener(
        'click',
        (event) => {
            const button = event.target.closest('[data-remove-attachment]');

            if (button) {
                pendingAttachments.splice(
                    Number(button.dataset.removeAttachment),
                    1,
                );
                renderPendingAttachments();
            }
        },
        { signal },
    );

    // "+" offers a file or a poll.
    $('[data-chat-attach]')?.addEventListener(
        'click',
        (event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const items = [
                {
                    label: escapeHtml(t('chat.attach_menu.file')),
                    icon: 'clip',
                    onClick: () => fileInput.click(),
                },
            ];

            if (
                activeConversation &&
                !activeConversation.is_saved &&
                activeConversation.type !== 'private'
            ) {
                items.push({
                    label: escapeHtml(t('chat.attach_menu.poll')),
                    icon: 'poll',
                    onClick: () => startPoll(),
                });
            }

            openContextMenu(rect.left, rect.top - 8 - items.length * 36, items);
        },
        { signal },
    );

    function startPoll() {
        if (!activeConversation) {
            return;
        }

        const conversationId = activeConversation.id;

        openPollDialog({
            conversationId,
            clientId: newClientId(),
            onCreated: (message) => {
                ingestMessage(conversationId, forViewer(message), {
                    scroll: 'bottom',
                });
                onMessageSent({ conversation_id: conversationId, message });
            },
        });
    }

    fileInput?.addEventListener(
        'change',
        () => {
            addAttachments(fileInput.files);
            fileInput.value = '';
            composerInput.focus();
        },
        { signal },
    );

    // Pasting an image (a screenshot) attaches it.
    composerInput?.addEventListener(
        'paste',
        (event) => {
            const files = [...(event.clipboardData?.files || [])];

            if (files.length) {
                event.preventDefault();
                addAttachments(files);
            }
        },
        { signal },
    );

    let dragCounter = 0;
    const hasFiles = (event) => event.dataTransfer?.types?.includes('Files');

    threadPane?.addEventListener(
        'dragenter',
        (event) => {
            if (!activeConversation || composer.hidden || !hasFiles(event)) {
                return;
            }

            event.preventDefault();
            dragCounter += 1;
            threadPane.setAttribute('data-dragging', '');
        },
        { signal },
    );

    threadPane?.addEventListener(
        'dragover',
        (event) => {
            if (hasFiles(event)) {
                event.preventDefault();
            }
        },
        { signal },
    );

    threadPane?.addEventListener(
        'dragleave',
        () => {
            dragCounter = Math.max(0, dragCounter - 1);

            if (dragCounter === 0) {
                threadPane.removeAttribute('data-dragging');
            }
        },
        { signal },
    );

    threadPane?.addEventListener(
        'drop',
        (event) => {
            if (!hasFiles(event)) {
                return;
            }

            event.preventDefault();
            dragCounter = 0;
            threadPane.removeAttribute('data-dragging');

            if (activeConversation && !composer.hidden) {
                addAttachments(event.dataTransfer?.files || []);
            }
        },
        { signal },
    );

    let typingSentAt = 0;

    function notifyTyping(kind = 'typing') {
        if (!activeConversation || activeConversation.is_saved) {
            return;
        }

        if (kind === 'typing' && !composerInput.value.trim()) {
            return;
        }

        const now = Date.now();

        if (now - typingSentAt < 3000) {
            return;
        }

        typingSentAt = now;
        api.post(`/conversations/${activeConversation.id}/typing`, {
            kind,
        }).catch(() => {});
    }

    composerInput?.addEventListener(
        'input',
        () => {
            autoGrow();
            scheduleDraftSave();
            notifyTyping();
            handleMentionTyping();
        },
        { signal },
    );

    /*
    | Sending is optimistic: the message shows at once with a clock, the
    | composer clears, and the request goes out in the background — one
    | at a time per conversation, so messages keep their order. The
    | message carries a client id, so a retry after a lost answer can
    | never post it twice. The clock turns into a tick when the server
    | answers, or into "Not sent · Retry" when it can't.
    */

    const sendQueues = new Map(); // conversationId -> promise chain

    function enqueueDelivery(conversationId, task) {
        const chain = (
            sendQueues.get(String(conversationId)) ?? Promise.resolve()
        ).then(task, task);
        sendQueues.set(String(conversationId), chain);

        return chain;
    }

    async function sendMessage({ body, files, meta = [] }) {
        const conversationId = activeConversation.id;
        const clientId = newClientId();
        const parent = replyTarget;

        // Writing from a window parked in history: the newest comes first.
        if (getCache(conversationId).hasMoreAfter) {
            await jumpToEnd();
        }

        const temp = {
            id: `tmp-${clientId}`,
            client_id: clientId,
            conversation_id: conversationId,
            type: 'text',
            body,
            is_mine: true,
            is_pinned: false,
            status: 'sending',
            sender: {
                id: currentUser?.id,
                name: currentUser?.name,
                avatar: currentUser?.avatar?.url ?? null,
            },
            reply_to: parent
                ? {
                      id: parent.id,
                      body: messagePreview(parent),
                      sender_name: parent.sender?.name,
                  }
                : null,
            attachments: files.map((file, index) => ({
                id: `local-${clientId}-${index}`,
                url: URL.createObjectURL(file),
                original_name: file.name,
                mime_type: file.type,
                size: file.size,
                duration: meta[index]?.duration ?? null,
                kind: meta[index]?.voice ? 'voice' : undefined,
            })),
            reactions: [],
            read_count: 0,
            created_at_iso: new Date().toISOString(),
            outgoing: { body, files, meta, parentId: parent?.id ?? null },
        };

        ingestMessage(conversationId, temp);
        enqueueDelivery(conversationId, () => deliver(conversationId, temp));
    }

    async function deliver(conversationId, temp) {
        const { body, files, meta, parentId } = temp.outgoing;
        let payload;

        if (files.length) {
            payload = new FormData();
            payload.append('client_id', temp.client_id);

            if (body) {
                payload.append('body', body);
            }

            if (parentId) {
                payload.append('parent_message_id', parentId);
            }

            files.forEach((file, index) => {
                payload.append('attachments[]', file);

                if (meta?.[index]?.duration !== undefined) {
                    payload.append(
                        `attachment_meta[${index}][duration]`,
                        String(meta[index].duration),
                    );
                }

                if (meta?.[index]?.voice) {
                    payload.append(`attachment_meta[${index}][voice]`, '1');
                }
            });
        } else {
            payload = {
                body,
                client_id: temp.client_id,
                parent_message_id: parentId ?? undefined,
            };
        }

        try {
            // The client defaults to JSON, which would turn a FormData
            // into a JSON object with empty `{}` where the files were.
            const { data } = await api.post(
                `/conversations/${conversationId}/messages`,
                payload,
                files.length
                    ? { headers: { 'Content-Type': 'multipart/form-data' } }
                    : undefined,
            );

            temp.attachments.forEach((a) => URL.revokeObjectURL(a.url));
            const message = forViewer(data.data);
            replaceMessage(conversationId, temp.id, message);
            onMessageSent({ conversation_id: conversationId, message });
        } catch (error) {
            const status = error?.response?.status;

            // Refused for good (validation, blocked, read-only): no retry.
            if (status === 403 || status === 422) {
                dropMessages(conversationId, [temp.id]);
                temp.attachments.forEach((a) => URL.revokeObjectURL(a.url));

                if (status === 403) {
                    fetchSummary(conversationId);
                }

                showToast(
                    apiErrorMessage(error, t('chat.send_error')),
                    'error',
                );

                return;
            }

            temp.status = 'failed';

            if (isActiveId(conversationId)) {
                patchMessageDOM(temp);
            }

            showToast(apiErrorMessage(error, t('chat.send_error')), 'error');
        }
    }

    function retryMessage(messageId) {
        const temp = findMessage(messageId);

        if (!temp?.outgoing) {
            return;
        }

        // The chat the message belongs to — not whichever is open by the
        // time the queue gets to it.
        const conversationId = temp.conversation_id;

        temp.status = 'sending';
        patchMessageDOM(temp);
        enqueueDelivery(conversationId, () => deliver(conversationId, temp));
    }

    function discardMessage(message) {
        dropMessages(message.conversation_id, [message.id]);
        message.attachments?.forEach((a) => URL.revokeObjectURL(a.url));
    }

    composer?.addEventListener(
        'submit',
        (event) => {
            event.preventDefault();

            if (!activeConversation) {
                return;
            }

            if (recorder) {
                stopRecording({ send: true });

                return;
            }

            if (editTarget) {
                submitEdit();

                return;
            }

            const body = composerInput.value.trim();

            if (!body && !pendingAttachments.length) {
                return;
            }

            if (body.length > 5000) {
                showToast(t('chat.too_long'), 'warning');

                return;
            }

            const files = [...pendingAttachments];

            // Everything clears before the request even starts.
            composerInput.value = '';
            pendingAttachments = [];
            renderPendingAttachments();
            window.clearTimeout(draftSaveTimer);
            saveDraft(activeConversation.id, '');
            autoGrow();
            mentionsEl.hidden = true;
            mentionQuery = null;

            sendMessage({ body, files });
            cancelReply();
            typingSentAt = 0;
        },
        { signal },
    );

    async function submitEdit() {
        const body = composerInput.value.trim();
        const target = editTarget;

        if (!activeConversation || !target) {
            return;
        }

        if (!body) {
            cancelEdit();

            return;
        }

        const conversationId = activeConversation.id;
        const before = {
            body: target.body,
            edited_at_iso: target.edited_at_iso,
            edit_count: target.edit_count,
        };

        cancelEdit();

        if (body === before.body) {
            return;
        }

        // Shown at once; put back if the server says no.
        target.body = body;
        target.edited_at_iso = new Date().toISOString();
        target.edit_count = (target.edit_count || 0) + 1;
        patchMessageDOM(target);

        try {
            const { data } = await api.patch(
                `/conversations/${conversationId}/messages/${target.id}`,
                { body },
            );
            onMessageEdited({
                conversation_id: conversationId,
                message: data.data,
            });
        } catch (error) {
            Object.assign(target, before);

            if (isActiveId(conversationId)) {
                patchMessageDOM(target);
            }

            showToast(apiErrorMessage(error, t('chat.edit_error')), 'error');
        }
    }

    const isTouch = () => window.matchMedia('(hover: none)').matches;

    composerInput?.addEventListener(
        'keydown',
        (event) => {
            if (
                mentionQuery &&
                !mentionsEl.hidden &&
                ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(
                    event.key,
                )
            ) {
                handleMentionKeydown(event);

                return;
            }

            const mod = event.ctrlKey || event.metaKey;

            // Formatting, as in Telegram Desktop.
            if (mod && !event.altKey) {
                const key = event.key.toLowerCase();
                const code = event.code;

                if (code === 'KeyB' || key === 'b') {
                    event.preventDefault();
                    wrapSelection(composerInput, '**');
                } else if (code === 'KeyI' || key === 'i') {
                    event.preventDefault();
                    wrapSelection(composerInput, '__');
                } else if (event.shiftKey && (code === 'KeyX' || key === 'x')) {
                    event.preventDefault();
                    wrapSelection(composerInput, '~~');
                } else if (event.shiftKey && (code === 'KeyM' || key === 'm')) {
                    event.preventDefault();
                    wrapSelection(composerInput, '`');
                } else if (event.shiftKey && (code === 'KeyP' || key === 'p')) {
                    event.preventDefault();
                    wrapSelection(composerInput, '||');
                } else if (code === 'KeyK' || key === 'k') {
                    event.preventDefault();
                    const start = composerInput.selectionStart ?? 0;
                    const end = composerInput.selectionEnd ?? start;
                    const text =
                        composerInput.value.slice(start, end) ||
                        t('chat.format.link_text');
                    const link = `[${text}](https://)`;
                    composerInput.value =
                        composerInput.value.slice(0, start) +
                        link +
                        composerInput.value.slice(end);
                    const caret = start + text.length + 3 + 'https://'.length;
                    composerInput.setSelectionRange(caret, caret);
                } else {
                    return;
                }

                autoGrow();
                scheduleDraftSave();

                return;
            }

            if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.isComposing &&
                !isTouch()
            ) {
                event.preventDefault();
                composer.requestSubmit();

                return;
            }

            if (event.key === 'Escape') {
                if (editTarget) {
                    event.preventDefault();
                    cancelEdit();
                } else if (replyTarget) {
                    event.preventDefault();
                    cancelReply();
                }

                return;
            }

            if (
                event.key === 'ArrowUp' &&
                !composerInput.value &&
                !editTarget
            ) {
                const lastMine = [...messages]
                    .reverse()
                    .find(
                        (m) =>
                            m.is_mine &&
                            !isTemporary(m) &&
                            m.type === 'text' &&
                            m.body,
                    );

                if (lastMine) {
                    event.preventDefault();
                    setEditTarget(lastMine);
                }
            }
        },
        { signal },
    );

    /*
    |--------------------------------------------------------------------------
    | Emoji and mention buttons
    |--------------------------------------------------------------------------
    */

    function insertAtCursor(text) {
        const start =
            composerInput.selectionStart ?? composerInput.value.length;
        const end = composerInput.selectionEnd ?? start;

        composerInput.value =
            composerInput.value.slice(0, start) +
            text +
            composerInput.value.slice(end);
        composerInput.setSelectionRange(
            start + text.length,
            start + text.length,
        );
        composerInput.focus();
        autoGrow();
        scheduleDraftSave();
    }

    function openFloatingPicker(anchor, className, itemsHtml, onPick) {
        document.querySelector(`.${className}`)?.remove();

        const picker = document.createElement('div');
        picker.className = className;
        picker.innerHTML = itemsHtml;
        document.body.appendChild(picker);

        const anchorRect = anchor.getBoundingClientRect();
        const rect = picker.getBoundingClientRect();
        picker.style.left = `${Math.max(8, Math.min(anchorRect.left, window.innerWidth - rect.width - 8))}px`;
        picker.style.top = `${Math.max(8, anchorRect.top - rect.height - 8)}px`;

        const close = () => {
            picker.remove();
            document.removeEventListener('pointerdown', outside, true);
        };

        function outside(e) {
            if (!picker.contains(e.target)) {
                close();
            }
        }

        picker.addEventListener('click', (e) => {
            const button = e.target.closest('[data-emoji]');

            if (button) {
                onPick(button.dataset.emoji);
                close();
            }
        });

        window.setTimeout(
            () => document.addEventListener('pointerdown', outside, true),
            0,
        );
        signal.addEventListener('abort', close);
    }

    $('[data-chat-emoji]')?.addEventListener(
        'click',
        (event) => {
            openFloatingPicker(
                event.currentTarget,
                'chat-emoji-picker',
                EMOJIS.map(
                    (e) =>
                        `<button type="button" data-emoji="${e}">${e}</button>`,
                ).join(''),
                (emoji) => insertAtCursor(emoji),
            );
        },
        { signal },
    );

    $('[data-chat-mention]')?.addEventListener(
        'click',
        () => {
            const before = composerInput.value.slice(
                0,
                composerInput.selectionStart ?? 0,
            );
            insertAtCursor(before && !/\s$/.test(before) ? ' @' : '@');
            handleMentionTyping();
        },
        { signal },
    );

    function mentionMember(member) {
        const before = composerInput.value.slice(
            0,
            composerInput.selectionStart ?? 0,
        );
        insertAtCursor(
            `${before && !/\s$/.test(before) ? ' ' : ''}${mentionToken(member.name, member.id)} `,
        );
    }

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
            .filter((m) => !sameId(m.id, currentUser?.id))
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
                    aria-selected="${index === mentionActiveIndex}"
                >
                    ${avatarHtml(m.name, m.avatar, { className: 'avatar--xs', online: isOnline(m.id) })}
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

        event.preventDefault();

        if (event.key === 'ArrowDown') {
            mentionActiveIndex =
                (mentionActiveIndex + 1) % mentionMatches.length;
            renderMentionList();

            return;
        }

        if (event.key === 'ArrowUp') {
            mentionActiveIndex =
                (mentionActiveIndex - 1 + mentionMatches.length) %
                mentionMatches.length;
            renderMentionList();

            return;
        }

        applyMention(mentionMatches[mentionActiveIndex]);
    }

    mentionsEl?.addEventListener(
        'click',
        (event) => {
            const button = event.target.closest('[data-mention-index]');

            if (button) {
                applyMention(
                    mentionMatches[Number(button.dataset.mentionIndex)],
                );
            }
        },
        { signal },
    );

    /*
    |--------------------------------------------------------------------------
    | Voice messages — recorded in the browser, sent as an attachment
    |--------------------------------------------------------------------------
    |
    | The recorder knows how long it ran, so the duration goes along with
    | the file (`attachment_meta[0][duration]`): Chrome's WebM recordings
    | report an infinite duration to the player otherwise.
    */

    let recorder = null;
    let recorderStarting = false;
    let recordedChunks = [];
    let recordingStartedAt = 0;
    let recordingTimer = null;
    let sendWhenStopped = false;

    async function startRecording() {
        if (recorder || recorderStarting) {
            return;
        }

        if (
            !navigator.mediaDevices?.getUserMedia ||
            typeof MediaRecorder === 'undefined'
        ) {
            showToast(t('chat.voice_unsupported'), 'error');

            return;
        }

        recorderStarting = true;
        let stream = null;

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });

            if (!isAlive() || !activeConversation) {
                stream.getTracks().forEach((track) => track.stop());

                return;
            }

            const type = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg',
                'audio/mp4',
            ].find((candidate) => MediaRecorder.isTypeSupported?.(candidate));

            recorder = new MediaRecorder(
                stream,
                type ? { mimeType: type } : undefined,
            );
            recordedChunks = [];
            sendWhenStopped = false;
            const conversationId = activeConversation.id;
            const activeStream = stream;

            recorder.addEventListener('dataavailable', (e) => {
                if (e.data.size) {
                    recordedChunks.push(e.data);
                }
            });

            recorder.addEventListener('stop', () => {
                activeStream.getTracks().forEach((track) => track.stop());

                const mimeType = (recorder?.mimeType || 'audio/webm').split(
                    ';',
                )[0];
                const extension = mimeType.includes('ogg')
                    ? 'ogg'
                    : mimeType.includes('mp4')
                      ? 'm4a'
                      : 'webm';
                const elapsed = Date.now() - recordingStartedAt;

                if (
                    sendWhenStopped &&
                    elapsed > 700 &&
                    recordedChunks.length &&
                    isActiveId(conversationId)
                ) {
                    const file = new File(
                        recordedChunks,
                        `voice-${Date.now()}.${extension}`,
                        { type: mimeType },
                    );
                    sendMessage({
                        body: '',
                        files: [file],
                        meta: [
                            {
                                duration: Math.max(
                                    1,
                                    Math.round(elapsed / 1000),
                                ),
                                voice: true,
                            },
                        ],
                    });
                    cancelReply();
                }

                recorder = null;
                recordedChunks = [];
                composer.removeAttribute('data-recording');
                recordingEl.hidden = true;
                window.clearInterval(recordingTimer);
            });

            recordingStartedAt = Date.now();
            recorder.start();
            composer.setAttribute('data-recording', '');
            recordingEl.hidden = false;
            recordingTime.textContent = '0:00';
            typingSentAt = 0;
            notifyTyping('recording');
            recordingTimer = window.setInterval(() => {
                recordingTime.textContent = formatDuration(
                    (Date.now() - recordingStartedAt) / 1000,
                );
                notifyTyping('recording');
            }, 250);
        } catch {
            stream?.getTracks().forEach((track) => track.stop());
            recorder = null;
            showToast(t('chat.voice_denied'), 'error');
        } finally {
            recorderStarting = false;
        }
    }

    function stopRecording({ send }) {
        if (!recorder) {
            return;
        }

        sendWhenStopped = send;
        recorder.stop();
    }

    $('[data-chat-mic]')?.addEventListener(
        'click',
        () => (recorder ? stopRecording({ send: true }) : startRecording()),
        { signal },
    );

    $('[data-chat-recording-cancel]')?.addEventListener(
        'click',
        () => stopRecording({ send: false }),
        { signal },
    );

    /*
    |--------------------------------------------------------------------------
    | Voice player
    |--------------------------------------------------------------------------
    */

    let playingEl = null;

    /** The real length: the player's when it knows it, else the stored one. */
    function audioDuration(el, player) {
        return Number.isFinite(player.duration) && player.duration > 0
            ? player.duration
            : Number(el.dataset.duration) || 0;
    }

    function paintAudio(el, player) {
        const bars = el.querySelectorAll('.chat-audio__wave > i');
        const duration = audioDuration(el, player);
        const progress = duration
            ? Math.min(1, player.currentTime / duration)
            : 0;
        const played = Math.round(progress * bars.length);

        bars.forEach((bar, i) =>
            bar.toggleAttribute('data-played', i < played),
        );
        el.querySelector('[data-audio-time]').textContent =
            `${formatDuration(player.currentTime)} / ${formatDuration(duration)}`;
    }

    function setPlayIcon(el, isPlaying) {
        const button = el.querySelector('[data-audio-toggle]');
        button.innerHTML = icon(isPlaying ? 'pause' : 'play-fill', {
            size: 14,
        });
        button.setAttribute(
            'aria-label',
            isPlaying ? t('chat.pause') : t('chat.play'),
        );
    }

    function ensurePlayer() {
        if (audioPlayer) {
            return audioPlayer;
        }

        audioPlayer = new Audio();
        audioPlayer.preload = 'metadata';

        return audioPlayer;
    }

    /** The row may have been re-rendered since it started playing. */
    function livePlayingEl(player) {
        if (playingEl && !playingEl.isConnected) {
            playingEl =
                [...messagesEl.querySelectorAll('[data-audio]')].find(
                    (el) => el.dataset.audio === player.src,
                ) || null;
        }

        return playingEl;
    }

    function toggleAudio(el) {
        const player = ensurePlayer();
        const src = el.dataset.audio;

        livePlayingEl(player);

        if (playingEl === el || player.src === src) {
            if (player.paused) {
                player.play().catch(() => {});
            } else {
                player.pause();
            }

            playingEl = el;
            setPlayIcon(el, !player.paused);

            return;
        }

        if (playingEl) {
            setPlayIcon(playingEl, false);
        }

        playingEl = el;
        player.src = src;
        player.playbackRate = Number(el.dataset.speed || 1);
        player.play().catch(() => {});
        setPlayIcon(el, true);

        const paint = () => {
            const current = livePlayingEl(player);

            if (current) {
                paintAudio(current, player);
                setPlayIcon(current, !player.paused);
            }
        };

        player.ontimeupdate = paint;
        player.onloadedmetadata = paint;
        player.onended = paint;
        player.onpause = paint;
    }

    /*
    |--------------------------------------------------------------------------
    | Selection mode — pick several messages, then forward/copy/delete
    |--------------------------------------------------------------------------
    */

    function enterSelection(messageId = null) {
        if (!activeConversation) {
            return;
        }

        selection = new Set(messageId ? [String(messageId)] : []);
        shell.setAttribute('data-selecting', '');
        selectBar.hidden = false;
        renderComposerState();
        renderMessagesKeepingPlace();
        renderSelection();
    }

    function exitSelection() {
        if (!selection) {
            return;
        }

        selection = null;
        shell.removeAttribute('data-selecting');
        selectBar.hidden = true;
        renderComposerState();

        if (activeConversation) {
            renderMessagesKeepingPlace();
        }
    }

    function toggleSelected(messageId) {
        const key = String(messageId);

        if (selection.has(key)) {
            selection.delete(key);
        } else {
            selection.add(key);
        }

        const message = findMessage(messageId);

        if (message) {
            patchMessageDOM(message);
        }

        renderSelection();
    }

    function selectedMessages() {
        return messages.filter(
            (m) => selection?.has(String(m.id)) && !isTemporary(m),
        );
    }

    function renderSelection() {
        if (!selection) {
            return;
        }

        const picked = selectedMessages();
        selectCount.textContent = tChoice('chat.select.count', picked.length);
        selectBar
            .querySelectorAll('[data-chat-select-action]')
            .forEach((button) => {
                button.disabled =
                    !picked.length ||
                    (button.dataset.chatSelectAction === 'forward' &&
                        picked.every((m) => m.type === 'system'));
            });
    }

    function copyMessages(list) {
        const text = list
            .map((m) =>
                list.length > 1
                    ? `${m.sender?.name || ''}, [${formatTime(m.created_at_iso)}]\n${messagePreview(m)}`
                    : m.body
                      ? plainText(m.body)
                      : messagePreview(m),
            )
            .join('\n\n');

        copyText(text);
    }

    $('[data-chat-select-cancel]')?.addEventListener('click', exitSelection, {
        signal,
    });

    selectBar?.addEventListener(
        'click',
        (event) => {
            const action = event.target.closest('[data-chat-select-action]');
            const picked = selectedMessages();

            if (!action || !picked.length) {
                return;
            }

            switch (action.dataset.chatSelectAction) {
                case 'copy':
                    copyMessages(picked);
                    exitSelection();
                    break;
                case 'forward':
                    forwardMessages(picked);
                    break;
                case 'delete':
                    deleteMessages(picked);
                    break;
                default:
            }
        },
        { signal },
    );

    /*
    |--------------------------------------------------------------------------
    | Forward, delete, info
    |--------------------------------------------------------------------------
    */

    function forwardMessages(list) {
        const ids = list
            .filter((m) => m.type !== 'system' && !isTemporary(m))
            .map((m) => m.id);

        if (!ids.length || !activeConversation) {
            return;
        }

        openForwardDialog({
            fromConversationId: activeConversation.id,
            messageIds: ids,
            onDone: (results, targets) => {
                exitSelection();
                results.forEach((result) =>
                    (result.messages || []).forEach((message) =>
                        onMessageSent({
                            conversation_id: result.conversation_id,
                            message,
                        }),
                    ),
                );

                if (targets.length === 1 && !isActiveId(targets[0].id)) {
                    openConversationById(Number(targets[0].id));
                }
            },
        });
    }

    async function deleteMessages(list) {
        if (!activeConversation || !list.length) {
            return;
        }

        const conversation = activeConversation;
        const conversationId = conversation.id;
        const manager =
            ['group', 'channel'].includes(conversation.type) &&
            isManagerRole(conversation.my_role);
        const canEveryone =
            !conversation.is_saved &&
            list.every((m) => m.type !== 'system' && (m.is_mine || manager));
        const count = list.length;

        const choice = conversation.is_saved
            ? await chooseDialog({
                  title: tChoice('chat.delete.title', count),
                  choices: [
                      {
                          value: 'everyone',
                          label: t('common.delete'),
                          danger: true,
                      },
                  ],
              })
            : await chooseDialog({
                  title: tChoice('chat.delete.title', count),
                  message: canEveryone
                      ? t('chat.delete.body_everyone')
                      : t('chat.delete.body_me'),
                  choices: canEveryone
                      ? [
                            {
                                value: 'everyone',
                                label: t('chat.delete.for_everyone'),
                                danger: true,
                            },
                            { value: 'me', label: t('chat.delete.for_me') },
                        ]
                      : [
                            {
                                value: 'me',
                                label: t('chat.delete.for_me'),
                                danger: true,
                            },
                        ],
              });

        if (!choice) {
            return;
        }

        try {
            const ids = list.map((m) => m.id);
            const { data } =
                ids.length === 1
                    ? await api.delete(
                          `/conversations/${conversationId}/messages/${ids[0]}`,
                          { params: { for: choice } },
                      )
                    : await api.post(
                          `/conversations/${conversationId}/messages/delete`,
                          { message_ids: ids, for: choice },
                      );
            const result = data.data || {};
            const gone = [
                ...(result.deleted_ids || []),
                ...(result.hidden_ids || []),
            ];

            dropMessages(conversationId, gone.length ? gone : ids);
            exitSelection();
            fetchSummary(conversationId);
        } catch (error) {
            showToast(
                apiErrorMessage(error, t('common.error_generic')),
                'error',
            );
        }
    }

    function showMessageInfo(message, attachmentId = null) {
        if (!activeConversation || isTemporary(message)) {
            return;
        }

        const conversationId = activeConversation.id;

        openMessageInfo({
            conversation: activeConversation,
            messageId: message.id,
            currentUserId: currentUser?.id,
            attachmentId,
            onJump: (id) => jumpToMessage(conversationId, id),
        });
    }

    function messageLink(message) {
        return `${window.location.origin}/chat/${activeConversation.id}?message=${message.id}`;
    }

    /*
    |--------------------------------------------------------------------------
    | Polls
    |--------------------------------------------------------------------------
    */

    async function pollRequest(message, method, path, body) {
        const conversationId = activeConversation.id;

        try {
            const { data } = await api[method](
                `/conversations/${conversationId}/messages/${message.id}/${path}`,
                body,
            );

            pollPicks.delete(String(message.id));
            mergeMessage(conversationId, forViewer(data.data));
        } catch (error) {
            showToast(
                apiErrorMessage(error, t('common.error_generic')),
                'error',
            );
        }
    }

    function handlePollClick(event, message) {
        const option = event.target.closest('[data-poll-option]');

        if (option) {
            const id = Number(option.dataset.pollOption);

            if (!message.poll?.multiple) {
                pollRequest(message, 'post', 'vote', { option_ids: [id] });

                return true;
            }

            const picks = new Set(pollPicks.get(String(message.id)) || []);

            if (picks.has(id)) {
                picks.delete(id);
            } else {
                picks.add(id);
            }

            pollPicks.set(String(message.id), [...picks]);
            patchMessageDOM(message);

            return true;
        }

        if (event.target.closest('[data-poll-vote]')) {
            pollRequest(message, 'post', 'vote', {
                option_ids: pollPicks.get(String(message.id)) || [],
            });

            return true;
        }

        if (event.target.closest('[data-poll-retract]')) {
            pollRequest(message, 'delete', 'vote');

            return true;
        }

        if (event.target.closest('[data-poll-close]')) {
            pollRequest(message, 'post', 'close');

            return true;
        }

        return false;
    }

    /*
    |--------------------------------------------------------------------------
    | Message interactions
    |--------------------------------------------------------------------------
    */

    messagesEl?.addEventListener(
        'click',
        (event) => {
            const row = event.target.closest('[data-message-id]');
            const message = row ? findMessage(row.dataset.messageId) : null;

            // Selection mode: a click picks or unpicks the message.
            if (selection) {
                if (message && !isTemporary(message)) {
                    event.preventDefault();
                    toggleSelected(message.id);
                }

                return;
            }

            const spoiler = event.target.closest('[data-spoiler]');

            if (spoiler && !spoiler.hasAttribute('data-revealed')) {
                spoiler.setAttribute('data-revealed', '');

                return;
            }

            const copyCode = event.target.closest('[data-copy-code]');

            if (copyCode) {
                copyText(
                    copyCode.closest('.chat-code')?.querySelector('code')
                        ?.textContent || '',
                );

                return;
            }

            const profileButton = event.target.closest('[data-profile-user]');

            if (profileButton) {
                openProfile(Number(profileButton.dataset.profileUser));

                return;
            }

            const mention = event.target.closest('.mention-chip[data-user-id]');

            if (mention) {
                openProfile(Number(mention.dataset.userId));

                return;
            }

            const retry = event.target.closest('[data-retry]');

            if (retry) {
                retryMessage(retry.dataset.retry);

                return;
            }

            const scrollTarget = event.target.closest('[data-scroll-to]');

            if (scrollTarget && activeConversation) {
                jumpToMessage(
                    activeConversation.id,
                    Number(scrollTarget.dataset.scrollTo),
                );

                return;
            }

            const reactionPill = event.target.closest('[data-react]');

            if (reactionPill) {
                toggleReaction(
                    reactionPill.dataset.react,
                    reactionPill.dataset.emoji,
                );

                return;
            }

            if (message?.type === 'poll' && handlePollClick(event, message)) {
                return;
            }

            const audio = event.target.closest('[data-audio]');

            if (audio) {
                if (event.target.closest('[data-audio-speed]')) {
                    const speeds = [1, 1.5, 2];
                    const next =
                        speeds[
                            (speeds.indexOf(Number(audio.dataset.speed || 1)) +
                                1) %
                                speeds.length
                        ];
                    audio.dataset.speed = String(next);
                    event.target.closest('[data-audio-speed]').textContent =
                        `${next}×`;

                    if (playingEl === audio && audioPlayer) {
                        audioPlayer.playbackRate = next;
                    }

                    return;
                }

                const seek = event.target.closest('[data-audio-seek]');
                const duration = audioPlayer
                    ? audioDuration(audio, audioPlayer)
                    : 0;

                if (seek && playingEl === audio && duration) {
                    const rect = seek.getBoundingClientRect();
                    audioPlayer.currentTime = Math.max(
                        0,
                        Math.min(
                            duration,
                            ((event.clientX - rect.left) / rect.width) *
                                duration,
                        ),
                    );

                    return;
                }

                if (event.target.closest('[data-audio-toggle]') || seek) {
                    toggleAudio(audio);
                }

                return;
            }

            const lightboxImg = event.target.closest('[data-lightbox]');

            if (lightboxImg) {
                openLightbox(lightboxImg.dataset.lightbox);

                return;
            }

            const action = event.target.closest('[data-msg-action]');

            if (action && message) {
                switch (action.dataset.msgAction) {
                    case 'react':
                        openReactionPicker(message, action);
                        break;
                    case 'reply':
                        setReplyTarget(message);
                        break;
                    case 'forward':
                        forwardMessages([message]);
                        break;
                    case 'info':
                        showMessageInfo(message);
                        break;
                    default: {
                        const rect = action.getBoundingClientRect();
                        openContextMenu(
                            rect.left - 140,
                            rect.bottom + 4,
                            messageContextItems(message, {
                                x: rect.left,
                                y: rect.bottom,
                            }),
                        );
                    }
                }
            }
        },
        { signal },
    );

    messagesEl?.addEventListener(
        'keydown',
        (event) => {
            const spoiler = event.target.closest('[data-spoiler]');

            if (spoiler && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                spoiler.setAttribute('data-revealed', '');
            }
        },
        { signal },
    );

    // Double click replies, as in Telegram Desktop.
    messagesEl?.addEventListener(
        'dblclick',
        (event) => {
            if (
                selection ||
                composer.hidden ||
                event.target.closest(
                    'a, button, img, video, audio, .chat-audio, .chat-poll',
                )
            ) {
                return;
            }

            const message = findMessage(
                event.target.closest('[data-message-id]')?.dataset.messageId,
            );

            if (message && !isTemporary(message) && message.type !== 'system') {
                window.getSelection()?.removeAllRanges();
                setReplyTarget(message);
            }
        },
        { signal },
    );

    async function toggleReaction(messageId, emoji) {
        if (!activeConversation || String(messageId).startsWith('tmp-')) {
            return;
        }

        const conversationId = activeConversation.id;
        const message = findMessage(messageId);
        const before = message ? message.reactions : null;

        // Shown at once, then corrected with the server's count.
        if (message) {
            const reactions = (message.reactions || []).map((r) => ({
                ...r,
                user_ids: [...(r.user_ids || [])],
            }));
            const existing = reactions.find((r) => r.emoji === emoji);
            const mine = existing?.user_ids.some((id) =>
                sameId(id, currentUser?.id),
            );

            if (existing && mine) {
                existing.user_ids = existing.user_ids.filter(
                    (id) => !sameId(id, currentUser?.id),
                );
                existing.count -= 1;
            } else if (existing) {
                existing.user_ids.push(currentUser?.id);
                existing.count += 1;
            } else {
                reactions.push({
                    emoji,
                    count: 1,
                    user_ids: [currentUser?.id],
                });
            }

            message.reactions = reactions.filter((r) => r.count > 0);
            patchMessageDOM(message);
        }

        try {
            const { data } = await api.post(
                `/conversations/${conversationId}/messages/${messageId}/reactions`,
                { emoji },
            );
            const fresh = getCache(conversationId).messages.find((m) =>
                sameId(m.id, messageId),
            );

            if (fresh) {
                fresh.reactions = data.data.reactions;

                if (isActiveId(conversationId)) {
                    patchMessageDOM(fresh);
                }
            }
        } catch (error) {
            if (message && before) {
                message.reactions = before;

                if (isActiveId(conversationId)) {
                    patchMessageDOM(message);
                }
            }

            showToast(
                apiErrorMessage(error, t('common.error_generic')),
                'error',
            );
        }
    }

    /** Telegram's message menu; `point` is where it opened (for the picker). */
    function messageContextItems(message, point = null, target = null) {
        if (isTemporary(message)) {
            return message.status === 'failed'
                ? [
                      {
                          label: escapeHtml(t('chat.retry')),
                          icon: 'refresh',
                          onClick: () => retryMessage(message.id),
                      },
                      {
                          label: escapeHtml(t('common.delete')),
                          icon: 'trash',
                          danger: true,
                          onClick: () => discardMessage(message),
                      },
                  ]
                : [];
        }

        const L = (key) => escapeHtml(t(key));
        const items = [];
        const canWrite = !composer.hidden || Boolean(selection);
        const isSystem = message.type === 'system';
        const attachmentEl = target?.closest('[data-attachment-id]');

        if (attachmentEl) {
            items.push({
                label: L('chat.menu.file_info'),
                icon: 'file',
                onClick: () =>
                    showMessageInfo(message, attachmentEl.dataset.attachmentId),
            });
        }

        if (!isSystem) {
            if (canWrite) {
                items.push({
                    label: L('chat.reply'),
                    icon: 'reply',
                    onClick: () => setReplyTarget(message),
                });
            }

            if (message.is_mine && message.type === 'text' && message.body) {
                items.push({
                    label: L('chat.menu.edit'),
                    icon: 'edit',
                    onClick: () => setEditTarget(message),
                });
            }

            items.push({
                label: L(message.is_pinned ? 'chat.unpin' : 'chat.pin'),
                icon: 'pin',
                onClick: () => togglePin(message),
            });
        }

        if (message.body || isSystem) {
            items.push({
                label: L('chat.menu.copy_text'),
                icon: 'copy',
                onClick: () => copyMessages([message]),
            });
        }

        items.push({
            label: L('chat.menu.copy_link'),
            icon: 'link',
            onClick: () => copyText(messageLink(message)),
        });

        if (!isSystem) {
            items.push(
                {
                    label: L('chat.menu.forward'),
                    icon: 'forward',
                    onClick: () => forwardMessages([message]),
                },
                {
                    label: L('chat.react'),
                    icon: 'smile',
                    onClick: () => openReactionPicker(message, point),
                },
            );
        }

        items.push(
            {
                label: L('chat.menu.select'),
                icon: 'check-circle',
                onClick: () => enterSelection(message.id),
            },
            {
                label: L('chat.menu.info'),
                icon: 'info',
                onClick: () => showMessageInfo(message),
            },
        );

        if (!message.is_mine && message.sender?.id && !isSystem) {
            items.push({
                label: L('chat.view_profile'),
                icon: 'user',
                onClick: () => openProfile(message.sender.id),
            });
        }

        items.push(
            { divider: true },
            {
                label: L('common.delete'),
                icon: 'trash',
                danger: true,
                onClick: () => deleteMessages([message]),
            },
        );

        return items;
    }

    messagesEl?.addEventListener(
        'contextmenu',
        (event) => {
            const row = event.target.closest('[data-message-id]');

            if (!row || event.target.closest('a') || selection) {
                return;
            }

            const message = findMessage(row.dataset.messageId);
            const items = message
                ? messageContextItems(
                      message,
                      { x: event.clientX, y: event.clientY },
                      event.target,
                  )
                : [];

            if (items.length) {
                event.preventDefault();
                openContextMenu(event.clientX, event.clientY, items);
            }
        },
        { signal },
    );

    function wireLongPress() {
        attachLongPress(messagesEl, (x, y, event) => {
            if (selection) {
                return;
            }

            const message = findMessage(
                event.target.closest('[data-message-id]')?.dataset.messageId,
            );
            const items = message
                ? messageContextItems(message, { x, y }, event.target)
                : [];

            if (items.length) {
                window.getSelection()?.removeAllRanges();
                openContextMenu(x, y, items);
            }
        });

        attachLongPress(listEl, (x, y, event) => {
            const row = event.target.closest('[data-conversation-id]');
            const conversation = row
                ? findConversation(row.dataset.conversationId)
                : null;

            if (conversation) {
                openListMenu(conversation, x, y);
            }
        });
    }

    function openReactionPicker(message, anchorOrPoint) {
        document.querySelector('.reaction-picker')?.remove();

        const picker = document.createElement('div');
        picker.className = 'reaction-picker';
        const button = (emoji) =>
            `<button type="button" data-emoji="${escapeHtml(emoji)}">${escapeHtml(emoji)}</button>`;
        picker.innerHTML = `${QUICK_REACTIONS.map(button).join('')}<button type="button" class="reaction-picker__more" data-reactions-more aria-label="${escapeHtml(t('chat.more_reactions'))}">${icon('chevdown', { size: 14 })}</button>`;

        let x = window.innerWidth / 2;
        let y = window.innerHeight / 2;

        if (anchorOrPoint instanceof Element) {
            const rect = anchorOrPoint.getBoundingClientRect();
            x = rect.left;
            y = rect.top - 48;
        } else if (anchorOrPoint && Number.isFinite(anchorOrPoint.x)) {
            x = anchorOrPoint.x;
            y = anchorOrPoint.y - 48;
        }

        document.body.appendChild(picker);

        const place = () => {
            const rect = picker.getBoundingClientRect();
            picker.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
            picker.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
        };

        place();

        const close = () => {
            picker.remove();
            document.removeEventListener('pointerdown', outside, true);
            document.removeEventListener('keydown', onKey);
            signal.removeEventListener('abort', close);
        };

        function outside(e) {
            if (!picker.contains(e.target)) {
                close();
            }
        }

        function onKey(e) {
            if (e.key === 'Escape') {
                close();
            }
        }

        picker.addEventListener('click', (e) => {
            if (e.target.closest('[data-reactions-more]')) {
                picker.classList.add('reaction-picker--all');
                picker.innerHTML = ALL_REACTIONS.map(button).join('');
                place();

                return;
            }

            const choice = e.target.closest('[data-emoji]');

            if (choice) {
                toggleReaction(message.id, choice.dataset.emoji);
                close();
            }
        });

        window.setTimeout(() => {
            document.addEventListener('pointerdown', outside, true);
            document.addEventListener('keydown', onKey);
        }, 0);
        signal.addEventListener('abort', close);
    }

    /*
    |--------------------------------------------------------------------------
    | Lightbox — photos of the open chat, with previous/next
    |--------------------------------------------------------------------------
    */

    function openLightbox(url) {
        const gallery = messages.flatMap((m) =>
            (m.attachments || []).filter((a) => attachmentKind(a) === 'image'),
        );
        let index = Math.max(
            0,
            gallery.findIndex((a) => a.url === url),
        );
        const box = document.createElement('div');
        box.className = 'lightbox';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.innerHTML = `
            <img class="lightbox__image" src="${escapeHtml(url)}" alt="">
            <a class="lightbox__download" href="${escapeHtml(url)}" download aria-label="${escapeHtml(t('chat.download'))}">${icon('download', { className: 'lightbox__download-icon' })}</a>
            <button type="button" class="lightbox__close" aria-label="${escapeHtml(t('common.close'))}">${icon('x')}</button>
            ${gallery.length > 1 ? `<button type="button" class="lightbox__nav lightbox__nav--prev" data-lightbox-step="-1" aria-label="${escapeHtml(t('chat.previous'))}">${icon('left')}</button><button type="button" class="lightbox__nav lightbox__nav--next" data-lightbox-step="1" aria-label="${escapeHtml(t('chat.next'))}">${icon('chev')}</button>` : ''}
        `;
        document.body.appendChild(box);
        box.querySelector('.lightbox__close').focus();

        const show = (step) => {
            if (gallery.length < 2) {
                return;
            }

            index = (index + step + gallery.length) % gallery.length;
            const item = gallery[index];
            box.querySelector('.lightbox__image').src = item.url;
            box.querySelector('.lightbox__download').href = item.url;
        };

        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                close();
            } else if (e.key === 'ArrowLeft') {
                show(-1);
            } else if (e.key === 'ArrowRight') {
                show(1);
            }
        };

        const close = () => {
            box.remove();
            document.removeEventListener('keydown', onKey);
            signal.removeEventListener('abort', close);
        };

        box.querySelector('.lightbox__close').addEventListener('click', close);
        box.addEventListener('click', (e) => {
            const step = e.target.closest('[data-lightbox-step]');

            if (step) {
                show(Number(step.dataset.lightboxStep));
            } else if (e.target === box) {
                close();
            }
        });
        document.addEventListener('keydown', onKey);
        signal.addEventListener('abort', close);
    }

    /*
    |--------------------------------------------------------------------------
    | Search — all conversations + within one conversation
    |--------------------------------------------------------------------------
    */

    /** Marks the query in plain text; matching runs on the text, not on entities. */
    function highlightQuery(text, query) {
        if (!query) {
            return escapeHtml(text);
        }

        const lower = text.toLowerCase();
        const needle = query.toLowerCase();
        let html = '';
        let last = 0;
        let at = lower.indexOf(needle);

        while (at !== -1 && needle) {
            html += `${escapeHtml(text.slice(last, at))}<mark>${escapeHtml(text.slice(at, at + needle.length))}</mark>`;
            last = at + needle.length;
            at = lower.indexOf(needle, last);
        }

        return html + escapeHtml(text.slice(last));
    }

    function searchResultTime(iso) {
        const day = listTime(iso);
        const time = formatTime(iso);

        return day === time ? time : `${day} ${time}`;
    }

    function renderSearchResults(results, query) {
        if (!results.length) {
            searchPanelResults.innerHTML = emptyState(
                escapeHtml(t('chat.no_results')),
            );

            return;
        }

        searchPanelResults.innerHTML = results
            .map(
                (message) => `
                <button type="button" class="chat-search-result" data-search-result-conversation="${Number(message.conversation_id)}" data-search-result-message="${Number(message.id)}">
                    <div class="chat-search-result__meta">
                        <span>${escapeHtml(message.sender?.name || '')}${globalSearchMode && message.conversation ? ` · <b>${escapeHtml(message.conversation.type === 'saved' ? t('chat.saved_messages') : message.conversation.title || '')}</b>` : ''}</span>
                        <span class="mono">${escapeHtml(searchResultTime(message.created_at_iso))}</span>
                    </div>
                    <div class="chat-search-result__body">${highlightQuery(messagePreview(message), query)}</div>
                </button>
            `,
            )
            .join('');
    }

    let searchRequest = 0;

    async function runSearch(query, scopedToConversation) {
        const requestId = ++searchRequest;

        if (!query) {
            searchPanelResults.innerHTML = '';

            return;
        }

        searchPanelResults.innerHTML =
            '<div class="skeleton skeleton-row m-3"></div>';

        try {
            const params = { q: query, per_page: 50 };

            if (scopedToConversation && activeConversation) {
                params.conversation_id = activeConversation.id;
            }

            const { data } = await api.get('/messages/search', { params });

            if (requestId === searchRequest && !searchPanel.hidden) {
                renderSearchResults(data.data || [], query);
            }
        } catch (error) {
            if (requestId === searchRequest) {
                searchPanelResults.innerHTML = emptyState(
                    escapeHtml(
                        apiErrorMessage(error, t('common.error_generic')),
                    ),
                );
            }
        }
    }

    /** Where the panel was opened from, to go back there on close. */
    let viewBeforeSearch = 'list';

    function openSearchPanel(scopedToConversation) {
        globalSearchMode = !scopedToConversation;
        viewBeforeSearch = shell.dataset.view;
        searchPanel.hidden = false;
        searchRequest += 1;
        shell.dataset.view = 'conversation';

        searchPanelInput.value = '';
        searchPanelInput.placeholder = scopedToConversation
            ? t('chat.search_in_chat')
            : t('chat.search_all');
        searchPanelResults.innerHTML = '';
        searchPanelInput.focus();
    }

    function closeSearchPanel() {
        searchPanel.hidden = true;
        searchRequest += 1;

        if (!activeConversation) {
            shell.dataset.view = 'list';
        } else if (window.innerWidth <= 800) {
            shell.dataset.view = viewBeforeSearch;
        }
    }

    $('[data-chat-global-search]')?.addEventListener(
        'click',
        () => openSearchPanel(false),
        { signal },
    );
    $('[data-chat-search-toggle]')?.addEventListener(
        'click',
        () => openSearchPanel(true),
        { signal },
    );
    $('[data-chat-search-close]')?.addEventListener('click', closeSearchPanel, {
        signal,
    });

    searchPanelInput?.addEventListener(
        'input',
        () => {
            window.clearTimeout(searchTimer);
            searchTimer = window.setTimeout(
                () =>
                    runSearch(searchPanelInput.value.trim(), !globalSearchMode),
                300,
            );
        },
        { signal },
    );

    searchPanelInput?.addEventListener(
        'keydown',
        (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeSearchPanel();
            }
        },
        { signal },
    );

    searchPanelResults?.addEventListener(
        'click',
        async (event) => {
            const result = event.target.closest(
                '[data-search-result-conversation]',
            );

            if (!result) {
                return;
            }

            const conversationId = Number(
                result.dataset.searchResultConversation,
            );
            const messageId = Number(result.dataset.searchResultMessage);

            searchPanel.hidden = true;

            if (!isActiveId(conversationId)) {
                await openConversationById(conversationId, messageId);

                return;
            }

            shell.dataset.view = 'conversation';
            jumpToMessage(conversationId, messageId);
        },
        { signal },
    );

    /*
    |--------------------------------------------------------------------------
    | Info pane: the conversation, a person, or all pins
    |--------------------------------------------------------------------------
    */

    /** Whether the info pane opens with a conversation (on by default). */
    function detailsPreferred() {
        try {
            return localStorage.getItem('chat.details') !== 'closed';
        } catch {
            return true;
        }
    }

    function rememberDetails(isOpen) {
        try {
            localStorage.setItem('chat.details', isOpen ? 'open' : 'closed');
        } catch {
            // Private mode: the choice lasts until the page is left.
        }
    }

    function openDetails(entry, { reset = false } = {}) {
        if (entry.mode !== 'profile' && !activeConversation) {
            return;
        }

        showDetails(reset ? [entry] : [...detailsStack, entry]);
        shell.setAttribute('data-details-open', '');
        shell.dataset.view = 'details';

        // On a wide screen the thread stays in view beside the pane.
        if (window.innerWidth > 800) {
            shell.dataset.view = activeConversation ? 'conversation' : 'list';
        }
    }

    function closeDetails() {
        shell.removeAttribute('data-details-open');
        shell.dataset.view = activeConversation ? 'conversation' : 'list';
        detailsStack = [];
    }

    function showDetails(stack) {
        detailsStack = stack;
        renderDetails();
    }

    function currentDetails() {
        return detailsStack[detailsStack.length - 1] ?? null;
    }

    detailsBack?.addEventListener(
        'click',
        () => {
            if (detailsStack.length > 1) {
                showDetails(detailsStack.slice(0, -1));

                return;
            }

            // A phone: back to the thread (or the list).
            closeDetails();
        },
        { signal },
    );

    $('[data-chat-details-close]')?.addEventListener(
        'click',
        () => {
            closeDetails();
            rememberDetails(false);
        },
        { signal },
    );

    function refreshDetails({ quiet = false } = {}) {
        if (!shell.hasAttribute('data-details-open') || !currentDetails()) {
            return;
        }

        const scroll = detailsContent.scrollTop;
        renderDetails({ quiet });
        detailsContent.scrollTop = scroll;
    }

    function renderDetails({ quiet = false } = {}) {
        const entry = currentDetails();

        if (!entry) {
            return;
        }

        // Whatever renders now wins over a profile still loading.
        profileRequest += 1;
        detailsBack.hidden =
            detailsStack.length <= 1 && window.innerWidth > 800;

        if (entry.mode === 'pinned') {
            detailsTitle.textContent = t('chat.pinned_messages');
            detailsContent.innerHTML = pinnedListHtml();

            return;
        }

        if (entry.mode === 'profile') {
            detailsTitle.textContent = t('chat.profile');
            renderProfile(entry.userId, { quiet });

            return;
        }

        if (!activeConversation) {
            return;
        }

        if (activeConversation.is_saved) {
            detailsTitle.textContent = t('chat.info');
            detailsContent.innerHTML = savedInfoHtml();

            return;
        }

        // A private chat's info is the other person's profile.
        if (
            activeConversation.type === 'private' &&
            activeConversation.other_user_id
        ) {
            detailsTitle.textContent = t('chat.info');
            renderProfile(activeConversation.other_user_id, {
                quiet,
                withConversation: true,
            });

            return;
        }

        detailsTitle.textContent = t('chat.info');
        detailsContent.innerHTML = groupInfoHtml();
    }

    function roleLabel(role) {
        const normalised = role === 'owner' ? 'creator' : role;

        return normalised && normalised !== 'member'
            ? t(`chat.group.role_${normalised}`)
            : '';
    }

    function permissions() {
        return activeShow?.permissions || {};
    }

    /** What I may do to this member (Telegram's rules, the server's word). */
    function memberActions(member) {
        const perms = permissions();
        const myRole = activeShow?.my_role ?? activeConversation?.my_role;
        const theirs = member.role === 'owner' ? 'creator' : member.role;
        const iAmCreator = ['creator', 'owner'].includes(myRole);
        const actions = [];

        if (member.is_me || theirs === 'creator') {
            return actions;
        }

        if (perms.can_change_roles) {
            actions.push(theirs === 'admin' ? 'demote' : 'promote');
        }

        if (perms.can_remove_members && (iAmCreator || theirs === 'member')) {
            actions.push('remove');
        }

        if (iAmCreator) {
            actions.push('transfer');
        }

        return actions;
    }

    function membersHtml() {
        if (!members.length) {
            return '<div class="skeleton skeleton-row"></div>';
        }

        // The server orders creator, admins, members, then by name.
        return members
            .map((member) => {
                const online = isOnline(member.id);
                const role = roleLabel(member.role);
                const actions = memberActions(member);

                return `
                    <div class="chat-member-row">
                        <button type="button" class="chat-member" data-profile-user="${Number(member.id)}">
                            ${avatarHtml(member.name, member.avatar, { className: 'chat-member__avatar', online })}
                            <span class="chat-member__body">
                                <span class="chat-member__name">${escapeHtml(member.name)}${member.is_me ? ` <span class="chat-member__status">(${escapeHtml(t('chat.you'))})</span>` : ''}</span>
                                <span class="chat-member__status ${online ? 'chat-member__status--online' : ''}">${escapeHtml(online ? t('chat.online') : lastSeenText(member.last_seen_at))}</span>
                            </span>
                            ${role ? `<span class="chat-member__role">${escapeHtml(role)}</span>` : ''}
                        </button>
                        ${actions.length ? `<button type="button" class="icon-btn icon-btn--sm chat-member__menu" data-member-menu="${Number(member.id)}" aria-label="${escapeHtml(t('chat.more'))}">${icon('more', { size: 15 })}</button>` : ''}
                    </div>
                `;
            })
            .join('');
    }

    function pinnedListHtml() {
        if (!pinned.length) {
            return `<div class="chat-details-section">${emptyState(escapeHtml(t('chat.no_pinned_messages')))}</div>`;
        }

        return `
            <div class="chat-details-section">
                ${pinned
                    .map(
                        (m) => `
                    <div class="chat-pinned-item">
                        <button type="button" class="chat-pinned-item__body" data-details-scroll-to="${Number(m.id)}">
                            <span class="chat-pinned-item__meta">${escapeHtml(m.sender?.name || '')} · <span class="mono">${escapeHtml(searchResultTime(m.created_at_iso))}</span></span>
                            <span class="chat-pinned-item__text">${escapeHtml(messagePreview(m))}</span>
                        </button>
                        <button type="button" class="icon-btn icon-btn--sm" data-details-unpin="${Number(m.id)}" aria-label="${escapeHtml(t('chat.unpin'))}" title="${escapeHtml(t('chat.unpin'))}">${icon('x', { size: 14 })}</button>
                    </div>
                `,
                    )
                    .join('')}
            </div>
        `;
    }

    function statsLine() {
        const stats = activeShow?.stats;

        if (!stats) {
            return '';
        }

        return `
            <div class="chat-info-stats">
                ${['media', 'files', 'voice', 'links']
                    .map(
                        (key) =>
                            `<span class="chat-info-stats__item"><b class="mono">${Number(stats[key] || 0)}</b>${escapeHtml(t(`chat.conv_info.stat_${key}`))}</span>`,
                    )
                    .join('')}
            </div>
        `;
    }

    function sharedMediaHtml() {
        const media = messages.flatMap((m) =>
            (m.attachments || []).filter((a) => attachmentKind(a) === 'image'),
        );
        const files = messages.flatMap((m) =>
            (m.attachments || []).filter((a) =>
                ['file', 'audio', 'video'].includes(attachmentKind(a)),
            ),
        );

        return `
            ${
                pinned.length
                    ? `<div class="chat-details-section">
                        <h3 class="chat-details-section__title">${escapeHtml(t('chat.pinned_messages'))} <span class="mono chat-details-section__count">${pinned.length}</span></h3>
                        ${pinnedListHtml().replace('<div class="chat-details-section">', '<div>')}
                    </div>`
                    : ''
            }
            <div class="chat-details-section">
                <h3 class="chat-details-section__title">${escapeHtml(t('chat.shared_media'))} ${activeShow?.stats ? `<span class="mono chat-details-section__count">${Number(activeShow.stats.media || 0)}</span>` : ''}</h3>
                ${statsLine()}
                ${
                    media.length
                        ? `<div class="chat-media-grid">${media
                              .filter((a) => !String(a.url).startsWith('blob:'))
                              .slice(-12)
                              .reverse()
                              .map(
                                  (a) =>
                                      `<img src="${escapeHtml(a.url)}" alt="" loading="lazy" data-details-lightbox="${escapeHtml(a.url)}">`,
                              )
                              .join('')}</div>`
                        : `<div class="text-xs muted">${escapeHtml(t('chat.no_shared_media'))}</div>`
                }
            </div>
            ${
                files.length
                    ? `<div class="chat-details-section">
                        <h3 class="chat-details-section__title">${escapeHtml(t('chat.files'))} <span class="mono chat-details-section__count">${activeShow?.stats ? Number(activeShow.stats.files || 0) : files.length}</span></h3>
                        <div class="stack gap-2">${files.slice(-6).reverse().map(fileHtml).join('')}</div>
                    </div>`
                    : ''
            }
        `;
    }

    function savedInfoHtml() {
        return `
            <div class="chat-info-hero">
                <span class="avatar chat-info-hero__avatar chat-avatar--saved">${icon('bookmark', { size: 28 })}</span>
                <div class="chat-info-hero__name">${escapeHtml(t('chat.saved_messages'))}</div>
                <div class="chat-info-hero__meta">${escapeHtml(t('chat.saved_hint'))}</div>
            </div>
            <div class="chat-info-actions">
                <button type="button" class="chat-info-action" data-info-action="search">${icon('search', { size: 16 })}${escapeHtml(t('common.search'))}</button>
                <button type="button" class="chat-info-action" data-info-action="pinned">${icon('pin', { size: 16 })}${escapeHtml(t('chat.pinned_short'))}</button>
                <button type="button" class="chat-info-action" data-info-action="conv-info">${icon('info', { size: 16 })}${escapeHtml(t('chat.menu.info'))}</button>
            </div>
            ${sharedMediaHtml()}
        `;
    }

    function groupInfoHtml() {
        const conversation = activeConversation;
        const online = onlineMembers().length;
        const perms = permissions();
        const count =
            activeShow?.members_count ??
            conversation.members_count ??
            members.length;
        const description = activeShow?.description ?? conversation.description;
        const isCreator = ['creator', 'owner'].includes(
            activeShow?.my_role ?? conversation.my_role,
        );

        return `
            <div class="chat-info-hero">
                ${
                    perms.can_edit_info
                        ? `<button type="button" class="chat-info-hero__photo" data-info-action="photo" aria-label="${escapeHtml(t('chat.group.change_photo'))}" title="${escapeHtml(t('chat.group.change_photo'))}">`
                        : ''
                }
                <span class="avatar chat-info-hero__avatar ${conversation.avatar ? '' : `avatar--hue-${avatarHue(conversation.title || '')}`}">
                    ${conversation.avatar ? avatarMedia(conversation.avatar) : icon(conversation.type === 'channel' ? 'megaphone' : 'users', { size: 28 })}
                </span>
                ${perms.can_edit_info ? `<span class="chat-info-hero__photo-badge">${icon('camera', { size: 13 })}</span></button>` : ''}
                <div class="chat-info-hero__name">${escapeHtml(conversation.title || '')}</div>
                <div class="chat-info-hero__meta">${escapeHtml(tChoice('chat.members_plural', count))}${online ? ` · <b>${escapeHtml(t('chat.online_count', { count: online }))}</b>` : ''}</div>
                ${description ? `<p class="chat-info-bio">${escapeHtml(description)}</p>` : ''}
            </div>

            <div class="chat-info-actions">
                <button type="button" class="chat-info-action" data-info-action="search">${icon('search', { size: 16 })}${escapeHtml(t('common.search'))}</button>
                ${perms.can_add_members ? `<button type="button" class="chat-info-action" data-info-action="add-members">${icon('user-plus', { size: 16 })}${escapeHtml(t('chat.add_members'))}</button>` : ''}
                <button type="button" class="chat-info-action" data-info-action="pinned">${icon('pin', { size: 16 })}${escapeHtml(t('chat.pinned_short'))}</button>
                <button type="button" class="chat-info-action" data-info-action="conv-info">${icon('info', { size: 16 })}${escapeHtml(t('chat.menu.info'))}</button>
            </div>

            ${
                perms.can_edit_info
                    ? `<div class="chat-info-manage">
                        <button type="button" class="btn btn--ghost btn--sm" data-info-action="edit-info">${icon('edit', { size: 14 })}${escapeHtml(t('chat.group.edit'))}</button>
                        ${conversation.avatar ? `<button type="button" class="btn btn--ghost btn--sm" data-info-action="remove-photo">${icon('trash', { size: 14 })}${escapeHtml(t('chat.group.remove_photo'))}</button>` : ''}
                    </div>`
                    : ''
            }

            <div class="chat-details-section">
                <h3 class="chat-details-section__title">${escapeHtml(t('chat.members'))} <span class="mono chat-details-section__count">${Number(count) || ''}</span></h3>
                ${membersHtml()}
            </div>

            ${sharedMediaHtml()}

            <div class="chat-details-section chat-info-danger">
                <button type="button" class="btn btn--ghost btn--sm chat-info-danger__btn" data-info-action="leave">${icon('logout', { size: 14 })}${escapeHtml(t('chat.list_menu.leave'))}</button>
                ${perms.can_delete_conversation || isCreator ? `<button type="button" class="btn btn--ghost btn--sm chat-info-danger__btn" data-info-action="delete-group">${icon('trash', { size: 14 })}${escapeHtml(t('chat.list_menu.delete_group'))}</button>` : ''}
            </div>
        `;
    }

    /*
    | Group management: title/description, photo, roles, removing members,
    | handing over ownership. Every button above is shown only when the
    | server's permissions allow it; the server checks again.
    */

    function editGroupInfo() {
        const conversation = activeConversation;
        const { modal, close } = openModal({
            title: t('chat.group.edit'),
            bodyHtml: `
                <div class="field-group">
                    <label class="field-label">${escapeHtml(t('chat.group.title'))}</label>
                    <input class="field-input" data-group-edit-title maxlength="60" value="${escapeHtml(conversation.title || '')}">
                </div>
                <div class="field-group">
                    <label class="field-label">${escapeHtml(t('chat.group.description'))}</label>
                    <textarea class="field-input" rows="3" maxlength="255" data-group-edit-description>${escapeHtml(activeShow?.description ?? conversation.description ?? '')}</textarea>
                </div>
            `,
            footerHtml: `
                <button type="button" class="btn btn--outline btn--sm" data-action="cancel">${escapeHtml(t('common.cancel'))}</button>
                <button type="button" class="btn btn--primary btn--sm" data-action="save">${escapeHtml(t('common.save'))}</button>
            `,
        });

        modal
            .querySelector('[data-action="cancel"]')
            .addEventListener('click', close);
        modal
            .querySelector('[data-action="save"]')
            .addEventListener('click', async (event) => {
                const title = modal
                    .querySelector('[data-group-edit-title]')
                    .value.trim();
                const description = modal
                    .querySelector('[data-group-edit-description]')
                    .value.trim();

                if (title.length < 3) {
                    showToast(t('chat.group.title_short'), 'warning');

                    return;
                }

                event.currentTarget.disabled = true;

                try {
                    await api.patch(`/conversations/${conversation.id}`, {
                        title,
                        description: description || null,
                    });
                    close();
                    onConversationUpdated({
                        conversation_id: conversation.id,
                        title,
                        description: description || null,
                        avatar: conversation.avatar,
                        members_count: conversation.members_count,
                    });
                    await loadShow(conversation.id);
                    refreshDetails({ quiet: true });
                } catch (error) {
                    event.currentTarget.disabled = false;
                    showToast(
                        apiErrorMessage(error, t('common.error_generic')),
                        'error',
                    );
                }
            });
    }

    function changeGroupPhoto() {
        const conversation = activeConversation;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png,image/jpeg,image/gif,image/webp';
        input.addEventListener('change', async () => {
            const file = input.files?.[0];

            if (!file) {
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                showToast(t('chat.group.photo_too_big'), 'warning');

                return;
            }

            const form = new FormData();
            form.append('file', file);

            try {
                await api.post(
                    `/conversations/${conversation.id}/avatar`,
                    form,
                    {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    },
                );
                await fetchSummary(conversation.id);
                renderThreadHeader();
                refreshDetails({ quiet: true });
            } catch (error) {
                showToast(
                    apiErrorMessage(error, t('common.error_generic')),
                    'error',
                );
            }
        });
        input.click();
    }

    async function removeGroupPhoto() {
        const conversation = activeConversation;

        try {
            await api.delete(`/conversations/${conversation.id}/avatar`);
            await fetchSummary(conversation.id);
            renderThreadHeader();
            refreshDetails({ quiet: true });
        } catch (error) {
            showToast(
                apiErrorMessage(error, t('common.error_generic')),
                'error',
            );
        }
    }

    async function memberRequest(request, successKey) {
        const conversationId = activeConversation.id;

        try {
            await request();
            showToast(t(successKey), 'success');
            await Promise.all([
                loadMembers(conversationId),
                loadShow(conversationId),
            ]);
            renderThreadStatus();
            refreshDetails({ quiet: true });
        } catch (error) {
            showToast(
                apiErrorMessage(error, t('common.error_generic')),
                'error',
            );
        }
    }

    function openMemberMenu(member, x, y) {
        const conversationId = activeConversation.id;
        const items = memberActions(member).map((action) => {
            switch (action) {
                case 'promote':
                    return {
                        label: escapeHtml(t('chat.group.make_admin')),
                        icon: 'shield',
                        onClick: () =>
                            memberRequest(
                                () =>
                                    api.patch(
                                        `/conversations/${conversationId}/members/${member.id}`,
                                        { role: 'admin' },
                                    ),
                                'chat.group.role_changed',
                            ),
                    };
                case 'demote':
                    return {
                        label: escapeHtml(t('chat.group.remove_admin')),
                        icon: 'shield',
                        onClick: () =>
                            memberRequest(
                                () =>
                                    api.patch(
                                        `/conversations/${conversationId}/members/${member.id}`,
                                        { role: 'member' },
                                    ),
                                'chat.group.role_changed',
                            ),
                    };
                case 'transfer':
                    return {
                        label: escapeHtml(t('chat.group.transfer')),
                        icon: 'key',
                        onClick: async () => {
                            try {
                                const confirmed = await confirmDialog({
                                    title: t('chat.group.transfer_title', {
                                        name: member.name,
                                    }),
                                    message: t('chat.group.transfer_body'),
                                    confirmText: t('chat.group.transfer'),
                                    danger: true,
                                    icon: 'key',
                                    onConfirm: () =>
                                        api.post(
                                            `/conversations/${conversationId}/transfer`,
                                            {
                                                user_id: member.id,
                                            },
                                        ),
                                });

                                if (confirmed) {
                                    await memberRequest(
                                        () => Promise.resolve(),
                                        'chat.group.transferred',
                                    );
                                    fetchSummary(conversationId);
                                }
                            } catch (error) {
                                showToast(
                                    apiErrorMessage(
                                        error,
                                        t('common.error_generic'),
                                    ),
                                    'error',
                                );
                            }
                        },
                    };
                default:
                    return {
                        label: escapeHtml(t('chat.group.remove_member')),
                        icon: 'trash',
                        danger: true,
                        onClick: async () => {
                            try {
                                const confirmed = await confirmDialog({
                                    title: t('chat.group.remove_title', {
                                        name: member.name,
                                    }),
                                    confirmText: t('chat.group.remove_member'),
                                    danger: true,
                                    onConfirm: () =>
                                        api.delete(
                                            `/conversations/${conversationId}/members`,
                                            {
                                                data: { user_ids: [member.id] },
                                            },
                                        ),
                                });

                                if (confirmed) {
                                    await memberRequest(
                                        () => Promise.resolve(),
                                        'chat.group.removed',
                                    );
                                }
                            } catch (error) {
                                showToast(
                                    apiErrorMessage(
                                        error,
                                        t('common.error_generic'),
                                    ),
                                    'error',
                                );
                            }
                        },
                    };
            }
        });

        openContextMenu(x, y, [
            {
                label: escapeHtml(t('chat.view_profile')),
                icon: 'user',
                onClick: () => openProfile(member.id),
            },
            ...items,
        ]);
    }

    async function fetchProfile(userId) {
        if (profileCache.has(userId)) {
            return profileCache.get(userId);
        }

        const { data } = await api.get(`/users/${userId}`);
        profileCache.set(userId, data.data);

        return data.data;
    }

    function localTime(timezone) {
        if (!timezone) {
            return '';
        }

        try {
            const name =
                typeof timezone === 'string' ? timezone : timezone.name;

            return `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: name })} · ${name.split('/').pop().replace(/_/g, ' ')}`;
        } catch {
            return '';
        }
    }

    let profileRequest = 0;

    async function renderProfile(
        userId,
        { quiet = false, withConversation = false } = {},
    ) {
        const requestId = ++profileRequest;

        if (!quiet || !profileCache.has(userId)) {
            if (!profileCache.has(userId)) {
                detailsContent.innerHTML =
                    '<div class="chat-details-section"><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div></div>';
            }
        }

        let profile;

        try {
            profile = await fetchProfile(userId);
        } catch (error) {
            if (requestId === profileRequest) {
                detailsContent.innerHTML = `<div class="chat-details-section">${emptyState(escapeHtml(apiErrorMessage(error, t('chat.profile_error'))))}</div>`;
            }

            return;
        }

        if (requestId !== profileRequest) {
            return;
        }

        const online = isOnline(profile.id);
        const inGroup =
            activeConversation &&
            activeConversation.type !== 'private' &&
            members.some((m) => sameId(m.id, profile.id));
        const status = online
            ? `<b>${escapeHtml(t('chat.online'))}</b>`
            : escapeHtml(lastSeenText(profile.last_seen_at));
        const subtitle = [profile.department, profile.role]
            .filter(Boolean)
            .map(escapeHtml)
            .join(' · ');
        const facts = [
            [
                'email',
                profile.email
                    ? `<a class="mono" href="mailto:${escapeHtml(profile.email)}">${escapeHtml(profile.email)}</a>`
                    : '',
            ],
            ['local_time', escapeHtml(localTime(profile.timezone))],
            ['department', escapeHtml(profile.department || '')],
            ['role', escapeHtml(profile.role || '')],
            [
                'joined',
                escapeHtml(
                    profile.joined_at_iso
                        ? formatDate(profile.joined_at_iso, { year: 'always' })
                        : profile.joined_at || '',
                ),
            ],
        ].filter(([, value]) => value);

        const groups = profile.common_groups || [];

        detailsContent.innerHTML = `
            <div class="chat-info-hero">
                ${avatarHtml(profile.name, profile.avatar, { className: 'chat-info-hero__avatar', online })}
                <div class="chat-info-hero__name">${escapeHtml(profile.name)}</div>
                <div class="chat-info-hero__meta">${subtitle ? `${subtitle} · ` : ''}${status}</div>
            </div>

            ${
                profile.is_me
                    ? ''
                    : `<div class="chat-info-actions">
                        ${withConversation ? '' : `<button type="button" class="chat-info-action chat-info-action--primary" data-info-action="write" data-user-id="${profile.id}">${icon('chat', { size: 16 })}${escapeHtml(t('chat.write'))}</button>`}
                        ${withConversation ? `<button type="button" class="chat-info-action" data-info-action="search">${icon('search', { size: 16 })}${escapeHtml(t('common.search'))}</button>` : ''}
                        ${inGroup ? `<button type="button" class="chat-info-action" data-info-action="mention" data-user-id="${profile.id}">${icon('at', { size: 16 })}${escapeHtml(t('chat.mention'))}</button>` : ''}
                        ${withConversation ? `<button type="button" class="chat-info-action" data-info-action="pinned">${icon('pin', { size: 16 })}${escapeHtml(t('chat.pinned_short'))}</button>` : ''}
                        ${withConversation ? `<button type="button" class="chat-info-action" data-info-action="conv-info">${icon('info', { size: 16 })}${escapeHtml(t('chat.menu.info'))}</button>` : ''}
                    </div>`
            }
            ${
                withConversation && !profile.is_me
                    ? `<div class="chat-info-manage">
                        <button type="button" class="btn btn--ghost btn--sm ${activeConversation?.is_blocked ? '' : 'chat-info-danger__btn'}" data-info-action="block">${icon('ban', { size: 14 })}${escapeHtml(t(activeConversation?.is_blocked ? 'chat.block.unblock' : 'chat.block.block'))}</button>
                    </div>`
                    : ''
            }

            <a class="chat-info-link" href="/users/${profile.id}">${escapeHtml(t('chat.open_full_profile'))} ${icon('arrow', { size: 14 })}</a>

            ${
                facts.length
                    ? `<div class="chat-details-section">
                        <h3 class="chat-details-section__title">${escapeHtml(t('chat.contacts'))}</h3>
                        <dl class="chat-info-facts">${facts.map(([key, value]) => `<dt>${escapeHtml(t(`chat.fact_${key}`))}</dt><dd>${value}</dd>`).join('')}</dl>
                    </div>`
                    : ''
            }

            ${
                profile.is_me
                    ? ''
                    : `<div class="chat-details-section">
                        <h3 class="chat-details-section__title">${escapeHtml(t('chat.common_groups'))} <span class="mono chat-details-section__count">${groups.length}</span></h3>
                        ${
                            groups.length
                                ? groups
                                      .map(
                                          (g) =>
                                              `<button type="button" class="chat-group-link" data-open-conversation="${g.id}">${escapeHtml(g.title || '')}</button>`,
                                      )
                                      .join('')
                                : `<div class="text-xs muted">${escapeHtml(t('chat.no_common_groups'))}</div>`
                        }
                    </div>`
            }

            ${withConversation ? sharedMediaHtml() : ''}
        `;
    }

    function openProfile(userId) {
        if (!userId) {
            return;
        }

        // Someone's own private chat info already is their profile.
        if (
            currentDetails()?.mode === 'profile' &&
            sameId(currentDetails().userId, userId)
        ) {
            return;
        }

        const inDetails =
            shell.hasAttribute('data-details-open') && detailsStack.length;
        openDetails({ mode: 'profile', userId }, { reset: !inDetails });
    }

    detailsContent?.addEventListener(
        'click',
        async (event) => {
            const unpin = event.target.closest('[data-details-unpin]');

            if (unpin) {
                const message = pinned.find((m) =>
                    sameId(m.id, unpin.dataset.detailsUnpin),
                );

                if (message) {
                    togglePin({ ...message, is_pinned: true });
                }

                return;
            }

            const scrollTarget = event.target.closest(
                '[data-details-scroll-to]',
            );

            if (scrollTarget && activeConversation) {
                if (window.innerWidth <= 800) {
                    shell.dataset.view = 'conversation';
                }

                jumpToMessage(
                    activeConversation.id,
                    Number(scrollTarget.dataset.detailsScrollTo),
                );

                return;
            }

            const memberMenu = event.target.closest('[data-member-menu]');

            if (memberMenu) {
                const member = members.find((m) =>
                    sameId(m.id, memberMenu.dataset.memberMenu),
                );
                const rect = memberMenu.getBoundingClientRect();

                if (member) {
                    openMemberMenu(member, rect.left - 180, rect.bottom + 4);
                }

                return;
            }

            const profileButton = event.target.closest('[data-profile-user]');

            if (profileButton) {
                openProfile(Number(profileButton.dataset.profileUser));

                return;
            }

            const openConversationButton = event.target.closest(
                '[data-open-conversation]',
            );

            if (openConversationButton) {
                openConversationById(
                    Number(openConversationButton.dataset.openConversation),
                );

                return;
            }

            const img = event.target.closest('[data-details-lightbox]');

            if (img) {
                openLightbox(img.dataset.detailsLightbox);

                return;
            }

            const action = event.target.closest('[data-info-action]');

            if (!action) {
                return;
            }

            switch (action.dataset.infoAction) {
                case 'write':
                    openPrivateChatWith(Number(action.dataset.userId));
                    break;
                case 'mention': {
                    const member = members.find((m) =>
                        sameId(m.id, action.dataset.userId),
                    );

                    if (member) {
                        if (window.innerWidth <= 800) {
                            shell.dataset.view = 'conversation';
                        }

                        mentionMember(member);
                    }

                    break;
                }
                case 'search':
                    openSearchPanel(true);
                    break;
                case 'pinned':
                    openDetails({ mode: 'pinned' });
                    break;
                case 'add-members':
                    userPickerModal({ multi: true, addTo: activeConversation });
                    break;
                case 'conv-info':
                    openConversationInfo({
                        conversation: activeConversation,
                        title: titleOf(activeConversation),
                    });
                    break;
                case 'edit-info':
                    editGroupInfo();
                    break;
                case 'photo':
                    changeGroupPhoto();
                    break;
                case 'remove-photo':
                    removeGroupPhoto();
                    break;
                case 'block':
                    toggleBlock(activeConversation);
                    break;
                case 'leave':
                    leaveConversation(activeConversation);
                    break;
                case 'delete-group':
                    deleteConversation(activeConversation);
                    break;
                default:
            }
        },
        { signal },
    );

    /*
    |--------------------------------------------------------------------------
    | New conversation / add members — user picker
    |--------------------------------------------------------------------------
    */

    function userPickerModal({ multi, addTo = null }) {
        const selected = new Map();
        const existing = new Set(addTo ? members.map((m) => m.id) : []);

        const { close, modal } = openModal({
            title: addTo
                ? t('chat.add_members')
                : multi
                  ? t('chat.start_group')
                  : t('chat.start_private'),
            bodyHtml: `
                ${multi && !addTo ? `<div class="field-group"><input class="field-input" data-group-title placeholder="${escapeHtml(t('chat.group_name_placeholder'))}"></div>` : ''}
                <div class="field-group">
                    <input class="field-input" type="search" data-user-query placeholder="${escapeHtml(t('common.search'))}" autocomplete="off">
                </div>
                ${multi ? '<div class="row row--wrap gap-2 mb-3" data-selected-users></div>' : ''}
                <div class="user-picker__results" data-user-results><div class="skeleton skeleton-row"></div></div>
            `,
            footerHtml: `
                <button type="button" class="btn btn--outline btn--sm" data-action="cancel">${escapeHtml(t('common.cancel'))}</button>
                <button type="button" class="btn btn--primary btn--sm" data-action="confirm" ${multi ? 'disabled' : 'hidden'}>${escapeHtml(addTo ? t('chat.add') : t('chat.create'))}</button>
            `,
        });

        const queryInput = modal.querySelector('[data-user-query]');
        const resultsEl = modal.querySelector('[data-user-results]');
        const selectedEl = modal.querySelector('[data-selected-users]');
        const confirmBtn = modal.querySelector('[data-action="confirm"]');
        let found = [];

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
                        `<span class="pill pill--primary">${escapeHtml(user.name)} <button class="pill__remove" type="button" data-remove-user="${user.id}" aria-label="${escapeHtml(t('common.delete'))}">${icon('x', { size: 12 })}</button></span>`,
                )
                .join('');

            confirmBtn.disabled = selected.size === 0;
        }

        function renderFound() {
            const users = found.filter(
                (u) => !selected.has(u.id) && !existing.has(u.id),
            );

            resultsEl.innerHTML =
                users
                    .map(
                        (user) => `
                    <button type="button" class="user-picker__row" data-pick-user="${user.id}">
                        ${avatarHtml(user.name, user.avatar, { online: isOnline(user.id) })}
                        <span class="user-picker__row-body">
                            <span>${escapeHtml(user.name)}</span>
                            <small>${escapeHtml(user.department || user.email || '')}</small>
                        </span>
                    </button>
                `,
                    )
                    .join('') ||
                `<div class="field-hint p-2">${escapeHtml(t('chat.people_empty'))}</div>`;
        }

        let requestId = 0;

        async function searchUsers(query) {
            const current = ++requestId;

            try {
                const { data } = await api.get('/users', {
                    params: { q: query || undefined, per_page: 50 },
                });

                if (current === requestId) {
                    found = data.data || [];
                    renderFound();
                }
            } catch {
                if (current === requestId) {
                    resultsEl.innerHTML = '';
                }
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

            const user = found.find((u) => sameId(u.id, pick.dataset.pickUser));

            if (!user) {
                return;
            }

            if (!multi) {
                close();
                await openPrivateChatWith(user.id);

                return;
            }

            selected.set(user.id, user);
            renderSelected();
            renderFound();
        });

        selectedEl?.addEventListener('click', (event) => {
            const remove = event.target.closest('[data-remove-user]');

            if (remove) {
                selected.delete(Number(remove.dataset.removeUser));
                renderSelected();
                renderFound();
            }
        });

        confirmBtn.addEventListener('click', async () => {
            // The dialog stays open until the server agrees, so a refusal
            // does not lose the selection.
            if (addTo) {
                confirmBtn.disabled = true;

                try {
                    await api.post(`/conversations/${addTo.id}/members`, {
                        user_ids: [...selected.keys()],
                    });
                    close();
                    await Promise.all([
                        loadMembers(addTo.id),
                        loadShow(addTo.id),
                    ]);
                    renderThreadStatus();
                    refreshDetails();
                } catch (error) {
                    confirmBtn.disabled = false;
                    showToast(
                        apiErrorMessage(error, t('common.error_generic')),
                        'error',
                    );
                }

                return;
            }

            const title = modal
                .querySelector('[data-group-title]')
                ?.value.trim();

            if (!title || title.length < 3) {
                showToast(t('chat.group.title_short'), 'warning');

                return;
            }

            confirmBtn.disabled = true;

            if (
                await createConversation({
                    type: 'group',
                    title,
                    user_ids: [...selected.keys()],
                })
            ) {
                close();
            } else {
                confirmBtn.disabled = false;
            }
        });

        searchUsers('');
        (modal.querySelector('[data-group-title]') || queryInput).focus();
    }

    async function createConversation(payload) {
        try {
            const { data } = await api.post('/conversations', payload);
            const created = (await fetchSummary(data.data.id)) ||
                findConversation(data.data.id) || {
                    ...data.data,
                    unread_count: 0,
                };

            selectListType('all');
            await openConversation(findConversation(created.id) || created);

            return true;
        } catch (error) {
            showToast(
                apiErrorMessage(error, t('common.error_generic')),
                'error',
            );

            return false;
        }
    }

    $('[data-start-private]')?.addEventListener(
        'click',
        () => userPickerModal({ multi: false }),
        { signal },
    );
    $('[data-start-group]')?.addEventListener(
        'click',
        () => userPickerModal({ multi: true }),
        { signal },
    );
    $('[data-open-saved]')?.addEventListener('click', () => openSaved(), {
        signal,
    });
    $('[data-open-archive]')?.addEventListener(
        'click',
        () => openArchive(true),
        { signal },
    );

    /*
    |--------------------------------------------------------------------------
    | List tabs and search (left pane)
    |--------------------------------------------------------------------------
    */

    let conversationSearchTimer = null;

    function selectListType(type) {
        const previousType = listType;
        listType = type;

        document
            .querySelectorAll('[data-chat-type]')
            .forEach((other) =>
                other.setAttribute(
                    'aria-selected',
                    String(other.dataset.chatType === type),
                ),
            );

        const showPeople = type === 'people';
        listEl.hidden = showPeople;
        peopleEl.hidden = !showPeople;
        searchInput.placeholder = showPeople
            ? t('chat.search_people')
            : t('chat.search_placeholder');

        if (showPeople) {
            loadPeople();
        } else if (previousType === 'people') {
            // The list may be stale for what the search box says now.
            loadConversations(searchInput.value);
        } else {
            renderConversationList();
        }
    }

    document.querySelectorAll('[data-chat-type]').forEach((button) => {
        button.addEventListener(
            'click',
            () => selectListType(button.dataset.chatType),
            { signal },
        );
    });

    searchInput?.addEventListener(
        'input',
        () => {
            window.clearTimeout(conversationSearchTimer);
            conversationSearchTimer = window.setTimeout(() => {
                if (listType === 'people') {
                    loadPeople();
                } else {
                    loadConversations(searchInput.value);
                }
            }, 300);
        },
        { signal },
    );

    /*
    |--------------------------------------------------------------------------
    | Catching up — tab focus and reconnects
    |--------------------------------------------------------------------------
    |
    | A hidden tab marks nothing read; when it shows again, what is on
    | screen is checked. After a lost socket every window that is not open
    | is dropped (it may have missed events) and the open one is fetched
    | again.
    */

    handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && activeConversation) {
            scheduleReadCheck();
        }
    };

    let stopReconnect = () => {};

    function watchReconnect() {
        stopReconnect = onReconnect(async () => {
            [...conversationCache.keys()].forEach((key) => {
                if (!isActiveId(key)) {
                    conversationCache.delete(key);
                }
            });

            await loadConversations(
                listType === 'people' ? '' : searchInput?.value || '',
            );

            if (activeConversation) {
                const cache = getCache(activeConversation.id);

                if (!cache.hasMoreAfter) {
                    cache.hasMoreAfter = true; // the end may have moved on
                    await reloadActiveWindow();
                }

                loadPinned(activeConversation.id);
            }
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Opening a specific conversation/message from outside the chat pane
    |--------------------------------------------------------------------------
    */

    async function openConversationById(conversationId, messageId) {
        let conversation = findConversation(conversationId);

        if (!conversation) {
            // Not in the loaded page of the list (older, archived, or new).
            conversation = await fetchSummary(conversationId);
        }

        if (!conversation || !isAlive()) {
            return;
        }

        selectListType(listType === 'people' ? 'all' : listType);
        await openConversation(
            findConversation(conversationId) || conversation,
        );

        if (messageId) {
            jumpToMessage(conversationId, messageId);
        }
    }

    handleOpenConversationEvent = (event) => {
        openConversationById(
            event.detail.conversationId,
            event.detail.messageId,
        );
    };

    // The browser's Back/Forward between /chat and /chat/{id}.
    window.addEventListener(
        'popstate',
        () => {
            const match = window.location.pathname.match(/\/chat\/(\d+)/);

            if (match) {
                if (!isActiveId(match[1])) {
                    openConversationById(Number(match[1]));
                }
            } else if (window.location.pathname === '/chat') {
                shell.dataset.view = 'list';
                setActiveConversationId(null);
            }
        },
        { signal },
    );

    /*
    | Esc closes what is on top: the selection, then search, then the info
    | pane. Dialogs and menus handle their own Esc first.
    */
    document.addEventListener(
        'keydown',
        (event) => {
            if (
                event.key !== 'Escape' ||
                event.defaultPrevented ||
                document.querySelector(
                    '.modal-overlay, .menu--floating, .lightbox, .reaction-picker',
                )
            ) {
                return;
            }

            if (selection) {
                exitSelection();
            } else if (!searchPanel.hidden) {
                closeSearchPanel();
            } else if (shell.hasAttribute('data-details-open')) {
                closeDetails();
            }
        },
        { signal },
    );

    currentCleanup = () => {
        if (activeConversation && !editTarget) {
            saveDraft(activeConversation.id, composerInput.value);
        }

        window.clearTimeout(readTimer);
        // What was seen before leaving still counts as read.
        flushReads();
        window.cancelAnimationFrame(readCheckFrame);
        window.clearTimeout(draftSaveTimer);
        window.clearTimeout(searchTimer);
        window.clearTimeout(conversationSearchTimer);
        typingByConversation.forEach((bucket) =>
            bucket.forEach((entry) => window.clearTimeout(entry.timer)),
        );
        stopRecording({ send: false });
        audioPlayer?.pause();
        bottomObserver.disconnect();
        unsubscribeUser();
        unsubscribePresence();
        stopReconnect();
        setActiveConversationId(null);
        handleVisibilityChange = null;
        handleOpenConversationEvent = null;
        controller.abort();
    };

    /*
    |--------------------------------------------------------------------------
    | Boot
    |--------------------------------------------------------------------------
    */

    (async () => {
        currentUser = await bootstrapAppState();

        // Torn down while the user was loading: nothing more to do.
        if (!isAlive() || !currentUser) {
            return;
        }

        configureTime(currentUser);
        initPresence();
        wireLongPress();
        subscribeToUser();
        watchReconnect();

        // Everyone in the People tab is for everybody; a super admin also
        // sees banned accounts there (marked).
        shell.toggleAttribute(
            'data-super-admin',
            hasRole(currentUser, 'SUPER_ADMIN'),
        );

        await loadConversations();

        if (!isAlive()) {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const match = window.location.pathname.match(/\/chat\/(\d+)/);
        const messageParam = params.get('message');

        if (match) {
            await openConversationById(
                Number(match[1]),
                messageParam ? Number(messageParam) : null,
            );
        }

        // "Write" on someone's profile lands here as ?user=ID.
        const userParam = params.get('user');

        if (!match && userParam) {
            window.history.replaceState(window.history.state, '', '/chat');
            await openPrivateChatWith(Number(userParam));
        }

        // "New chat" / "New group" from the header or the command palette
        // on another page lands here as ?new=private|group. The parameter
        // is dropped straight away so a reload doesn't reopen the picker.
        const newParam = params.get('new');

        if (!match && (newParam === 'private' || newParam === 'group')) {
            window.history.replaceState(window.history.state, '', '/chat');
            $(
                newParam === 'group'
                    ? '[data-start-group]'
                    : '[data-start-private]',
            )?.click();
        }

        if (params.get('tab') === 'people') {
            selectListType('people');
        }
    })();
}

function teardown() {
    currentCleanup?.();
    currentCleanup = null;
}

// Registered ONCE, ever — `document`/`window` persist across Turbo
// navigations, so these must NOT be inside boot() or they'd stack a new
// listener on every revisit. They just forward to whatever the current
// boot cycle's real handler is (or no-op if chat isn't currently booted).
document.addEventListener('chat:open-conversation', (event) => {
    handleOpenConversationEvent?.(event);
});

document.addEventListener('visibilitychange', () => {
    handleVisibilityChange?.();
});

window.addEventListener('beforeunload', () => {
    currentCleanup?.();
});

bootOnPage('[data-chat-shell]', boot, teardown);
