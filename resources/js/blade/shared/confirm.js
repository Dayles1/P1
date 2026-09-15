import { openModal } from './modal';

/**
 * Promise-based replacement for `window.confirm()` — resolves `true` when
 * the user confirms, `false` on cancel/backdrop-click/Escape.
 *
 * Without `onConfirm`, resolves as soon as the user clicks confirm (the
 * caller does the async work itself afterwards) — this is the original,
 * still-supported shape. Pass `onConfirm` to show a spinner in the confirm
 * button while it runs: either way the dialog closes once it settles, but
 * on failure the promise *rejects* with the same error instead of resolving,
 * so an outer `try/catch` around the whole call can toast it exactly like it
 * would for a bare API call.
 *
 * confirmDialog({
 *     title: 'Revoke session?',
 *     message: 'This device will be signed out immediately.',
 *     confirmText: 'Revoke',
 *     cancelText: 'Cancel',
 *     danger: true,
 *     onConfirm: () => api.delete(`/sessions/${id}`),
 * })
 */
export function confirmDialog({
    title = 'Are you sure?',
    message = '',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    danger = false,
    onConfirm = null,
} = {}) {
    return new Promise((resolve, reject) => {
        let settled = false;

        const { close, modal } = openModal({
            title,
            bodyHtml: `<p style="margin:0;"></p>`,
            footerHtml: `
                <button type="button" class="btn btn--outline btn--sm" data-action="cancel"></button>
                <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'} btn--sm" data-action="confirm"></button>
            `,
            onClose: () => {
                if (!settled) {
                    settled = true;
                    resolve(false);
                }
            },
        });

        modal.querySelector('.modal__body p').textContent = message;

        const cancelBtn = modal.querySelector('[data-action="cancel"]');
        const confirmBtn = modal.querySelector('[data-action="confirm"]');
        const confirmLabel = confirmText;

        cancelBtn.textContent = cancelText;
        confirmBtn.textContent = confirmLabel;

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
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = `<span class="btn__spinner" aria-hidden="true"></span>${confirmLabel}`;

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
