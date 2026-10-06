import { api } from '../../axios';
import { avatarHue, avatarMedia, initials } from '../../shared/auth-state';
import { escapeHtml } from '../../shared/forms';
import { t, tChoice } from '../../shared/i18n';
import { icon } from '../../shared/icon';
import { openModal } from '../../shared/modal';
import { apiErrorMessage, showToast } from '../../shared/toast';

/*
| Forwarding: pick one or more chats (searchable), add an optional
| comment, optionally hide who wrote the originals. The server answers
| with the new messages per target chat; `onDone` gets them so the page
| can show them at once (its own broadcast skips this tab).
*/

export function conversationTitle(conversation) {
    return conversation?.is_saved
        ? t('chat.saved_messages')
        : conversation?.title || t('common.unknown');
}

function chatAvatar(conversation) {
    const title = conversation.is_saved ? '' : conversationTitle(conversation);

    if (conversation.is_saved) {
        return `<span class="avatar avatar--sm chat-avatar--saved">${icon('bookmark', { size: 14 })}</span>`;
    }

    if (conversation.avatar) {
        return `<span class="avatar avatar--sm">${avatarMedia(conversation.avatar, title)}</span>`;
    }

    return `<span class="avatar avatar--sm avatar--hue-${avatarHue(title)}">${
        conversation.type === 'private'
            ? `<span class="avatar__initials">${escapeHtml(initials(title))}</span>`
            : icon('users', { size: 13 })
    }</span>`;
}

export function openForwardDialog({ fromConversationId, messageIds, onDone }) {
    const picked = new Map();
    let found = [];
    let requestId = 0;

    const { modal, close } = openModal({
        title: tChoice('chat.forward.title', messageIds.length),
        bodyHtml: `
            <div class="chat-forward">
                <label class="field-box field-box--sm">
                    ${icon('search', { size: 14, className: 'field-box__icon' })}
                    <input class="field-box__input" type="search" data-forward-query placeholder="${escapeHtml(t('chat.forward.search'))}" autocomplete="off">
                </label>
                <div class="chat-forward__picked" data-forward-picked hidden></div>
                <div class="chat-forward__list" data-forward-list role="listbox" aria-multiselectable="true"><div class="skeleton skeleton-row"></div></div>
                <textarea class="field-input chat-forward__comment" rows="2" maxlength="5000" data-forward-comment placeholder="${escapeHtml(t('chat.forward.comment'))}"></textarea>
                <label class="checkbox">
                    <input type="checkbox" class="checkbox__input" data-forward-hide-sender>
                    <span class="checkbox__box" aria-hidden="true"></span>
                    <span class="checkbox__text"><span class="checkbox__label">${escapeHtml(t('chat.forward.hide_sender'))}</span></span>
                </label>
            </div>
        `,
        footerHtml: `
            <button type="button" class="btn btn--outline btn--sm" data-action="cancel">${escapeHtml(t('common.cancel'))}</button>
            <button type="button" class="btn btn--primary btn--sm" data-action="send" disabled>${icon('forward', { size: 14 })}${escapeHtml(t('chat.forward.send'))}</button>
        `,
    });

    modal.classList.add('chat-forward-modal');

    const queryInput = modal.querySelector('[data-forward-query]');
    const listEl = modal.querySelector('[data-forward-list]');
    const pickedEl = modal.querySelector('[data-forward-picked]');
    const sendBtn = modal.querySelector('[data-action="send"]');

    function renderPicked() {
        pickedEl.hidden = picked.size === 0;
        pickedEl.innerHTML = [...picked.values()]
            .map(
                (c) =>
                    `<span class="pill pill--primary">${escapeHtml(conversationTitle(c))} <button type="button" class="pill__remove" data-forward-unpick="${Number(c.id)}" aria-label="${escapeHtml(t('common.delete'))}">${icon('x', { size: 11 })}</button></span>`,
            )
            .join('');
        sendBtn.disabled = picked.size === 0;
    }

    function renderList() {
        const usable = found.filter((c) => c.can_send !== false);

        listEl.innerHTML =
            usable
                .map(
                    (c) => `
                <button type="button" class="chat-forward__row" role="option" aria-selected="${picked.has(c.id)}" data-forward-pick="${Number(c.id)}">
                    ${chatAvatar(c)}
                    <span class="chat-forward__name">${escapeHtml(conversationTitle(c))}</span>
                    <span class="chat-forward__check">${picked.has(c.id) ? icon('check', { size: 13 }) : ''}</span>
                </button>
            `,
                )
                .join('') ||
            `<div class="field-hint p-2">${escapeHtml(t('chat.forward.nothing'))}</div>`;
    }

    async function search(query) {
        const current = ++requestId;

        try {
            const { data } = await api.get('/conversations', {
                params: {
                    folder: 'all',
                    search: query || undefined,
                    per_page: 50,
                },
            });

            if (current === requestId) {
                found = data.data || [];
                renderList();
            }
        } catch {
            if (current === requestId) {
                listEl.innerHTML = '';
            }
        }
    }

    let timer = null;

    queryInput.addEventListener('input', () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => search(queryInput.value.trim()), 250);
    });

    listEl.addEventListener('click', (event) => {
        const row = event.target.closest('[data-forward-pick]');

        if (!row) {
            return;
        }

        const id = Number(row.dataset.forwardPick);

        if (picked.has(id)) {
            picked.delete(id);
        } else if (picked.size < 20) {
            picked.set(
                id,
                found.find((c) => Number(c.id) === id),
            );
        }

        renderPicked();
        renderList();
    });

    pickedEl.addEventListener('click', (event) => {
        const remove = event.target.closest('[data-forward-unpick]');

        if (remove) {
            picked.delete(Number(remove.dataset.forwardUnpick));
            renderPicked();
            renderList();
        }
    });

    modal
        .querySelector('[data-action="cancel"]')
        .addEventListener('click', close);

    sendBtn.addEventListener('click', async () => {
        sendBtn.disabled = true;

        try {
            const comment = modal
                .querySelector('[data-forward-comment]')
                .value.trim();
            const { data } = await api.post('/messages/forward', {
                from_conversation_id: fromConversationId,
                message_ids: messageIds,
                conversation_ids: [...picked.keys()],
                comment: comment || undefined,
                hide_sender: modal.querySelector('[data-forward-hide-sender]')
                    .checked,
            });

            close();
            showToast(tChoice('chat.forward.done', picked.size), 'success');
            onDone?.(data.data?.conversations || [], [...picked.values()]);
        } catch (error) {
            sendBtn.disabled = false;
            showToast(
                apiErrorMessage(error, t('common.error_generic')),
                'error',
            );
        }
    });

    search('');
    queryInput.focus();
}
