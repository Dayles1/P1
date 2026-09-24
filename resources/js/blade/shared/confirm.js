import { t } from './i18n';
import { icon } from './icon';
import { openOverlay } from './modal';

/**
 * Promise-based replacement for `window.confirm()` — resolves `true` when
 * the user confirms, `false` on cancel/backdrop-click/Escape.
 *
 * Without `onConfirm`, resolves as soon as the user clicks confirm (the
 * caller does the async work itself afterwards). Pass `onConfirm` to show
 * a spinner in the confirm button while it runs: either way the dialog
 * closes once it settles, but on failure the promise *rejects* with the
 * same error instead of resolving, so an outer `try/catch` around the
 * whole call can toast it exactly like it would for a bare API call.
 *
 * confirmDialog({
 *     title: t('confirm.revoke_session_title'),
 *     message: t('confirm.revoke_session_message'),
 *     confirmText: t('confirm.revoke_session_confirm'),
 *     danger: true,
 *     icon: 'logout',
 *     onConfirm: () => api.delete(`/sessions/${id}`),
 * })
 */
export function confirmDialog({
    title = t('components.confirm_title'),
    message = '',
    confirmText = t('common.confirm'),
    cancelText = t('common.cancel'),
    danger = false,
    icon: iconName = danger ? 'alert' : 'info',
    onConfirm = null,
} = {}) {
    return new Promise((resolve, reject) => {
        let settled = false;

        const panel = document.createElement('div');
        const titleId = `confirm-title-${Math.random().toString(36).slice(2, 9)}`;

        panel.className = `confirm${danger ? ' confirm--danger' : ''}`;
        panel.setAttribute('role', 'alertdialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', titleId);
        panel.innerHTML = `
            <span class="confirm__icon">${icon(iconName, { size: 22 })}</span>
            <div class="confirm__text">
                <h2 class="confirm__title" id="${titleId}"></h2>
                <p class="confirm__message"></p>
            </div>
            <div class="confirm__actions">
                <button type="button" class="btn btn--outline" data-action="cancel"></button>
                <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-action="confirm"></button>
            </div>
        `;

        panel.querySelector('.confirm__title').textContent = title;
        panel.querySelector('.confirm__message').textContent = message;
        panel.querySelector('.confirm__message').hidden = !message;

        const cancelBtn = panel.querySelector('[data-action="cancel"]');
        const confirmBtn = panel.querySelector('[data-action="confirm"]');

        cancelBtn.textContent = cancelText;
        confirmBtn.textContent = confirmText;

        const { close } = openOverlay(panel, {
            onClose: () => {
                if (!settled) {
                    settled = true;
                    resolve(false);
                }
            },
        });

        const settle = (result) => {
            settled = true;
            resolve(result);
            close();
        };

        cancelBtn.addEventListener('click', () => settle(false));

        confirmBtn.addEventListener('click', async () => {
            if (!onConfirm) {
                settle(true);

                return;
            }

            cancelBtn.disabled = true;
            confirmBtn.setAttribute('aria-busy', 'true');
            confirmBtn.innerHTML = `<span class="spinner" aria-hidden="true"></span>`;
            confirmBtn.append(confirmText);

            try {
                await onConfirm();
                settled = true;
                resolve(true);
                close();
            } catch (error) {
                settled = true;
                reject(error);
                close();
            }
        });

        confirmBtn.focus();
    });
}
