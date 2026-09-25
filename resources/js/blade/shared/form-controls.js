import { t } from './i18n';
import { toastSuccess } from './toast';

/**
 * Behaviour for the form components (resources/views/components/blade/
 * u-i/*), all through delegated listeners on `document` so markup Turbo
 * swaps in later — or a page renders from JS — works without re-wiring:
 *
 *   [data-field-clear]        empties the input in the same .field-box
 *   [data-field-copy]         copies that input's value
 *   [data-password-reveal]    shows/hides that password
 *   [data-step="-1|1"]        number stepper buttons around an input
 *   [data-char-counter]       textarea whose [data-char-count] tracks length
 *   [data-strength-for="id"]  4-segment strength meter for a password field
 *   input[data-indeterminate] checkbox rendered in the mixed state
 *   [data-tabs]               role="tablist" — selection + arrow keys
 */

function boxInput(control) {
    return control.closest('.field-box')?.querySelector('.field-box__input');
}

function onClear(button) {
    const input = boxInput(button);

    if (!input) {
        return;
    }

    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
}

async function onCopy(button) {
    const input = boxInput(button);

    if (!input) {
        return;
    }

    try {
        await navigator.clipboard.writeText(input.value);
        toastSuccess(t('components.copied'));
    } catch {
        input.select();
    }
}

function onReveal(button) {
    const input = boxInput(button);

    if (!input) {
        return;
    }

    const reveal = input.type === 'password';

    input.type = reveal ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(reveal));
    button.setAttribute(
        'aria-label',
        t(reveal ? 'components.hide_password' : 'components.show_password'),
    );
}

function onStep(button) {
    const input = boxInput(button);

    if (!input) {
        return;
    }

    const step = Number(input.step) || 1;
    const min = input.min === '' ? -Infinity : Number(input.min);
    const max = input.max === '' ? Infinity : Number(input.max);
    const next =
        (Number(input.value) || 0) + step * Number(button.dataset.step);

    input.value = String(Math.min(max, Math.max(min, next)));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    syncStepper(input);
}

function syncStepper(input) {
    const box = input.closest('.field-box');

    box?.querySelectorAll('[data-step]').forEach((button) => {
        const value = Number(input.value) || 0;
        const edge = Number(button.dataset.step) < 0 ? input.min : input.max;

        button.disabled =
            edge !== '' &&
            (Number(button.dataset.step) < 0
                ? value <= Number(edge)
                : value >= Number(edge));
    });
}

function syncCounter(textarea) {
    const counter = textarea
        .closest('.field-group')
        ?.querySelector('[data-char-count]');

    if (!counter) {
        return;
    }

    const max = Number(textarea.getAttribute('maxlength')) || 0;
    const count = textarea.value.length;

    counter.textContent = max
        ? t('components.char_count', { count, max })
        : String(count);
    counter.toggleAttribute('data-over', max > 0 && count > max);
}

/**
 * A rough 0–4 score: length plus variety of character classes. It only
 * nudges the user — the server's password rules are the real check.
 */
export function passwordScore(value) {
    if (!value) {
        return 0;
    }

    const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) =>
        re.test(value),
    ).length;

    let score = value.length >= 8 ? 1 : 0;
    score += value.length >= 12 ? 1 : 0;
    score += Math.max(0, variety - 1);

    return Math.max(1, Math.min(4, score));
}

function syncStrength(input) {
    document
        .querySelectorAll(`[data-strength-for="${CSS.escape(input.id)}"]`)
        .forEach((meter) => {
            const level = passwordScore(input.value);
            const label = meter.querySelector('.strength__label');

            meter.dataset.level = String(level);
            meter.hidden = level === 0;

            if (label) {
                label.textContent = level
                    ? t(`components.strength_${level}`)
                    : '';
            }
        });
}

function selectTab(tab, { focus = false } = {}) {
    const list = tab.closest('[data-tabs]');

    list.querySelectorAll('[role="tab"]').forEach((other) => {
        const selected = other === tab;

        other.setAttribute('aria-selected', String(selected));
        other.tabIndex = selected ? 0 : -1;

        const panel = other.getAttribute('aria-controls');

        if (panel) {
            document
                .getElementById(panel)
                ?.toggleAttribute('hidden', !selected);
        }
    });

    if (focus) {
        tab.focus();
    }

    list.dispatchEvent(
        new CustomEvent('tabs:change', {
            bubbles: true,
            detail: { tab, value: tab.dataset.value ?? null },
        }),
    );
}

function onTabKeydown(event) {
    const tab = event.target.closest('[data-tabs] [role="tab"]');

    if (
        !tab ||
        !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
    ) {
        return;
    }

    const tabs = [
        ...tab.closest('[data-tabs]').querySelectorAll('[role="tab"]'),
    ];
    const index = tabs.indexOf(tab);
    const next = {
        ArrowLeft: tabs[(index - 1 + tabs.length) % tabs.length],
        ArrowRight: tabs[(index + 1) % tabs.length],
        Home: tabs[0],
        End: tabs[tabs.length - 1],
    }[event.key];

    event.preventDefault();

    // Link tabs (one route per tab) just move focus; the link navigates.
    if (next.tagName === 'A') {
        next.focus();
    } else {
        selectTab(next, { focus: true });
    }
}

/** Applies the state that has no HTML attribute (indeterminate) and initial counts. */
export function hydrateFormControls(root = document) {
    root.querySelectorAll('input[data-indeterminate]').forEach((input) => {
        input.indeterminate = true;
    });

    root.querySelectorAll('[data-char-counter]').forEach(syncCounter);

    root.querySelectorAll('.field-box [data-step]').forEach((button) => {
        const input = boxInput(button);

        if (input) {
            syncStepper(input);
        }
    });
}

let initialized = false;

export function initFormControls() {
    if (initialized) {
        return;
    }

    initialized = true;

    document.addEventListener('click', (event) => {
        const target = event.target.closest(
            '[data-field-clear], [data-field-copy], [data-password-reveal], [data-step], [data-tabs] button[role="tab"]',
        );

        if (!target) {
            return;
        }

        if (target.matches('[data-field-clear]')) {
            onClear(target);
        } else if (target.matches('[data-field-copy]')) {
            onCopy(target);
        } else if (target.matches('[data-password-reveal]')) {
            onReveal(target);
        } else if (target.matches('[data-step]')) {
            onStep(target);
        } else {
            selectTab(target);
        }
    });

    document.addEventListener('input', (event) => {
        const target = event.target;

        if (target.matches?.('[data-char-counter]')) {
            syncCounter(target);
        }

        if (
            target.id &&
            document.querySelector(
                `[data-strength-for="${CSS.escape(target.id)}"]`,
            )
        ) {
            syncStrength(target);
        }

        if (target.matches?.('.field-box__input[type="number"]')) {
            syncStepper(target);
        }
    });

    document.addEventListener('keydown', onTabKeydown);
    document.addEventListener('turbo:load', () => hydrateFormControls());
    hydrateFormControls();
}
