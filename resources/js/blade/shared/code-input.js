/**
 * A 6-digit verification code entry, shared by every place this app asks
 * for one (login 2FA, passwordless login, email verification-by-code) so
 * there is exactly one implementation of auto-focus/paste/backspace
 * navigation instead of three copies. Each box is a real single-character
 * `<input>` (not one text field) per the UX spec; a hidden `<input
 * name="code">` inside the same container is kept in sync so the
 * existing `serializeForm()` (FormData-based) picks it up like any other
 * field.
 *
 * Markup contract (see auth partials):
 * <div data-code-input>
 *   <input data-code-box> x6
 *   <input type="hidden" name="code" data-code-value>
 * </div>
 */

function boxes(container) {
    return Array.from(container.querySelectorAll('[data-code-box]'));
}

function syncValue(container) {
    const value = boxes(container)
        .map((box) => box.value)
        .join('');

    const hidden = container.querySelector('[data-code-value]');

    if (hidden) {
        hidden.value = value;
    }

    return value;
}

/**
 * @param {HTMLElement} container
 * @param {(code: string) => void} [onComplete] called once when all 6 boxes are filled
 */
export function initCodeInput(container, onComplete) {
    const inputs = boxes(container);

    inputs.forEach((box, index) => {
        box.addEventListener('input', () => {
            box.value = box.value.replace(/\D/g, '').slice(-1);

            const value = syncValue(container);

            if (box.value && inputs[index + 1]) {
                inputs[index + 1].focus();
            }

            if (value.length === inputs.length && onComplete) {
                onComplete(value);
            }
        });

        box.addEventListener('keydown', (event) => {
            if (event.key === 'Backspace' && !box.value && inputs[index - 1]) {
                inputs[index - 1].focus();
            }
        });

        box.addEventListener('paste', (event) => {
            const pasted = (event.clipboardData?.getData('text') || '').replace(
                /\D/g,
                '',
            );

            if (!pasted) {
                return;
            }

            event.preventDefault();

            inputs.forEach((target, targetIndex) => {
                target.value = pasted[targetIndex] || '';
            });

            const value = syncValue(container);
            const next = inputs[Math.min(pasted.length, inputs.length) - 1];

            next?.focus();

            if (value.length === inputs.length && onComplete) {
                onComplete(value);
            }
        });
    });
}

export function focusCodeInput(container) {
    boxes(container)[0]?.focus();
}

export function resetCodeInput(container) {
    boxes(container).forEach((box) => {
        box.value = '';
    });

    syncValue(container);
    focusCodeInput(container);
}

export function getCodeValue(container) {
    return syncValue(container);
}

/**
 * Disables `button` and counts down from `seconds`, showing the
 * remaining time in its text via `labelWhenCounting(secondsLeft)`, then
 * restores `labelWhenReady` and re-enables it.
 */
export function startResendCountdown(
    button,
    seconds,
    labelWhenCounting,
    labelWhenReady,
) {
    if (!button) {
        return;
    }

    let remaining = seconds;
    button.disabled = true;
    button.textContent = labelWhenCounting(remaining);

    const timer = window.setInterval(() => {
        remaining -= 1;

        if (remaining <= 0) {
            window.clearInterval(timer);
            button.disabled = false;
            button.textContent = labelWhenReady;

            return;
        }

        button.textContent = labelWhenCounting(remaining);
    }, 1000);
}
