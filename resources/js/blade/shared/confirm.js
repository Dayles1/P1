import { openModal } from './modal';

/**
 * Promise-based replacement for `window.confirm()` — resolves `true` when
 * the user confirms, `false` on cancel/backdrop-click/Escape.
 *
 * confirmDialog({
 *     title: 'Revoke session?',
 *     message: 'This device will be signed out immediately.',
 *     confirmText: 'Revoke',
 *     cancelText: 'Cancel',
 *     danger: true,
 * })
 */
export function confirmDialog({
    title = 'Are you sure?',
    message = '',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    danger = false,
} = {}) {
    return new Promise((resolve) => {
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
        modal.querySelector('[data-action="cancel"]').textContent = cancelText;
        modal.querySelector('[data-action="confirm"]').textContent = confirmText;

        const settle = (result) => {
            settled = true;
            resolve(result);
            close();
        };

        modal.querySelector('[data-action="cancel"]').addEventListener('click', () => settle(false));
        modal.querySelector('[data-action="confirm"]').addEventListener('click', () => settle(true));

        modal.querySelector('[data-action="confirm"]').focus();
    });
}
