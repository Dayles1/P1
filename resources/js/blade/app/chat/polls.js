import { api } from '../../axios';
import { escapeHtml } from '../../shared/forms';
import { t } from '../../shared/i18n';
import { icon } from '../../shared/icon';
import { openModal } from '../../shared/modal';
import { apiErrorMessage, showToast } from '../../shared/toast';

const MAX_OPTIONS = 10;

function checkbox(attribute, label, hint = '') {
    return `
        <label class="checkbox">
            <input type="checkbox" class="checkbox__input" ${attribute}>
            <span class="checkbox__box" aria-hidden="true"></span>
            <span class="checkbox__text">
                <span class="checkbox__label">${escapeHtml(label)}</span>
                ${hint ? `<span class="checkbox__hint">${escapeHtml(hint)}</span>` : ''}
            </span>
        </label>
    `;
}

function optionRow(value = '') {
    return `
        <div class="chat-poll-form__option">
            <input class="field-input" maxlength="100" data-poll-option-input value="${escapeHtml(value)}" placeholder="${escapeHtml(t('chat.poll.option_placeholder'))}">
            <button type="button" class="icon-btn icon-btn--sm" data-poll-option-remove aria-label="${escapeHtml(t('common.delete'))}">${icon('x', { size: 14 })}</button>
        </div>
    `;
}

/** The "new poll" dialog; `onCreated(message)` gets the poll message. */
export function openPollDialog({ conversationId, clientId, onCreated }) {
    const { modal, close } = openModal({
        title: t('chat.poll.new'),
        bodyHtml: `
            <div class="chat-poll-form">
                <div class="field-group">
                    <label class="field-label">${escapeHtml(t('chat.poll.question'))}</label>
                    <input class="field-input" maxlength="255" data-poll-question placeholder="${escapeHtml(t('chat.poll.question_placeholder'))}">
                </div>
                <div class="field-group">
                    <label class="field-label">${escapeHtml(t('chat.poll.options'))}</label>
                    <div class="chat-poll-form__options" data-poll-options>${optionRow()}${optionRow()}</div>
                    <button type="button" class="btn btn--ghost btn--sm" data-poll-add>${icon('plus', { size: 14 })}${escapeHtml(t('chat.poll.add_option'))}</button>
                </div>
                ${checkbox('data-poll-anonymous checked', t('chat.poll.anonymous_label'), t('chat.poll.anonymous_hint'))}
                ${checkbox('data-poll-multiple', t('chat.poll.multiple_label'))}
            </div>
        `,
        footerHtml: `
            <button type="button" class="btn btn--outline btn--sm" data-action="cancel">${escapeHtml(t('common.cancel'))}</button>
            <button type="button" class="btn btn--primary btn--sm" data-action="create">${escapeHtml(t('chat.poll.create'))}</button>
        `,
    });

    const optionsEl = modal.querySelector('[data-poll-options]');
    const addBtn = modal.querySelector('[data-poll-add]');
    const createBtn = modal.querySelector('[data-action="create"]');

    const syncAdd = () => {
        addBtn.hidden = optionsEl.children.length >= MAX_OPTIONS;
    };

    addBtn.addEventListener('click', () => {
        optionsEl.insertAdjacentHTML('beforeend', optionRow());
        optionsEl.lastElementChild.querySelector('input').focus();
        syncAdd();
    });

    optionsEl.addEventListener('click', (event) => {
        const remove = event.target.closest('[data-poll-option-remove]');

        if (remove && optionsEl.children.length > 2) {
            remove.closest('.chat-poll-form__option').remove();
            syncAdd();
        }
    });

    optionsEl.addEventListener('keydown', (event) => {
        if (
            event.key === 'Enter' &&
            event.target.matches('[data-poll-option-input]')
        ) {
            event.preventDefault();

            if (optionsEl.children.length < MAX_OPTIONS) {
                addBtn.click();
            }
        }
    });

    modal
        .querySelector('[data-action="cancel"]')
        .addEventListener('click', close);

    createBtn.addEventListener('click', async () => {
        const question = modal
            .querySelector('[data-poll-question]')
            .value.trim();
        const options = [
            ...optionsEl.querySelectorAll('[data-poll-option-input]'),
        ]
            .map((input) => input.value.trim())
            .filter(Boolean);

        if (!question || options.length < 2) {
            showToast(t('chat.poll.invalid'), 'warning');

            return;
        }

        if (new Set(options).size !== options.length) {
            showToast(t('chat.poll.duplicate'), 'warning');

            return;
        }

        createBtn.disabled = true;

        try {
            const { data } = await api.post(
                `/conversations/${conversationId}/polls`,
                {
                    question,
                    options,
                    multiple: modal.querySelector('[data-poll-multiple]')
                        .checked,
                    anonymous: modal.querySelector('[data-poll-anonymous]')
                        .checked,
                    client_id: clientId,
                },
            );

            close();
            onCreated?.(data.data);
        } catch (error) {
            createBtn.disabled = false;
            showToast(
                apiErrorMessage(error, t('common.error_generic')),
                'error',
            );
        }
    });
}
