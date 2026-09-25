import { api } from '../axios';
import { bootstrapAppState } from '../shared/app-state';
import { escapeHtml } from '../shared/forms';
import {
    formatNumber,
    getLocale,
    hasLocaleData,
    monthName,
    t,
} from '../shared/i18n';
import { icon } from '../shared/icon';
import { openModal } from '../shared/modal';
import { bootOnPage } from '../shared/page-boot';
import { errorState, skeletonList } from '../shared/skeleton';
import { apiErrorMessage, showToast } from '../shared/toast';
import {
    getUserSettings,
    invalidateUserSettings,
} from '../shared/user-settings-cache';

/**
 * The currencies people here actually deal in, in the order the
 * "Popular" view lists them. Anything not in the catalogue is skipped.
 */
const POPULAR = ['USD', 'EUR', 'RUB', 'CNY', 'KZT', 'GBP', 'TRY', 'AED'];

/** How long the "Undo" on a changed currency stays offered. */
const UNDO_MS = 6000;

/** A change smaller than this (in %) counts as none. */
const FLAT = 0.005;

let currentCleanup = null;

/**
 * The previous calendar day, as the `?date=` the rate table takes.
 */
function dayBefore(isoDate) {
    const date = new Date(`${isoDate}T00:00:00Z`);

    date.setUTCDate(date.getUTCDate() - 1);

    return date.toISOString().slice(0, 10);
}

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

/**
 * Rates are stored as "units of X per 1 app currency", so the app
 * currency itself is always 1 and never has a row of its own.
 *
 * @returns {Map<string, {rate: number, date: string|null}>}
 */
function rateTable(rows, baseCode) {
    const table = new Map(
        rows.map((row) => [
            row.currency?.code,
            { rate: Number(row.rate), date: row.rate_date ?? null },
        ]),
    );

    if (baseCode) {
        table.set(baseCode, { rate: 1, date: null });
    }

    return table;
}

/**
 * The currency's name in the reader's language ("Доллар США",
 * "AQSH dollari"), falling back to the catalogue's English name.
 */
function localName(currency) {
    // A browser without the locale's data (Chrome and `uz`) answers in
    // some other language; the catalogue's own name reads better.
    if (!hasLocaleData()) {
        return currency.name;
    }

    try {
        const name = new Intl.DisplayNames([getLocale()], {
            type: 'currency',
        }).of(currency.code);

        if (name && name !== currency.code) {
            return (
                name.charAt(0).toLocaleUpperCase(getLocale()) + name.slice(1)
            );
        }
    } catch {
        // No DisplayNames for this locale — the catalogue name will do.
    }

    return currency.name;
}

/**
 * The short sign a currency is known by ("$", "€", "₽"), for the round
 * badge in front of each row. Long local symbols ("so‘m", "Lekë") would
 * not fit, so those fall back to the code.
 */
function badgeSymbol(currency) {
    try {
        const symbol = new Intl.NumberFormat(getLocale(), {
            style: 'currency',
            currency: currency.code,
            currencyDisplay: 'narrowSymbol',
        })
            .formatToParts(0)
            .find((part) => part.type === 'currency')?.value;

        if (symbol && symbol !== currency.code && [...symbol].length <= 2) {
            return symbol;
        }
    } catch {
        // Not a code Intl knows.
    }

    return currency.code.slice(0, 3);
}

/**
 * Two decimals for anything worth a unit or more (12 705,40), enough
 * significant digits for the rest (0,0787).
 */
function formatRate(value) {
    return value >= 1
        ? formatNumber(value, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
          })
        : formatNumber(value, {
              minimumSignificantDigits: 3,
              maximumSignificantDigits: 4,
          });
}

function formatPercent(change) {
    const sign = Math.abs(change) < FLAT ? '' : change > 0 ? '+' : '−';

    return `${sign}${formatNumber(Math.abs(change), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}%`;
}

function formatDay(isoDate) {
    if (!hasLocaleData()) {
        const date = new Date(`${isoDate}T00:00:00Z`);

        return `${date.getUTCDate()} ${monthName(date.getUTCMonth()).toLocaleLowerCase(getLocale())}`;
    }

    try {
        return new Intl.DateTimeFormat(getLocale(), {
            day: 'numeric',
            month: 'long',
            timeZone: 'UTC',
        }).format(new Date(`${isoDate}T00:00:00Z`));
    } catch {
        return isoDate;
    }
}

function direction(change) {
    if (change === null) {
        return 'none';
    }

    if (change > FLAT) {
        return 'up';
    }

    return change < -FLAT ? 'down' : 'flat';
}

/**
 * Everything used to run once at module top level; under Turbo Drive the
 * page's DOM is replaced on every visit while this module is evaluated
 * once, so it is wrapped in `boot()` and re-run via `bootOnPage` on every
 * `turbo:load` that lands here (see notifications.js for the same shape).
 */
function boot() {
    const controller = new AbortController();
    const { signal } = controller;

    const page = document.querySelector('[data-currency-page]');
    const list = page.querySelector('[data-currency-list]');
    const search = page.querySelector('[data-currency-search]');
    const select = page.querySelector('[data-currency-select]');
    const current = page.querySelector('[data-currency-current]');
    const asOfLabel = page.querySelector('[data-currency-stale]');
    const converter = page.querySelector('[data-currency-convert]');
    const filters = page.querySelector('[data-currency-filters]');
    const sortHead = page.querySelector('[data-currency-sort]');
    const rateHead = page.querySelector('[data-currency-rate-head]');

    let active = true;
    let currencies = [];
    let baseCode = null;
    let asOf = null;
    let previousDate = null;
    let preferredId = null;
    let today = new Map();
    let previous = new Map();

    const view = {
        query: '',
        filter: 'popular',
        sort: 'name',
        descending: false,
        amount: '100',
        convertCode: null,
        swapped: false,
    };

    function byCode(code) {
        return currencies.find((currency) => currency.code === code);
    }

    /** The currency every rate on the page is quoted in. */
    function quoteCode() {
        return (
            currencies.find(
                (currency) => String(currency.id) === String(preferredId),
            )?.code ?? baseCode
        );
    }

    /** What one unit of `code` is worth in `quote`, from one rate table. */
    function crossRate(table, code, quote) {
        const from = table.get(code)?.rate;
        const to = table.get(quote)?.rate;

        return from && to ? to / from : null;
    }

    /**
     * One currency against the quote currency: today's rate, its inverse
     * and the change since the previous table. The change is only given
     * when the currency really has a newer rate than that table — one
     * the provider has not updated would otherwise always read "0.00%".
     */
    function quoteOf(currency) {
        const quote = quoteCode();
        const rate = crossRate(today, currency.code, quote);
        const before = crossRate(previous, currency.code, quote);
        const nowDate = today.get(currency.code)?.date;
        const beforeDate = previous.get(currency.code)?.date;
        const comparable =
            currency.code !== quote &&
            rate &&
            before &&
            !(nowDate && beforeDate && nowDate <= beforeDate);

        return {
            rate,
            inverse: rate ? 1 / rate : null,
            change: comparable ? (rate / before - 1) * 100 : null,
            delta: comparable ? rate - before : null,
        };
    }

    /*
    |------------------------------------------------------------------
    | The line under the title: your currency and the rates' date
    |------------------------------------------------------------------
    */

    function renderSwitch() {
        const quote = quoteCode();
        const yours = byCode(quote);

        current.textContent = yours
            ? `${quote} · ${localName(yours)}`
            : quote || '—';

        const options = [...currencies]
            .filter(
                (currency) =>
                    currency.code === baseCode ||
                    crossRate(today, currency.code, baseCode),
            )
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((currency) => {
                const label =
                    currency.code === baseCode
                        ? t('currencies.app_currency_option', {
                              code: currency.code,
                          })
                        : `${currency.code} — ${localName(currency)}`;

                return `<option value="${currency.id}"${currency.code === quote ? ' selected' : ''}>${escapeHtml(label)}</option>`;
            });

        select.innerHTML = options.join('');
        select.disabled = false;
    }

    function renderAsOf() {
        const isStale = !asOf || asOf < todayIso();

        asOfLabel.classList.toggle('currency-hero__asof--stale', isStale);
        asOfLabel.textContent = asOf
            ? t('currencies.rates_from', { date: formatDay(asOf) })
            : t('currencies.no_rates');
        asOfLabel.title =
            isStale && asOf && previousDate
                ? t('currencies.stale_text', { date: formatDay(previousDate) })
                : '';
    }

    /*
    |------------------------------------------------------------------
    | Converter
    |------------------------------------------------------------------
    */

    /** The currencies the converter can convert from, A–Z by code. */
    function convertibleCodes() {
        const quote = quoteCode();

        return currencies
            .filter(
                (currency) =>
                    currency.code !== quote &&
                    crossRate(today, currency.code, quote),
            )
            .map((currency) => currency.code)
            .sort();
    }

    function convertCode() {
        const codes = convertibleCodes();

        if (codes.includes(view.convertCode)) {
            return view.convertCode;
        }

        return ['USD', 'EUR'].find((code) => codes.includes(code)) ?? codes[0];
    }

    function renderConverter() {
        const quote = quoteCode();
        const code = convertCode();

        if (!code) {
            converter.hidden = true;

            return;
        }

        const picker = `
            <select class="currency-convert__code" aria-label="${escapeHtml(t('currencies.other_currency'))}" data-convert-code>
                ${convertibleCodes()
                    .map(
                        (option) =>
                            `<option value="${escapeHtml(option)}"${option === code ? ' selected' : ''}>${escapeHtml(option)}</option>`,
                    )
                    .join('')}
            </select>
        `;
        const fixed = `<span class="currency-convert__code currency-convert__code--fixed">${escapeHtml(quote)}</span>`;

        converter.hidden = false;
        converter.innerHTML = `
            <label class="currency-convert__input">
                <input type="text" inputmode="decimal" autocomplete="off" value="${escapeHtml(view.amount)}" aria-label="${escapeHtml(t('currencies.amount_label'))}" data-convert-amount>
                ${view.swapped ? fixed : picker}
            </label>
            <button type="button" class="currency-convert__swap" aria-label="${escapeHtml(t('currencies.swap'))}" data-convert-swap>${icon('arrow', { size: 16 })}</button>
            <div class="currency-convert__result">
                <strong data-convert-result></strong>
                ${view.swapped ? picker : ''}
            </div>
            <span class="currency-convert__rate" data-convert-rate></span>
        `;

        updateConversion();
    }

    /** Only the result changes while typing, so the field keeps its focus. */
    function updateConversion() {
        const result = converter.querySelector('[data-convert-result]');
        const rateLine = converter.querySelector('[data-convert-rate]');
        const code = convertCode();
        const quote = quoteCode();
        const rate = code ? crossRate(today, code, quote) : null;

        if (!result || !rate) {
            return;
        }

        const amount =
            Number(String(view.amount).replace(/\s/g, '').replace(',', '.')) ||
            0;

        result.textContent = view.swapped
            ? formatRate(amount / rate)
            : `${formatRate(amount * rate)} ${quote}`;
        rateLine.textContent = t('currencies.rate', {
            from: code,
            amount: formatRate(rate),
            to: quote,
        });
    }

    /*
    |------------------------------------------------------------------
    | The list
    |------------------------------------------------------------------
    */

    function matchesQuery(currency, query) {
        return (
            currency.code.toLowerCase().includes(query) ||
            currency.name.toLowerCase().includes(query) ||
            localName(currency).toLocaleLowerCase(getLocale()).includes(query)
        );
    }

    /** What the list shows: a search looks through every currency. */
    function visibleCurrencies() {
        const quote = quoteCode();
        const query = view.query.trim().toLocaleLowerCase(getLocale());
        const others = currencies.filter((currency) => currency.code !== quote);

        if (query) {
            return others.filter((currency) => matchesQuery(currency, query));
        }

        if (view.filter === 'popular') {
            return POPULAR.map(byCode).filter(
                (currency) => currency && currency.code !== quote,
            );
        }

        if (view.filter === 'up' || view.filter === 'down') {
            return others.filter(
                (currency) =>
                    direction(quoteOf(currency).change) === view.filter,
            );
        }

        return others;
    }

    function sorted(items) {
        // Popular keeps its own order until a column is sorted on purpose.
        if (view.filter === 'popular' && !view.query && view.sort === 'name') {
            return items;
        }

        const value = {
            name: (currency) => localName(currency),
            rate: (currency) => quoteOf(currency).rate ?? -Infinity,
            change: (currency) => quoteOf(currency).change ?? -Infinity,
        }[view.sort];

        const ordered = [...items].sort((a, b) => {
            const x = value(a);
            const y = value(b);

            return typeof x === 'string'
                ? x.localeCompare(y, getLocale())
                : x - y;
        });

        return view.descending ? ordered.reverse() : ordered;
    }

    function renderSortHead() {
        rateHead.textContent = t('currencies.col_rate', { code: quoteCode() });

        sortHead.querySelectorAll('[data-sort]').forEach((button) => {
            const isActive = button.dataset.sort === view.sort;

            button.setAttribute(
                'aria-sort',
                isActive
                    ? view.descending
                        ? 'descending'
                        : 'ascending'
                    : 'none',
            );
            button.classList.toggle('is-sorted', isActive);
        });
    }

    function renderFilters() {
        filters.querySelectorAll('[data-filter]').forEach((button) => {
            button.setAttribute(
                'aria-pressed',
                String(
                    !view.query.trim() && button.dataset.filter === view.filter,
                ),
            );
        });
    }

    function rowHtml(currency) {
        const quote = quoteCode();
        const quoted = quoteOf(currency);
        const trend = direction(quoted.change);
        const change =
            trend === 'none'
                ? '—'
                : `${trend === 'flat' ? '' : icon('arrow', { size: 12, className: `currency-trend__arrow currency-trend__arrow--${trend}` })}${formatPercent(quoted.change)}`;

        return `
            <button type="button" class="currency-row" data-currency-open="${escapeHtml(currency.code)}">
                <span class="currency-badge" aria-hidden="true">${escapeHtml(badgeSymbol(currency))}</span>
                <span class="currency-row__id">
                    <span class="currency-row__name">${escapeHtml(localName(currency))}</span>
                    <span class="currency-row__code">${escapeHtml(currency.code)}${quoted.inverse ? `<span class="currency-row__inverse"> · ${escapeHtml(t('currencies.rate', { from: quote, amount: formatRate(quoted.inverse), to: currency.code }))}</span>` : ''}</span>
                </span>
                <span class="currency-row__rate">${quoted.rate ? formatRate(quoted.rate) : `<span class="currency-row__none">${t('currencies.no_rate')}</span>`}</span>
                <span class="currency-trend currency-trend--${trend}" title="${escapeHtml(t('currencies.change_hint'))}">${change}</span>
            </button>
        `;
    }

    function renderList() {
        const items = sorted(visibleCurrencies());

        renderFilters();
        renderSortHead();

        list.setAttribute('aria-busy', 'false');
        list.innerHTML = items.length
            ? items.map(rowHtml).join('')
            : `
                <div class="currency-list__empty">
                    <strong>${t('currencies.empty_title')}</strong>
                    <span>${t('currencies.empty_hint')}</span>
                    <button type="button" class="btn btn--ghost btn--sm" data-currency-clear>${t('currencies.reset_search')}</button>
                </div>
            `;
    }

    function render() {
        renderSwitch();
        renderAsOf();
        renderConverter();
        renderList();
    }

    /*
    |------------------------------------------------------------------
    | Details (a bottom sheet on phones) — where a currency is made yours
    |------------------------------------------------------------------
    */

    function openDetails(code) {
        const currency = byCode(code);

        if (!currency) {
            return;
        }

        const quote = quoteCode();
        const quoted = quoteOf(currency);
        const trend = direction(quoted.change);
        const change =
            quoted.change === null
                ? '—'
                : `${formatPercent(quoted.change)} · ${quoted.delta > 0 ? '+' : quoted.delta < 0 ? '−' : ''}${formatRate(Math.abs(quoted.delta))} ${quote}`;

        const { close, modal } = openModal({
            title: localName(currency),
            bodyHtml: `
                <div class="currency-sheet">
                    <div class="currency-sheet__id">
                        <span class="currency-badge currency-badge--lg" aria-hidden="true">${escapeHtml(badgeSymbol(currency))}</span>
                        <span class="currency-sheet__code">${escapeHtml(code)}</span>
                    </div>
                    <dl class="currency-sheet__stats">
                        <div>
                            <dt>1 ${escapeHtml(code)}</dt>
                            <dd>${quoted.rate ? formatRate(quoted.rate) : '—'} <small>${escapeHtml(quote)}</small></dd>
                        </div>
                        <div>
                            <dt>1 ${escapeHtml(quote)}</dt>
                            <dd>${quoted.inverse ? formatRate(quoted.inverse) : '—'} <small>${escapeHtml(code)}</small></dd>
                        </div>
                        <div>
                            <dt>${t('currencies.col_change')}</dt>
                            <dd class="currency-trend currency-trend--${trend}">${escapeHtml(change)}</dd>
                        </div>
                    </dl>
                </div>
            `,
            footerHtml: `<button type="button" class="btn btn--primary btn--block" data-sheet-pick ${quoted.rate ? '' : 'disabled'}>${escapeHtml(t('currencies.set_label', { code }))}</button>`,
        });

        modal.classList.add('currency-sheet-modal');
        modal
            .querySelector('[data-sheet-pick]')
            ?.addEventListener('click', () => {
                close();
                choose(currency.id);
            });
    }

    /*
    |------------------------------------------------------------------
    | Loading and saving
    |------------------------------------------------------------------
    */

    function showError() {
        page.dataset.state = 'error';
        list.setAttribute('aria-busy', 'false');
        list.innerHTML = errorState(t('currencies.load_error'), {
            hint: t('currencies.load_error_hint'),
        });
    }

    async function load() {
        page.dataset.state = 'loading';
        list.setAttribute('aria-busy', 'true');
        list.innerHTML = skeletonList(6);

        try {
            const [currencyResponse, rateResponse, settings] =
                await Promise.all([
                    api.get('/currencies'),
                    api.get('/exchange-rates'),
                    getUserSettings(api),
                    bootstrapAppState(),
                ]);

            currencies = currencyResponse.data.data || [];
            baseCode =
                currencyResponse.data.base_code ?? rateResponse.data.base_code;
            asOf = rateResponse.data.as_of ?? null;
            preferredId = settings?.currency?.id ?? null;
            today = rateTable(rateResponse.data.data || [], baseCode);
            previous = new Map();
            previousDate = asOf ? dayBefore(asOf) : null;

            if (previousDate) {
                try {
                    const { data } = await api.get('/exchange-rates', {
                        params: { date: previousDate },
                    });

                    previous = rateTable(data.data || [], baseCode);
                } catch {
                    // Without the previous table the change column reads "—".
                }
            }
        } catch {
            if (active) {
                showError();
            }

            return;
        }

        if (active) {
            page.dataset.state = 'ready';
            render();
        }
    }

    /**
     * Saves the currency the page quotes in. The app currency is saved as
     * `null`, so the user follows it if an administrator changes it.
     * Offers an undo unless this save is the undo.
     */
    async function choose(id, { isUndo = false } = {}) {
        const before = preferredId;
        const chosen = currencies.find((currency) => currency.id === id);
        const value = chosen?.code === baseCode ? null : id;

        try {
            const { data } = await api.put('/profile/settings', {
                preferred_currency_id: value,
            });

            invalidateUserSettings();
            preferredId = data.data?.currency?.id ?? value;
        } catch (error) {
            showToast(
                apiErrorMessage(error, t('currencies.save_error')),
                'error',
            );
            renderSwitch();

            return;
        }

        if (!active) {
            return;
        }

        render();

        if (!isUndo) {
            showToast(
                t('currencies.saved', { code: chosen?.code ?? baseCode }),
                'success',
                {
                    duration: UNDO_MS,
                    action: {
                        label: t('currencies.undo'),
                        onClick: () => choose(before, { isUndo: true }),
                    },
                },
            );
        }
    }

    /*
    |------------------------------------------------------------------
    | Events
    |------------------------------------------------------------------
    */

    page.addEventListener(
        'click',
        (event) => {
            const target = event.target;
            const open = target.closest('[data-currency-open]');

            if (open) {
                openDetails(open.dataset.currencyOpen);

                return;
            }

            const filter = target.closest('[data-filter]');

            if (filter) {
                view.filter = filter.dataset.filter;
                view.query = '';
                search.value = '';
                renderList();

                return;
            }

            const sort = target.closest('[data-sort]');

            if (sort) {
                view.descending =
                    view.sort === sort.dataset.sort ? !view.descending : false;
                view.sort = sort.dataset.sort;
                renderList();

                return;
            }

            if (target.closest('[data-currency-clear]')) {
                view.query = '';
                search.value = '';
                renderList();
            } else if (target.closest('[data-convert-swap]')) {
                view.swapped = !view.swapped;
                renderConverter();
            } else if (target.closest('[data-retry]')) {
                load();
            }
        },
        { signal },
    );

    page.addEventListener(
        'input',
        (event) => {
            if (event.target.matches('[data-convert-amount]')) {
                view.amount = event.target.value;
                updateConversion();
            }
        },
        { signal },
    );

    page.addEventListener(
        'change',
        (event) => {
            if (event.target.matches('[data-convert-code]')) {
                view.convertCode = event.target.value;
                updateConversion();
            }
        },
        { signal },
    );

    select.addEventListener('change', () => choose(Number(select.value)), {
        signal,
    });

    search.addEventListener(
        'input',
        () => {
            view.query = search.value;
            renderList();
        },
        { signal },
    );

    load();

    currentCleanup = () => {
        active = false;
        controller.abort();
    };
}

function teardown() {
    currentCleanup?.();
    currentCleanup = null;
}

bootOnPage('[data-currency-page]', boot, teardown);
