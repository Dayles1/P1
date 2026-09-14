const ICONS = {
    success: '✓',
    error: '✕',
    warning: '!',
    info: 'i',
};

const AUTO_DISMISS_MS = 5000;

/**
 * Renders a toast into the shared `#toast-stack` container (present in
 * every layout). Supports success/error/warning/info, auto-dismiss, manual
 * close, and pauses its auto-dismiss timer while hovered/focused.
 */
export function showToast(message, type = 'success') {
    const stack = document.getElementById('toast-stack');

    if (!stack || !message) {
        return;
    }

    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const icon = document.createElement('span');
    icon.className = 'toast__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = ICONS[type] || ICONS.info;

    const body = document.createElement('div');
    body.className = 'toast__body';
    body.textContent = message;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast__close';
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = '&times;';

    el.append(icon, body, close);
    stack.appendChild(el);

    let timer = null;

    const dismiss = () => {
        if (el.dataset.leaving) {
            return;
        }

        el.dataset.leaving = 'true';
        el.classList.add('toast--leaving');
        window.setTimeout(() => el.remove(), 180);
    };

    const start = () => {
        timer = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    };

    const stop = () => {
        if (timer) {
            window.clearTimeout(timer);
            timer = null;
        }
    };

    close.addEventListener('click', dismiss);
    el.addEventListener('mouseenter', stop);
    el.addEventListener('mouseleave', start);
    el.addEventListener('focusin', stop);
    el.addEventListener('focusout', start);

    start();

    return dismiss;
}

export function toastSuccess(message) {
    return showToast(message, 'success');
}

export function toastError(message) {
    return showToast(message, 'error');
}

export function toastWarning(message) {
    return showToast(message, 'warning');
}

export function toastInfo(message) {
    return showToast(message, 'info');
}

export function apiErrorMessage(error, fallback) {
    return error?.response?.data?.message || fallback;
}
