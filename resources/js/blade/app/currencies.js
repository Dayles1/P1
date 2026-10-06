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
import { emptyState, errorState, skeletonList } from '../shared/skeleton';
import { apiErrorMessage, showToast } from '../shared/toast';
import {
    getUserSettings,
    invalidateUserSettings,
} from '../shared/user-settings-cache';

/**
 * The currencies people here actually deal in, in the order they are
 * listed under "Popular". Anything not in the catalogue is skipped.
 */
const POPULAR = ['USD', 'EUR', 'RUB', 'CNY', 'KZT', 'GBP', 'TRY', 'AED'];

/** Rows of the A–Z list shown at a time; "Show more" adds this many. */
const PAGE_SIZE = 20;

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
        const names = new Intl.DisplayNames([getLocale()], {
            type: 'currency',
        });
        const name = names.of(currency.code);

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

function sign(value) {
    if (Math.abs(value) < FLAT) {
        return '';
    }

    return value > 0 ? '+' : '−';
}

function formatPercent(change) {
    return `${sign(change)}${formatNumber(Math.abs(change), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}%`;
}

function formatDay(isoDate) {
    // Without the locale's data Intl prints "M09" for the month.
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
    const sortSelect = page.querySelector('[data-currency-sort]');
    const summary = page.querySelector('[data-currency-summary]');
    const stale = page.querySelector('[data-currency-stale]');
    const baseCard = page.querySelector('[data-currency-base]');
    const convertCard = page.querySelector('[data-currency-convert]');
    const filters = page.querySelector('[data-currency-filters]');
    const rateHead = page.querySelector('[data-currency-rate-head]');
    const foot = page.querySelector('[data-currency-foot]');
    const shown = page.querySelector('[data-currency-shown]');
    const more = page.querySelector('[data-currency-more]');

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
        filter: 'all',
        sort: 'name',
        limit: PAGE_SIZE,
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
     * One currency against the quote currency: today's rate, the one
     * before, and the change between them. The change is only given when
     * the currency really has a newer rate than the previous table — one
     * the provider has not updated would otherwise always read "0.00%".
     */
    function quoteOf(currency) {
        const quote = quoteCode();
        const rate = crossRate(today, currency.code, quote);
        const before = crossRate(previous, currency.code, quote);
        const nowDate = today.get(currency.code)?.date;
        const beforeDate = previous.get(currency.code)?.date;
        const comparable =
            currency.code === quote ||
            (rate &&
                before &&
                !(nowDate && beforeDate && nowDate <= beforeDate));

        return {
            rate,
            inverse: rate ? 1 / rate : null,
            change:
                currency.code === quote
                    ? null
                    : comparable
                      ? (rate / before - 1) * 100
                      : null,
            delta: comparable && currency.code !== quote ? rate - before : null,
        };
    }

    /*
    |------------------------------------------------------------------
    | Header, stale-rates notice, the user's currency, the converter
    |------------------------------------------------------------------
    */

    function renderSummary() {
        summary.textContent = t('currencies.summary', {
            count: currencies.length,
            code: quoteCode(),
        });
        rateHead.textContent = t('currencies.col_rate', { code: quoteCode() });
    }

    function renderStale() {
        const isStale = !asOf || asOf < todayIso();

        stale.hidden = !isStale;

        if (!isStale) {
            return;
        }

        const [title, text] = asOf
            ? [
                  t('currencies.stale_title', { date: formatDay(asOf) }),
                  previousDate
                      ? t('currencies.stale_text', {
                            date: formatDay(previousDate),
                        })
                      : '',
              ]
            : [t('currencies.no_rates'), ''];

        stale.innerHTML = `
            <span class="alert__icon">${icon('clock', { size: 20 })}</span>
            <div class="alert__content">
                <strong class="alert__title">${escapeHtml(title)}</strong>
                ${text ? `<span class="alert__text">${escapeHtml(text)}</span>` : ''}
            </div>
        `;
    }

    function renderBaseCard() {
        const quote = quoteCode();
        const currency = byCode(quote) ?? { code: quote, name: quote };
        const isAppCurrency = quote === baseCode;

        baseCard.innerHTML = `
            <div class="currency-card__head">
                <span class="currency-card__label" id="currency-base-title">${t('currencies.your_currency')}</span>
                <span class="pill pill--muted">${isAppCurrency ? t('currencies.origin_app') : t('currencies.origin_chosen')}</span>
            </div>
            <div class="currency-card__main">
                <span class="currency-code currency-code--lg currency-code--primary">${escapeHtml(quote)}</span>
                <div class="currency-card__text">
                    <span class="currency-card__name">${escapeHtml(localName(currency))}</span>
                    <span class="currency-card__hint">${t('currencies.base_hint')}</span>
                </div>
            </div>
            <div class="currency-card__foot">
                <span class="currency-card__asof">
                    ${icon('clock', { size: 15 })}
                    ${asOf ? escapeHtml(t('currencies.rates_from', { date: formatDay(asOf) })) : t('currencies.no_rates')}
                </span>
                ${
                    isAppCurrency
                        ? ''
                        : `<button type="button" class="btn btn--ghost btn--sm" data-currency-reset>${escapeHtml(t('currencies.reset', { code: baseCode }))}</button>`
                }
            </div>
        `;
    }

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
        const label = view.swapped
            ? t('currencies.convert_from_base', { code: quote })
            : t('currencies.convert_to_base', { code: quote });

        convertCard.innerHTML = `
            <span class="currency-card__label" id="currency-convert-title">${t('currencies.convert_title')}</span>
            ${
                code
                    ? `
                <div class="currency-convert__row">
                    <label class="currency-convert__field">
                        <span class="currency-convert__label">${escapeHtml(label)}</span>
                        <span class="field-box currency-convert__box">
                            <input class="field-box__input" type="text" inputmode="decimal" autocomplete="off" value="${escapeHtml(view.amount)}" data-convert-amount>
                            <select class="currency-convert__select" aria-label="${escapeHtml(t('currencies.other_currency'))}" data-convert-code>
                                ${convertibleCodes()
                                    .map(
                                        (option) =>
                                            `<option value="${escapeHtml(option)}"${option === code ? ' selected' : ''}>${escapeHtml(option)}</option>`,
                                    )
                                    .join('')}
                            </select>
                        </span>
                    </label>
                    <button type="button" class="btn btn--outline btn--icon" aria-label="${escapeHtml(t('currencies.swap'))}" data-convert-swap>${icon('swap', { size: 18 })}</button>
                </div>
                <div class="currency-convert__result">
                    <strong data-convert-result></strong>
                    <span data-convert-rate></span>
                </div>
            `
                    : `<p class="currency-card__hint">${t('currencies.no_rates')}</p>`
            }
        `;

        updateConversion();
    }

    /** Only the result changes while typing, so the field keeps its focus. */
    function updateConversion() {
        const result = convertCard.querySelector('[data-convert-result]');
        const rateLine = convertCard.querySelector('[data-convert-rate]');
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
            ? `${formatRate(amount / rate)} ${code}`
            : `${formatRate(amount * rate)} ${quote}`;
        rateLine.textContent = view.swapped
            ? t('currencies.rate', {
                  from: quote,
                  amount: formatRate(1 / rate),
                  to: code,
              })
            : t('currencies.rate', {
                  from: code,
                  amount: formatRate(rate),
                  to: quote,
              });
    }

    /*
    |------------------------------------------------------------------
    | The rate table
    |------------------------------------------------------------------
    */

    function matchesQuery(currency) {
        const query = view.query.trim().toLocaleLowerCase(getLocale());

        return (
            !query ||
            currency.code.toLowerCase().includes(query) ||
            currency.name.toLowerCase().includes(query) ||
            localName(currency).toLocaleLowerCase(getLocale()).includes(query)
        );
    }

    function passesFilter(currency) {
        const trend = direction(quoteOf(currency).change);

        if (view.filter === 'popular') {
            return POPULAR.includes(currency.code);
        }

        if (view.filter === 'up' || view.filter === 'down') {
            return trend === view.filter;
        }

        return true;
    }

    function sorted(items) {
        const byName = (a, b) =>
            localName(a).localeCompare(localName(b), getLocale());
        const change = (currency) => quoteOf(currency).change ?? 0;

        const compare = {
            code: (a, b) => a.code.localeCompare(b.code),
            up: (a, b) => change(b) - change(a),
            down: (a, b) => change(a) - change(b),
        }[view.sort];

        return [...items].sort(compare ?? byName);
    }

    function renderFilters(others) {
        const counts = { all: others.length, popular: 0, up: 0, down: 0 };

        others.forEach((currency) => {
            const trend = direction(quoteOf(currency).change);

            if (POPULAR.includes(currency.code)) {
                counts.popular++;
            }

            if (trend === 'up' || trend === 'down') {
                counts[trend]++;
            }
        });

        filters.innerHTML = ['all', 'popular', 'up', 'down']
            .map(
                (key) => `
                <button type="button" class="chip" aria-pressed="${view.filter === key}" data-filter="${key}">
                    ${t(`currencies.filter_${key}`)}
                    <span class="chip__count">${counts[key]}</span>
                </button>
            `,
            )
            .join('');
    }

    function changeHtml(quoted) {
        const trend = direction(quoted.change);

        if (trend === 'none') {
            return `<span class="change-pill change-pill--flat">—</span>`;
        }

        const arrow =
            trend === 'flat'
                ? ''
                : icon('arrow', {
                      size: 13,
                      className: `change-pill__arrow change-pill__arrow--${trend}`,
                  });

        return `<span class="change-pill change-pill--${trend}" title="${escapeHtml(t('currencies.change_hint'))}">${arrow}${formatPercent(quoted.change)}</span>`;
    }

    function rowHtml(currency) {
        const quote = quoteCode();
        const quoted = quoteOf(currency);
        const isYours = currency.code === quote;
        const name = localName(currency);

        const sub = isYours
            ? t('currencies.symbol_line', {
                  symbol: currency.symbol || currency.code,
              })
            : quoted.rate
              ? t('currencies.rate', {
                    from: quote,
                    amount: formatRate(quoted.inverse),
                    to: currency.code,
                })
              : t('currencies.no_rate');

        const delta =
            quoted.delta === null
                ? isYours
                    ? '—'
                    : ''
                : Math.abs(quoted.delta) < 0.00005
                  ? t('currencies.unchanged')
                  : t('currencies.change_abs', {
                        amount: `${sign(quoted.delta)}${formatRate(Math.abs(quoted.delta))}`,
                    });

        const action = isYours
            ? `<span class="currency-row__yours">${icon('check', { size: 15 })}${t('currencies.yours')}</span>`
            : `<button type="button" class="btn btn--outline btn--sm currency-row__pick" data-currency-pick="${currency.id}" aria-label="${escapeHtml(t('currencies.set_label', { code: currency.code }))}"${quoted.rate ? '' : ` aria-disabled="true" title="${escapeHtml(t('currencies.no_rate'))}"`}>${t('currencies.set')}</button>`;

        return `
            <div class="currency-row${isYours ? ' currency-row--yours' : ''}" data-currency-code="${escapeHtml(currency.code)}">
                <button type="button" class="currency-row__main" data-currency-open="${escapeHtml(currency.code)}">
                    <span class="currency-code${isYours ? ' currency-code--solid' : ''}">${escapeHtml(currency.code)}</span>
                    <span class="currency-row__text">
                        <span class="currency-row__name">${escapeHtml(name)}</span>
                        <span class="currency-row__sub">${escapeHtml(sub)}</span>
                    </span>
                </button>
                <div class="currency-row__rate">
                    <span class="currency-row__value">${isYours ? '1' : quoted.rate ? formatRate(quoted.rate) : '—'} <span class="currency-row__unit">${escapeHtml(quote)}</span></span>
                    <span class="currency-row__delta">${escapeHtml(delta)}</span>
                    <span class="currency-row__trend currency-row__trend--${direction(quoted.change)}">${isYours || quoted.change === null ? '—' : formatPercent(quoted.change)}</span>
                </div>
                <div class="currency-row__change">${isYours ? '<span class="change-pill change-pill--flat">—</span>' : changeHtml(quoted)}</div>
                <div class="currency-row__action">${action}</div>
            </div>
        `;
    }

    function groupHtml(label, count) {
        return `<div class="currency-group"><span>${escapeHtml(label)}</span><span>${count}</span></div>`;
    }

    function renderList() {
        const quote = quoteCode();
        const yours = byCode(quote);
        const others = currencies.filter((currency) => currency.code !== quote);
        const matches = sorted(
            others.filter(
                (currency) => matchesQuery(currency) && passesFilter(currency),
            ),
        );

        renderFilters(others);

        const rows = [];
        let visible = 0;
        let hidden = 0;

        if (
            yours &&
            matchesQuery(yours) &&
            ['all', 'popular'].includes(view.filter)
        ) {
            rows.push(rowHtml(yours));
        }

        /*
         * Unfiltered and A–Z, the popular currencies get a group of their
         * own above the rest; any search, filter or other order is one
         * flat list.
         */
        const grouped =
            view.filter === 'all' && !view.query.trim() && view.sort === 'name';

        if (grouped) {
            const popular = POPULAR.map((code) =>
                matches.find((currency) => currency.code === code),
            ).filter(Boolean);
            const rest = matches.filter(
                (currency) => !POPULAR.includes(currency.code),
            );

            if (popular.length) {
                rows.push(
                    groupHtml(t('currencies.group_popular'), popular.length),
                );
                popular.forEach((currency) => rows.push(rowHtml(currency)));
            }

            rows.push(groupHtml(t('currencies.group_all'), rest.length));
            rest.slice(0, view.limit).forEach((currency) =>
                rows.push(rowHtml(currency)),
            );

            visible = popular.length + Math.min(rest.length, view.limit);
            hidden = Math.max(rest.length - view.limit, 0);
        } else {
            matches
                .slice(0, view.limit)
                .forEach((currency) => rows.push(rowHtml(currency)));

            visible = Math.min(matches.length, view.limit);
            hidden = Math.max(matches.length - view.limit, 0);
        }

        list.setAttribute('aria-busy', 'false');
        list.innerHTML = rows.join('');

        if (!matches.length) {
            list.insertAdjacentHTML(
                'beforeend',
                emptyState(t('currencies.empty_title'), {
                    hint: t('currencies.empty_hint'),
                    icon: 'search',
                    plain: true,
                    actionHtml: `<button type="button" class="btn btn--outline btn--sm" data-currency-clear>${t('currencies.reset_search')}</button>`,
                }),
            );
        }

        foot.hidden = false;
        shown.textContent = matches.length
            ? t('currencies.shown', { shown: visible, total: matches.length })
            : t('currencies.no_matches');
        more.hidden = hidden === 0;
    }

    function render() {
        renderSummary();
        renderStale();
        renderBaseCard();
        renderConverter();
        renderList();
    }

    /*
    |------------------------------------------------------------------
    | Details sheet (the whole row opens it; on phones it is the only
    | way to the "make it mine" button)
    |------------------------------------------------------------------
    */

    function openDetails(code) {
        const currency = byCode(code);

        if (!currency) {
            return;
        }

        const quote = quoteCode();
        const quoted = quoteOf(currency);
        const isYours = code === quote;
        const trend = direction(quoted.change);

        const change =
            isYours || quoted.change === null
                ? '—'
                : `${formatPercent(quoted.change)} · ${sign(quoted.delta)}${formatRate(Math.abs(quoted.delta))} ${quote}`;

        const { close, modal } = openModal({
            title: localName(currency),
            bodyHtml: `
                <div class="currency-sheet">
                    <div class="currency-sheet__id">
                        <span class="currency-code currency-code--lg">${escapeHtml(code)}</span>
                        <span class="currency-sheet__symbol">${escapeHtml(t('currencies.symbol_line', { symbol: currency.symbol || code }))}</span>
                    </div>
                    <div class="currency-sheet__stats">
                        <div class="currency-sheet__stat">
                            <span>1 ${escapeHtml(code)}</span>
                            <strong>${isYours ? '1' : quoted.rate ? formatRate(quoted.rate) : '—'} <small>${escapeHtml(quote)}</small></strong>
                        </div>
                        <div class="currency-sheet__stat">
                            <span>1 ${escapeHtml(quote)}</span>
                            <strong>${isYours ? '1' : quoted.inverse ? formatRate(quoted.inverse) : '—'} <small>${escapeHtml(code)}</small></strong>
                        </div>
                    </div>
                    <div class="currency-sheet__change">
                        <span>${t('currencies.col_change')}</span>
                        <strong class="currency-sheet__trend currency-sheet__trend--${trend}">${escapeHtml(change)}</strong>
                    </div>
                </div>
            `,
            footerHtml: isYours
                ? `<span class="currency-sheet__yours">${icon('check', { size: 16 })}${t('currencies.is_yours')}</span>`
                : `<button type="button" class="btn btn--primary btn--block" data-sheet-pick ${quoted.rate ? '' : 'disabled'}>${escapeHtml(t('currencies.set_label', { code }))}</button>`,
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
     * Saves the currency the page quotes in — `null` goes back to the
     * app currency. Offers an undo unless this save is the undo.
     */
    async function choose(id, { isUndo = false } = {}) {
        const before = preferredId;
        const code =
            id === null ? baseCode : currencies.find((c) => c.id === id)?.code;

        try {
            const { data } = await api.put('/profile/settings', {
                preferred_currency_id: id,
            });

            invalidateUserSettings();
            preferredId = data.data?.currency?.id ?? id;
        } catch (error) {
            showToast(
                apiErrorMessage(error, t('currencies.save_error')),
                'error',
            );

            return;
        }

        if (!active) {
            return;
        }

        view.limit = PAGE_SIZE;
        render();

        if (!isUndo) {
            showToast(t('currencies.saved', { code: code ?? '' }), 'success', {
                duration: UNDO_MS,
                action: {
                    label: t('currencies.undo'),
                    onClick: () => choose(before, { isUndo: true }),
                },
            });
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
            const pick = target.closest('[data-currency-pick]');

            if (pick) {
                if (pick.getAttribute('aria-disabled') !== 'true') {
                    choose(Number(pick.dataset.currencyPick));
                }

                return;
            }

            const open = target.closest('[data-currency-open]');

            if (open) {
                openDetails(open.dataset.currencyOpen);

                return;
            }

            const filter = target.closest('[data-filter]');

            if (filter) {
                view.filter = filter.dataset.filter;
                view.limit = PAGE_SIZE;
                renderList();

                return;
            }

            if (target.closest('[data-currency-reset]')) {
                choose(null);
            } else if (target.closest('[data-currency-more]')) {
                view.limit += PAGE_SIZE;
                renderList();
            } else if (target.closest('[data-currency-clear]')) {
                view.query = '';
                view.filter = 'all';
                view.limit = PAGE_SIZE;
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

    search.addEventListener(
        'input',
        () => {
            view.query = search.value;
            view.limit = PAGE_SIZE;
            renderList();
        },
        { signal },
    );

    sortSelect.addEventListener(
        'change',
        () => {
            view.sort = sortSelect.value;
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
