/**
 * Generic modal shell shared by the confirm dialog and any "show details"
 * popover (request log detail, etc.). Returns a `close()` function.
 */
export function openModal({ title = '', bodyHtml = '', footerHtml = '', wide = false, onClose } = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal';

    if (wide) {
        modal.style.maxWidth = '720px';
    }

    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    modal.innerHTML = `
        <div class="modal__header">
            <h2 class="modal__title"></h2>
            <button type="button" class="modal__close" aria-label="Close">&times;</button>
        </div>
        <div class="modal__body"></div>
        ${footerHtml ? `<div class="modal__footer">${footerHtml}</div>` : ''}
    `;

    modal.querySelector('.modal__title').textContent = title;
    modal.querySelector('.modal__body').innerHTML = bodyHtml;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const previouslyFocused = document.activeElement;

    function close() {
        document.body.style.overflow = '';
        overlay.remove();
        document.removeEventListener('keydown', onKeydown);

        if (previouslyFocused instanceof HTMLElement) {
            previouslyFocused.focus();
        }

        onClose?.();
    }

    function onKeydown(event) {
        if (event.key === 'Escape') {
            close();

            return;
        }

        if (event.key === 'Tab') {
            const focusable = modal.querySelectorAll('button, a[href], input, textarea, select');
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (!first || !last) {
                return;
            }

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    }

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            close();
        }
    });

    modal.querySelector('.modal__close').addEventListener('click', close);
    document.addEventListener('keydown', onKeydown);

    return { close, modal, overlay };
}
