import { t } from './i18n';
import { icon } from './icon';

/**
 * Date, date-range and time fields (<x-blade.u-i.date-input>,
 * <x-blade.u-i.time-input>). Each field posts ISO values from hidden
 * inputs (`Y-m-d`, `HH:MM`) and shows them in the page locale's own
 * numeric format, so typing "23.09.2026" in Russian or "09/23/2026" in
 * English both work. Instances are created lazily on first interaction
 * through delegated listeners, so markup rendered later (Turbo, JS
 * templates) needs no setup call.
 *
 *   [data-date-picker]                    single date
 *   [data-date-picker][data-mode=range]   start → end, with [data-presets]
 *   [data-time-picker]                    HH:MM with a slot list
 */

const instances = new WeakMap();

function locale() {
    return (
        window.__i18n?.locale ||
        document.documentElement.lang ||
        'en'
    ).replace('_', '-');
}

/* ---------------------------------------------------------------------
 | Dates as plain local days (no time zone drift)
 * ------------------------------------------------------------------- */

function toIso(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    return `${y}-${m}-${d}`;
}

function fromIso(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');

    if (!match) {
        return null;
    }

    return makeDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** A real calendar day, or null — so 31.02 is rejected, not rolled into March. */
function makeDate(year, month, day) {
    const date = new Date(year, month - 1, day);

    return date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
        ? date
        : null;
}

function sameDay(a, b) {
    return Boolean(a && b) && toIso(a) === toIso(b);
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);

    return next;
}

function today() {
    const now = new Date();

    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Monday-based start of the week, matching the calendar grid. */
function startOfWeek(date) {
    return addDays(date, -((date.getDay() + 6) % 7));
}

/* ---------------------------------------------------------------------
 | Locale formatting and parsing
 * ------------------------------------------------------------------- */

function numericFormat() {
    return new Intl.DateTimeFormat(locale(), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function formatDate(date) {
    return date ? numericFormat().format(date) : '';
}

/** Order of day/month/year in this locale, read from Intl itself. */
function partOrder() {
    return numericFormat()
        .formatToParts(new Date(2026, 10, 25))
        .filter((part) => ['day', 'month', 'year'].includes(part.type))
        .map((part) => part.type);
}

function parseDate(text) {
    const numbers = (text || '').trim().split(/\D+/).filter(Boolean);

    if (numbers.length !== 3) {
        return null;
    }

    const parts = {};

    partOrder().forEach((type, index) => {
        parts[type] = Number(numbers[index]);
    });

    if (parts.year < 100) {
        parts.year += 2000;
    }

    return makeDate(parts.year, parts.month, parts.day);
}

function placeholder() {
    const letters = { ru: ['ДД', 'ММ', 'ГГГГ'], uz: ['KK', 'OO', 'YYYY'] }[
        locale().slice(0, 2)
    ] || ['DD', 'MM', 'YYYY'];
    const map = { day: letters[0], month: letters[1], year: letters[2] };
    const separator =
        numericFormat()
            .formatToParts(new Date(2026, 10, 25))
            .find((part) => part.type === 'literal')?.value || '.';

    return partOrder()
        .map((type) => map[type])
        .join(separator);
}

function capitalize(text) {
    return text.charAt(0).toLocaleUpperCase(locale()) + text.slice(1);
}

function monthTitle(date) {
    const month = new Intl.DateTimeFormat(locale(), { month: 'long' }).format(
        date,
    );

    return `${capitalize(month)} ${date.getFullYear()}`;
}

function weekdayNames() {
    const formatter = new Intl.DateTimeFormat(locale(), { weekday: 'short' });
    const monday = new Date(2026, 8, 21);

    return Array.from({ length: 7 }, (_, index) =>
        capitalize(formatter.format(addDays(monday, index)).replace('.', '')),
    );
}

function longLabel(date) {
    return new Intl.DateTimeFormat(locale(), { dateStyle: 'long' }).format(
        date,
    );
}

/* ---------------------------------------------------------------------
 | Shared field helpers
 * ------------------------------------------------------------------- */

function setFieldError(root, message) {
    const error = root.querySelector('[data-field-error]');
    const control = root.querySelector(
        '[data-date-display], [data-time-display]',
    );

    if (message) {
        control?.setAttribute('aria-invalid', 'true');
    } else {
        control?.removeAttribute('aria-invalid');
    }

    if (error) {
        error.innerHTML = message
            ? icon('alert', { size: 14, className: 'field-error__icon' })
            : '';

        if (message) {
            error.append(message);
        }
    }
}

function emitChange(root, input) {
    input.dispatchEvent(new Event('change', { bubbles: true }));
    root.dispatchEvent(
        new CustomEvent('date-picker:change', { bubbles: true }),
    );
}

/* ---------------------------------------------------------------------
 | Date / range picker
 * ------------------------------------------------------------------- */

const PRESETS = [
    'today',
    'yesterday',
    'this_week',
    'last_week',
    'last_30_days',
    'this_month',
    'custom',
];

function presetRange(key) {
    const now = today();

    switch (key) {
        case 'today':
            return [now, now];
        case 'yesterday':
            return [addDays(now, -1), addDays(now, -1)];
        case 'this_week':
            return [startOfWeek(now), addDays(startOfWeek(now), 6)];
        case 'last_week':
            return [
                addDays(startOfWeek(now), -7),
                addDays(startOfWeek(now), -1),
            ];
        case 'last_30_days':
            return [addDays(now, -29), now];
        case 'this_month':
            return [
                new Date(now.getFullYear(), now.getMonth(), 1),
                new Date(now.getFullYear(), now.getMonth() + 1, 0),
            ];
        default:
            return null;
    }
}

function createDatePicker(root) {
    const range = root.dataset.mode === 'range';
    const display = root.querySelector('[data-date-display]');
    const popover = root.querySelector('[data-date-popover]');
    const valueInput = root.querySelector('[data-date-value]');
    const fromInput = root.querySelector('[data-date-from]');
    const toInput = root.querySelector('[data-date-to]');
    const min = fromIso(root.dataset.min);
    const max = fromIso(root.dataset.max);

    const state = {
        start: range ? fromIso(fromInput?.value) : fromIso(valueInput?.value),
        end: range ? fromIso(toInput?.value) : null,
        view: null,
        focus: null,
    };

    state.view = new Date(
        (state.start || today()).getFullYear(),
        (state.start || today()).getMonth(),
        1,
    );

    if (!range && display && !display.placeholder) {
        display.placeholder = placeholder();
    }

    function isDisabled(date) {
        return (min && date < min) || (max && date > max);
    }

    function paintDisplay() {
        if (range) {
            display.innerHTML =
                state.start && state.end
                    ? `<span>${formatDate(state.start)}</span><span class="date-range-value__arrow">${icon('arrow', { size: 16 })}</span><span>${formatDate(state.end)}</span>`
                    : `<span class="muted">${display.dataset.placeholder || t('components.choose_date')}</span>`;
        } else {
            display.value = formatDate(state.start);
        }
    }

    function commit() {
        if (range) {
            fromInput.value = state.start ? toIso(state.start) : '';
            toInput.value = state.end ? toIso(state.end) : '';
            emitChange(root, toInput);
        } else {
            valueInput.value = state.start ? toIso(state.start) : '';
            emitChange(root, valueInput);
        }

        setFieldError(root, '');
        paintDisplay();
    }

    function activePreset() {
        if (!state.start || !state.end) {
            return 'custom';
        }

        return (
            PRESETS.find((key) => {
                const preset = presetRange(key);

                return (
                    preset &&
                    sameDay(preset[0], state.start) &&
                    sameDay(preset[1], state.end)
                );
            }) || 'custom'
        );
    }

    function dayHtml(date) {
        const inMonth = date.getMonth() === state.view.getMonth();
        const selected = sameDay(date, state.start) || sameDay(date, state.end);
        const between =
            range &&
            state.start &&
            state.end &&
            date > state.start &&
            date < state.end;
        const classes = [
            'calendar__day',
            inMonth ? '' : 'calendar__day--outside',
            sameDay(date, today()) && !selected ? 'calendar__day--today' : '',
            between ? 'calendar__day--in-range' : '',
        ]
            .filter(Boolean)
            .join(' ');
        const focusable = sameDay(date, state.focus);

        return `<button type="button" class="${classes}" data-day="${toIso(date)}" aria-pressed="${selected}" aria-label="${longLabel(date)}" tabindex="${focusable ? 0 : -1}" ${isDisabled(date) ? 'disabled' : ''}>${date.getDate()}</button>`;
    }

    function render() {
        const first = startOfWeek(state.view);

        if (!state.focus || state.focus.getMonth() !== state.view.getMonth()) {
            state.focus =
                state.start && state.start.getMonth() === state.view.getMonth()
                    ? state.start
                    : new Date(state.view);
        }

        const days = Array.from({ length: 42 }, (_, index) =>
            addDays(first, index),
        );
        const presets = range && root.hasAttribute('data-presets');
        const current = presets ? activePreset() : null;

        popover.innerHTML = `
            <div class="date-picker">
                <div class="calendar" role="dialog" aria-label="${t('components.choose_date')}">
                    <div class="calendar__head">
                        <button type="button" class="calendar__nav" data-month="-1" aria-label="${t('components.prev_month')}">${icon('left', { size: 18 })}</button>
                        <span class="calendar__title" aria-live="polite">${monthTitle(state.view)}</span>
                        <button type="button" class="calendar__nav" data-month="1" aria-label="${t('components.next_month')}">${icon('chev', { size: 18 })}</button>
                    </div>
                    <div class="calendar__grid" role="grid">
                        ${weekdayNames()
                            .map(
                                (name) =>
                                    `<span class="calendar__weekday" aria-hidden="true">${name}</span>`,
                            )
                            .join('')}
                        ${days.map(dayHtml).join('')}
                    </div>
                    <div class="calendar__foot">
                        <button type="button" class="btn btn--ghost btn--sm" data-today>${t('components.today')}</button>
                        <button type="button" class="btn btn--primary btn--sm" data-done>${t('components.done')}</button>
                    </div>
                </div>
                ${
                    presets
                        ? `<div class="listbox listbox--flat date-picker__presets" role="listbox">
                        ${PRESETS.map(
                            (key) => `
                            <button type="button" class="listbox__option" role="option" data-preset="${key}" aria-selected="${key === current}">
                                <span class="listbox__text">${t(`components.preset_${key}`)}</span>
                                ${icon('check', { size: 16, className: 'listbox__check' })}
                            </button>`,
                        ).join('')}
                    </div>`
                        : ''
                }
            </div>
        `;
    }

    function focusDay() {
        popover.querySelector(`[data-day="${toIso(state.focus)}"]`)?.focus();
    }

    function open() {
        if (!popover.hidden) {
            return;
        }

        render();
        popover.hidden = false;
        display.setAttribute('aria-expanded', 'true');
        document.addEventListener('mousedown', onOutside);
    }

    function close({ restoreFocus = false } = {}) {
        if (popover.hidden) {
            return;
        }

        popover.hidden = true;
        display.setAttribute('aria-expanded', 'false');
        document.removeEventListener('mousedown', onOutside);

        if (restoreFocus) {
            display.focus();
        }
    }

    function onOutside(event) {
        if (!root.contains(event.target)) {
            close();
        }
    }

    function pick(date) {
        if (!range) {
            state.start = date;
            commit();
            close({ restoreFocus: true });

            return;
        }

        if (!state.start || state.end) {
            state.start = date;
            state.end = null;
        } else if (date < state.start) {
            state.end = state.start;
            state.start = date;
        } else {
            state.end = date;
        }

        state.focus = date;

        if (state.end) {
            commit();
        }

        render();
        focusDay();
    }

    popover.addEventListener('click', (event) => {
        const day = event.target.closest('[data-day]');
        const month = event.target.closest('[data-month]');
        const preset = event.target.closest('[data-preset]');

        if (day) {
            pick(fromIso(day.dataset.day));
        } else if (month) {
            state.view = new Date(
                state.view.getFullYear(),
                state.view.getMonth() + Number(month.dataset.month),
                1,
            );
            state.focus = null;
            render();
        } else if (event.target.closest('[data-today]')) {
            state.view = new Date(today().getFullYear(), today().getMonth(), 1);

            if (range) {
                state.start = today();
                state.end = today();
                commit();
                render();
            } else {
                pick(today());
            }
        } else if (event.target.closest('[data-done]')) {
            close({ restoreFocus: true });
        } else if (preset) {
            const dates = presetRange(preset.dataset.preset);

            if (dates) {
                [state.start, state.end] = dates;
                state.view = new Date(
                    dates[0].getFullYear(),
                    dates[0].getMonth(),
                    1,
                );
                state.focus = null;
                commit();
                render();
            } else {
                state.focus = null;
                render();
                focusDay();
            }
        }
    });

    popover.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            close({ restoreFocus: true });

            return;
        }

        if (!event.target.closest('[data-day]')) {
            return;
        }

        const moves = {
            ArrowLeft: -1,
            ArrowRight: 1,
            ArrowUp: -7,
            ArrowDown: 7,
        };

        if (event.key in moves) {
            event.preventDefault();
            state.focus = addDays(state.focus, moves[event.key]);
        } else if (event.key === 'PageUp' || event.key === 'PageDown') {
            event.preventDefault();
            state.focus = new Date(
                state.focus.getFullYear(),
                state.focus.getMonth() + (event.key === 'PageUp' ? -1 : 1),
                Math.min(state.focus.getDate(), 28),
            );
        } else {
            return;
        }

        if (
            state.focus.getMonth() !== state.view.getMonth() ||
            state.focus.getFullYear() !== state.view.getFullYear()
        ) {
            state.view = new Date(
                state.focus.getFullYear(),
                state.focus.getMonth(),
                1,
            );
        }

        const focus = state.focus;
        render();
        state.focus = focus;
        focusDay();
    });

    display.addEventListener('click', open);

    display.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            open();
            focusDay();
        } else if (event.key === 'Escape') {
            close();
        }
    });

    if (!range) {
        display.addEventListener('focus', open);

        // Typed dates are validated when the user leaves the field.
        display.addEventListener('change', () => {
            const text = display.value.trim();

            if (!text) {
                state.start = null;
                commit();

                return;
            }

            const date = parseDate(text);

            if (!date || isDisabled(date)) {
                setFieldError(root, t('components.invalid_date'));

                return;
            }

            state.start = date;
            state.view = new Date(date.getFullYear(), date.getMonth(), 1);
            commit();

            if (!popover.hidden) {
                render();
            }
        });

        root.addEventListener('focusout', (event) => {
            if (!root.contains(event.relatedTarget)) {
                close();
            }
        });
    }

    paintDisplay();

    return { open, close };
}

/* ---------------------------------------------------------------------
 | Time picker
 * ------------------------------------------------------------------- */

const TIME_PATTERN = /^([01]?\d|2[0-3]):?([0-5]\d)$/;

function createTimePicker(root) {
    const display = root.querySelector('[data-time-display]');
    const popover = root.querySelector('[data-time-popover]');
    const valueInput = root.querySelector('[data-time-value]');
    const step = Number(root.dataset.step) || 30;

    const slots = Array.from({ length: Math.floor(1440 / step) }, (_, i) => {
        const minutes = i * step;

        return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    });

    function commit(value) {
        valueInput.value = value;
        display.value = value;
        setFieldError(root, '');
        emitChange(root, valueInput);
    }

    function render() {
        popover.innerHTML = `
            <div class="listbox" role="listbox">
                ${slots
                    .map(
                        (slot) => `
                    <button type="button" class="listbox__option" role="option" tabindex="-1" data-slot="${slot}" aria-selected="${slot === valueInput.value}">
                        <span class="listbox__text">${slot}</span>
                        ${icon('check', { size: 16, className: 'listbox__check' })}
                    </button>`,
                    )
                    .join('')}
            </div>
        `;
    }

    /**
     * Brings the chosen slot (or the current hour) into the middle of the
     * list. Only the list scrolls — scrollIntoView() would move the page.
     */
    function scrollToCurrent() {
        const list = popover.querySelector('.listbox');
        const current =
            popover.querySelector('[aria-selected="true"]') ||
            popover.querySelector(
                `[data-slot^="${String(new Date().getHours()).padStart(2, '0')}"]`,
            );

        if (list && current) {
            list.scrollTop =
                current.offsetTop -
                list.clientHeight / 2 +
                current.offsetHeight / 2;
        }
    }

    function open() {
        if (!popover.hidden) {
            return;
        }

        render();
        popover.hidden = false;
        display.setAttribute('aria-expanded', 'true');
        scrollToCurrent();
    }

    function close() {
        popover.hidden = true;
        display.setAttribute('aria-expanded', 'false');
    }

    popover.addEventListener('mousedown', (event) => event.preventDefault());

    popover.addEventListener('click', (event) => {
        const slot = event.target.closest('[data-slot]');

        if (slot) {
            commit(slot.dataset.slot);
            close();
        }
    });

    display.addEventListener('focus', open);
    display.addEventListener('click', open);
    display.addEventListener('blur', close);

    display.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            close();
        }
    });

    display.addEventListener('change', () => {
        const text = display.value.trim();

        if (!text) {
            commit('');

            return;
        }

        const match = TIME_PATTERN.exec(text);

        if (!match) {
            setFieldError(root, t('components.invalid_time'));

            return;
        }

        commit(`${match[1].padStart(2, '0')}:${match[2]}`);
    });

    return { open, close };
}

/* ---------------------------------------------------------------------
 | Lazy, delegated setup
 * ------------------------------------------------------------------- */

function instanceFor(target) {
    const root = target.closest?.('[data-date-picker], [data-time-picker]');

    if (!root) {
        return null;
    }

    if (!instances.has(root)) {
        instances.set(
            root,
            root.hasAttribute('data-time-picker')
                ? createTimePicker(root)
                : createDatePicker(root),
        );
    }

    return instances.get(root);
}

let initialized = false;

export function initDatePickers() {
    if (initialized) {
        return;
    }

    initialized = true;

    // Capture phase: the instance must exist before the element's own
    // focus/click listeners (added by the instance) would have fired.
    const boot = (event) => {
        const control = event.target.closest?.(
            '[data-date-display], [data-time-display]',
        );

        if (
            control &&
            !instances.has(
                control.closest('[data-date-picker], [data-time-picker]'),
            )
        ) {
            instanceFor(control)?.open();
        }
    };

    document.addEventListener('focusin', boot, true);
    document.addEventListener('click', boot, true);

    // The server renders ISO values only; each field paints its own
    // locale-formatted text once the page (or a Turbo visit) loads.
    const paint = () =>
        document
            .querySelectorAll('[data-date-picker]')
            .forEach((root) => instanceFor(root));

    document.addEventListener('turbo:load', paint);
    paint();
}
