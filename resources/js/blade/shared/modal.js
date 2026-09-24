import { t } from './i18n';
import { icon } from './icon';

const FOCUSABLE =
    'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The layer every dialog sits on: dimmed backdrop, scroll lock, focus
 * trap, Esc and backdrop-click to close, focus handed back afterwards.
 * `panel` is the dialog element itself (.modal, .drawer, .confirm).
 * Returns `close()`.
 */
export function openOverlay(panel, { onClose, drawer = false } = {}) {
    const overlay = document.createElement('div');
    overlay.className = `modal-overlay${drawer ? ' modal-overlay--drawer' : ''}`;
    overlay.appendChild(panel);

    const previouslyFocused = document.activeElement;
    let closed = false;

    function close() {
        if (closed) {
            return;
        }

        closed = true;
        overlay.remove();
        document.removeEventListener('keydown', onKeydown);

        if (!document.querySelector('.modal-overlay')) {
            document.body.classList.remove('scroll-lock');
        }

        if (previouslyFocused instanceof HTMLElement) {
            previouslyFocused.focus();
        }

        onClose?.();
    }

    function onKeydown(event) {
        // Only the top-most dialog reacts when two are stacked.
        if (
            overlay !== [...document.querySelectorAll('.modal-overlay')].pop()
        ) {
            return;
        }

        if (event.key === 'Escape') {
            event.stopPropagation();
            close();

            return;
        }

        if (event.key !== 'Tab') {
            return;
        }

        const focusable = [...panel.querySelectorAll(FOCUSABLE)];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (!first) {
            event.preventDefault();

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

    overlay.addEventListener('mousedown', (event) => {
        if (event.target === overlay) {
            close();
        }
    });

    document.body.appendChild(overlay);
    document.body.classList.add('scroll-lock');
    document.addEventListener('keydown', onKeydown);

    return { close, overlay };
}

function dialogPanel({ className, title, bodyHtml, footerHtml }) {
    const panel = document.createElement('div');
    const titleId = `dialog-title-${Math.random().toString(36).slice(2, 9)}`;

    panel.className = className;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', titleId);
    panel.innerHTML = `
        <div class="modal__header">
            <h2 class="modal__title" id="${titleId}"></h2>
            <button type="button" class="modal__close" aria-label="${t('common.close')}">${icon('x', { size: 20 })}</button>
        </div>
        <div class="modal__body"></div>
        ${footerHtml ? `<div class="modal__footer">${footerHtml}</div>` : ''}
    `;
    panel.querySelector('.modal__title').textContent = title;
    panel.querySelector('.modal__body').innerHTML = bodyHtml;

    return panel;
}

/** Focus the first field in the body, else the close button. */
function focusFirst(panel) {
    const target =
        panel.querySelector(`.modal__body :is(${FOCUSABLE})`) ||
        panel.querySelector('.modal__close');

    target?.focus();
}

/**
 * Centered dialog: title, body, optional footer (buttons go there, the
 * footer strip is tinted). `wide` for 720px content like log details.
 * Returns `{ close, modal, overlay }`.
 */
export function openModal({
    title = '',
    bodyHtml = '',
    footerHtml = '',
    wide = false,
    onClose,
} = {}) {
    const modal = dialogPanel({
        className: `modal${wide ? ' modal--wide' : ''}`,
        title,
        bodyHtml,
        footerHtml,
    });

    const { close, overlay } = openOverlay(modal, { onClose });

    modal.querySelector('.modal__close').addEventListener('click', close);
    focusFirst(modal);

    return { close, modal, overlay };
}

/**
 * Right-hand side panel (filters, quick details) — same API as
 * openModal(). Returns `{ close, drawer, overlay }`.
 */
export function openDrawer({
    title = '',
    bodyHtml = '',
    footerHtml = '',
    onClose,
} = {}) {
    const drawer = dialogPanel({
        className: 'drawer',
        title,
        bodyHtml,
        footerHtml,
    });

    const { close, overlay } = openOverlay(drawer, { onClose, drawer: true });

    drawer.querySelector('.modal__close').addEventListener('click', close);
    focusFirst(drawer);

    return { close, drawer, overlay };
}
