import { t } from './i18n';
import { icon as renderIcon } from './icon';

const ICONS = {
    success: 'check',
    error: 'alert',
    warning: 'clock',
    info: 'info',
};

const AUTO_DISMISS_MS = 5000;

/**
 * Renders a toast into the shared `#toast-stack` container (present in
 * every layout): bottom-right, auto-dismissed after `duration`, paused
 * while hovered or focused, with a bar along the bottom showing the time
 * left.
 *
 * showToast('Saved')                                   — one line
 * showToast('Check your connection', 'error', {
 *     title: 'Could not send',
 *     action: { label: 'Retry', onClick: resend },
 * })
 *
 * Returns a function that dismisses the toast early.
 */
export function showToast(
    message,
    type = 'success',
    { title = '', action = null, duration = AUTO_DISMISS_MS } = {},
) {
    const stack = document.getElementById('toast-stack');

    if (!stack || (!message && !title)) {
        return () => {};
    }

    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.style.setProperty('--toast-duration', `${duration}ms`);

    const iconEl = document.createElement('span');
    iconEl.className = 'toast__icon';
    iconEl.innerHTML = renderIcon(ICONS[type] || ICONS.info, { size: 20 });

    const body = document.createElement('div');
    body.className = 'toast__body';

    if (title) {
        const titleEl = document.createElement('strong');
        titleEl.className = 'toast__title';
        titleEl.textContent = title;
        body.append(titleEl);
    }

    if (message) {
        const text = document.createElement('span');
        text.className = 'toast__text';
        text.textContent = message;
        body.append(text);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast__close';
    close.setAttribute('aria-label', t('common.close'));
    close.innerHTML = renderIcon('x', { size: 16 });

    const timerBar = document.createElement('span');
    timerBar.className = 'toast__timer';
    timerBar.setAttribute('aria-hidden', 'true');

    let remaining = duration;
    let startedAt = 0;
    let timer = null;

    const dismiss = () => {
        if (el.dataset.leaving) {
            return;
        }

        window.clearTimeout(timer);
        el.dataset.leaving = 'true';
        el.classList.add('toast--leaving');
        window.setTimeout(() => el.remove(), 180);
    };

    const start = () => {
        startedAt = Date.now();
        delete el.dataset.paused;
        timer = window.setTimeout(dismiss, remaining);
    };

    const stop = () => {
        if (!timer) {
            return;
        }

        window.clearTimeout(timer);
        timer = null;
        remaining = Math.max(0, remaining - (Date.now() - startedAt));
        el.dataset.paused = '';
    };

    if (action?.label) {
        const actionEl = document.createElement('button');
        actionEl.type = 'button';
        actionEl.className = 'toast__action';
        actionEl.textContent = action.label;
        actionEl.addEventListener('click', () => {
            action.onClick?.();
            dismiss();
        });
        body.append(actionEl);
    }

    el.append(iconEl, body, close, timerBar);
    stack.appendChild(el);

    close.addEventListener('click', dismiss);
    el.addEventListener('mouseenter', stop);
    el.addEventListener('mouseleave', start);
    el.addEventListener('focusin', stop);
    el.addEventListener('focusout', start);

    start();

    return dismiss;
}

export function toastSuccess(message, options) {
    return showToast(message, 'success', options);
}

export function toastError(message, options) {
    return showToast(message, 'error', options);
}

export function toastWarning(message, options) {
    return showToast(message, 'warning', options);
}

export function toastInfo(message, options) {
    return showToast(message, 'info', options);
}

export function apiErrorMessage(error, fallback) {
    return error?.response?.data?.message || fallback;
}
