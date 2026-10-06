import { escapeHtml } from '../../shared/forms';
import { t } from '../../shared/i18n';
import { icon } from '../../shared/icon';
import { openOverlay } from '../../shared/modal';

/**
 * A confirm dialog with several answers ("Delete for me" / "Delete for
 * everyone" / "Cancel"). Resolves with the chosen `value`, or null.
 * `checkbox` adds one tick box whose state comes back as `checked`.
 */
export function chooseDialog({
    title,
    message = '',
    choices,
    danger = true,
    iconName = 'trash',
}) {
    return new Promise((resolve) => {
        let settled = false;
        const panel = document.createElement('div');
        const titleId = `choose-title-${Math.random().toString(36).slice(2, 9)}`;

        panel.className = `confirm chat-choose${danger ? ' confirm--danger' : ''}`;
        panel.setAttribute('role', 'alertdialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', titleId);
        panel.innerHTML = `
            <span class="confirm__icon">${icon(iconName, { size: 22 })}</span>
            <div class="confirm__text">
                <h2 class="confirm__title" id="${titleId}">${escapeHtml(title)}</h2>
                ${message ? `<p class="confirm__message">${escapeHtml(message)}</p>` : ''}
            </div>
            <div class="confirm__actions chat-choose__actions">
                ${choices
                    .map(
                        (choice, index) =>
                            `<button type="button" class="btn ${choice.danger ? 'btn--danger' : choice.primary ? 'btn--primary' : 'btn--outline'}" data-choice="${index}">${escapeHtml(choice.label)}</button>`,
                    )
                    .join('')}
                <button type="button" class="btn btn--ghost" data-choice="cancel">${escapeHtml(t('common.cancel'))}</button>
            </div>
        `;

        const { close } = openOverlay(panel, {
            onClose: () => {
                if (!settled) {
                    settled = true;
                    resolve(null);
                }
            },
        });

        panel.addEventListener('click', (event) => {
            const button = event.target.closest('[data-choice]');

            if (!button) {
                return;
            }

            settled = true;
            resolve(
                button.dataset.choice === 'cancel'
                    ? null
                    : choices[Number(button.dataset.choice)].value,
            );
            close();
        });

        panel.querySelector('[data-choice]')?.focus();
    });
}
