import { api } from '../axios';
import { bootstrapAppState, getState } from '../shared/app-state';
import { avatarHue, avatarMedia, initials } from '../shared/auth-state';
import { startCreate, toggleTheme } from '../shared/command-palette';
import { confirmDialog } from '../shared/confirm';
import { escapeHtml } from '../shared/forms';
import { getLocale, t } from '../shared/i18n';
import { icon } from '../shared/icon';
import { plainTextPreview } from '../shared/mentions';
import { bootOnPage } from '../shared/page-boot';
import { emptyState, errorState } from '../shared/skeleton';
import { showToast, apiErrorMessage } from '../shared/toast';

/** How many rows each "recent" card shows, so the cards of a row line up. */
const RECENT_LIMIT = 5;

/**
 * The date formats a user can pick (UserDateFormatter::availableDateFormats),
 * as the order of year, month and day between their separators.
 */
const DATE_ORDERS = {
    'Y-m-d': ['year', 'month', 'day'],
    'd.m.Y': ['day', 'month', 'year'],
    'd/m/Y': ['day', 'month', 'year'],
    'm/d/Y': ['month', 'day', 'year'],
};

/** UserDateFormatter::DEFAULT_DATE_FORMAT — what the API writes when the user picked nothing. */
const DEFAULT_DATE_FORMAT = 'Y-m-d';

const DAY_MS = 86_400_000;

/** Formatted values this long no longer fit a narrow card at full size. */
const LONG_VALUE_LENGTH = 8;

const localeDataCache = new Map();

/**
 * Whether the browser really carries the page locale's data. Some builds
 * claim a locale (Chrome and `uz`) but only have its fallback patterns:
 * they print "M09" for a month name and English separators for numbers.
 * A month *name* with digits in it gives that away; the page then builds
 * dates and numbers from the dictionary instead.
 */
function hasLocaleData() {
    const locale = getLocale();

    if (!localeDataCache.has(locale)) {
        let available;

        try {
            available = !/\d/.test(
                new Intl.DateTimeFormat(locale, { month: 'long' }).format(
                    new Date(2026, 0, 15),
                ),
            );
        } catch {
            available = false;
        }

        localeDataCache.set(locale, available);
    }

    return localeDataCache.get(locale);
}

/** A dictionary value, or null when the key is missing (t() echoes the key). */
function dictionary(key) {
    const value = t(key);

    return value === key ? null : value;
}

/**
 * A number in the page locale. Without the locale's data the digits still
 * come from Intl, but its group and decimal separators ("1,284.5") are
 * swapped for the dictionary's ("1 284,5" in Uzbek).
 */
function formatNumber(value, options = {}) {
    const number = Number(value) || 0;
    let formatter;

    try {
        formatter = new Intl.NumberFormat(getLocale(), options);
    } catch {
        formatter = new Intl.NumberFormat('en', options);
    }

    if (hasLocaleData()) {
        return formatter.format(number);
    }

    const symbols = {
        group: dictionary('dashboard.number.group'),
        decimal: dictionary('dashboard.number.decimal'),
    };

    return formatter
        .formatToParts(number)
        .map((part) => symbols[part.type] ?? part.value)
        .join('');
}

/**
 * `part` as a share of `whole`, e.g. "0,4". One decimal place, and a
 * floor of "<0,1" (or a ceiling of ">99,9"), so a few errors among many
 * requests never read as 0% — nor almost all of them as 100%.
 */
function percentOf(part, whole) {
    if (!(whole > 0) || !(part > 0)) {
        return formatNumber(0);
    }

    const percent = (part / whole) * 100;
    const oneDecimal = { maximumFractionDigits: 1 };

    if (percent < 0.1) {
        return `<${formatNumber(0.1, oneDecimal)}`;
    }

    if (percent > 99.9 && part < whole) {
        return `>${formatNumber(99.9, oneDecimal)}`;
    }

    return formatNumber(Math.min(percent, 100), oneDecimal);
}

function capitalise(text) {
    return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

/** "Good afternoon" for the viewer's own clock. */
function greetingFor(date) {
    const hour = date.getHours();

    if (hour >= 5 && hour < 12) {
        return t('dashboard.greeting.morning');
    }

    if (hour >= 12 && hour < 18) {
        return t('dashboard.greeting.afternoon');
    }

    return t('dashboard.greeting.evening');
}

/** Intl's own formatting of `date`, or null when the locale has no data. */
function intlDate(date, options) {
    if (!hasLocaleData()) {
        return null;
    }

    try {
        return new Intl.DateTimeFormat(getLocale(), options).format(date);
    } catch {
        return null;
    }
}

/** "Wednesday, 24 September", capitalised, in the page's locale. */
function longDate(date) {
    return capitalise(
        intlDate(date, { weekday: 'long', day: 'numeric', month: 'long' }) ??
            t('dashboard.date.long', {
                weekday: t(`dashboard.date.weekdays.${date.getDay()}`),
                day: date.getDate(),
                month: t(`dashboard.date.months.${date.getMonth()}`),
            }),
    );
}

/**
 * How the API writes dates for this user: their date format, and today's
 * date in their timezone as a UTC midnight, so the date of a timestamp
 * can be counted back from it in whole days.
 */
function userCalendar(user) {
    const settings = user?.settings || {};
    const options = { year: 'numeric', month: 'numeric', day: 'numeric' };
    let parts;

    try {
        parts = new Intl.DateTimeFormat('en-US', {
            ...options,
            timeZone: settings.timezone?.name || undefined,
        }).formatToParts(new Date());
    } catch {
        parts = new Intl.DateTimeFormat('en-US', options).formatToParts(
            new Date(),
        );
    }

    const today = Object.fromEntries(
        parts.map((part) => [part.type, Number(part.value)]),
    );

    return {
        order:
            DATE_ORDERS[settings.date_format] ??
            DATE_ORDERS[DEFAULT_DATE_FORMAT],
        today: Date.UTC(today.year, today.month - 1, today.day),
    };
}

/** "Mon" for a UTC-midnight date. */
function shortWeekday(date) {
    return (
        intlDate(date, { weekday: 'short', timeZone: 'UTC' }) ??
        t(`dashboard.date.weekdays_short.${date.getUTCDay()}`)
    );
}

/** "23 Sep" for a UTC-midnight date. */
function shortDayMonth(date) {
    return (
        intlDate(date, { day: 'numeric', month: 'short', timeZone: 'UTC' }) ??
        t('dashboard.date.short', {
            day: date.getUTCDate(),
            month: t(`dashboard.date.months_short.${date.getUTCMonth()}`),
        })
    );
}

/**
 * The API sends "<date> <time>" already formatted for the user; a list
 * row only has room for a short label: the time for today, "yesterday",
 * a weekday within the week, a day and month within the year, or else
 * the date as the API wrote it.
 */
function shortStamp(formatted, calendar, { capitalised = false } = {}) {
    if (!formatted) {
        return '';
    }

    const [datePart, ...timeParts] = String(formatted).split(' ');
    const values = datePart.split(/[-./]/).map(Number);

    if (values.length !== 3 || values.some(Number.isNaN)) {
        return String(formatted);
    }

    const parts = Object.fromEntries(
        calendar.order.map((key, index) => [key, values[index]]),
    );
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    const daysAgo = Math.round((calendar.today - date.getTime()) / DAY_MS);
    let label;

    if (daysAgo <= 0 && timeParts.length) {
        label = timeParts.join(' ');
    } else if (daysAgo === 1) {
        label = t('dashboard.yesterday');
    } else if (daysAgo > 1 && daysAgo < 7) {
        label = shortWeekday(date);
    } else if (parts.year === new Date(calendar.today).getUTCFullYear()) {
        label = shortDayMonth(date);
    } else {
        label = datePart;
    }

    return capitalised ? capitalise(label) : label;
}

/** The profile steps the bar counts, in the order its chips show. */
function profileSteps(account) {
    return {
        avatar: Boolean(account.has_avatar),
        email: Boolean(account.email_verified),
        two_factor: Boolean(account.has_two_factor),
        timezone: Boolean(account.has_timezone_set),
    };
}

/** "+18" / "−4" (percent) for the last day against the one before, or null without a base. */
function change(current, previous) {
    if (!(previous > 0)) {
        return null;
    }

    const percent = Math.round(((current - previous) / previous) * 100);
    const sign = percent > 0 ? '+' : percent < 0 ? '−' : '';

    return `${sign}${formatNumber(Math.abs(percent))}`;
}

/**
 * Everything below is wrapped in `boot()` and re-run via `bootOnPage` on
 * every `turbo:load` that lands on /dashboard: Turbo replaces `<main>`
 * on each visit, while this module is evaluated once per session.
 */
function boot() {
    const $ = (selector) => document.querySelector(selector);

    const greetingEl = $('[data-dashboard-greeting]');
    const dateEl = $('[data-dashboard-date]');
    const tailEl = $('[data-dashboard-tail]');
    const statGridEl = $('[data-stat-grid]');
    const completenessValueEl = $('[data-completeness-value]');
    const completenessCountEl = $('[data-completeness-count]');
    const completenessBarEl = $('[data-completeness-bar]');
    const completenessGoEl = $('[data-completeness-go]');
    const instanceStatusEl = $('[data-instance-status]');
    const profileCheckEls = document.querySelectorAll('[data-profile-check]');
    const recentRequestsEl = $('[data-recent-requests]');
    const recentSessionsEl = $('[data-recent-sessions]');
    const recentConversationsEl = $('[data-recent-conversations]');
    const instanceOverviewEl = $('[data-instance-overview]');
    const instanceStatsEl = $('[data-instance-stats]');

    /*
     * Every widget the summary fills starts as server-rendered skeletons;
     * a retry puts exactly those back while it reloads.
     */
    const loadingMarkup = new Map(
        [
            statGridEl,
            completenessValueEl,
            completenessCountEl,
            recentRequestsEl,
            recentSessionsEl,
            recentConversationsEl,
            instanceStatsEl,
        ]
            .filter(Boolean)
            .map((el) => [el, el.innerHTML]),
    );

    let user = null;
    let calendar = userCalendar(null);

    /*
     * The shell already asked for the user; this only joins that same
     * request (and settles at once after a Turbo visit), in parallel with
     * the summary below.
     */
    const userReady = bootstrapAppState().then(() => {
        user = getState().user;
        calendar = userCalendar(user);
        renderGreeting();
    });

    /** A figure (or ready text), stepped down a size when it is too long for a narrow column. */
    function figure(value, className) {
        const formatted =
            typeof value === 'string' ? value : formatNumber(value);
        const isLong = formatted.length >= LONG_VALUE_LENGTH;

        return `<span class="mono ${className}${isLong ? ` ${className}--long` : ''}">${escapeHtml(formatted)}</span>`;
    }

    function statCard({
        label,
        value,
        iconName,
        meta = '',
        tone = '',
        href = '',
    }) {
        const tag = href ? 'a' : 'div';

        return `
            <${tag} class="dashboard-stat"${href ? ` href="${escapeHtml(href)}"` : ''}>
                <span class="dashboard-stat__top">
                    <span class="dashboard-stat__label">${escapeHtml(label)}</span>
                    <span class="dashboard-stat__icon" aria-hidden="true">${icon(iconName, { size: 15 })}</span>
                </span>
                ${figure(value, 'dashboard-stat__value')}
                ${meta ? `<span class="dashboard-stat__meta${tone ? ` dashboard-stat__meta--${tone}` : ''}">${escapeHtml(meta)}</span>` : ''}
            </${tag}>
        `;
    }

    function renderGreeting() {
        if (!greetingEl) {
            return;
        }

        const greeting = greetingFor(new Date());

        // Falls back to the bare greeting (rather than leaving the
        // skeleton spinning forever) if the user fetch failed.
        greetingEl.textContent = user?.name
            ? t('dashboard.greeting_with_name', { greeting, name: user.name })
            : greeting;
    }

    function renderProfile(account) {
        const steps = profileSteps(account);
        const total = Object.keys(steps).length;
        const done = Object.values(steps).filter(Boolean).length;
        const percent = Math.round((done / total) * 100);

        completenessValueEl.textContent = t('dashboard.profile_filled', {
            percent: formatNumber(percent),
        });
        completenessCountEl.textContent = t('dashboard.profile_steps', {
            done: formatNumber(done),
            total: formatNumber(total),
        });
        completenessBarEl.value = percent;
        completenessGoEl.hidden = done === total;

        profileCheckEls.forEach((check) => {
            const isDone = steps[check.dataset.profileCheck];

            check.dataset.state = isDone ? 'done' : 'todo';
            check.querySelector('[data-profile-check-state]').textContent =
                isDone ? t('dashboard.check_done') : t('dashboard.check_todo');
        });
    }

    /** " · an overview of your workspace" after the date. */
    function renderTail() {
        if (tailEl) {
            tailEl.textContent = ` · ${t('dashboard.overview_hint')}`;
        }
    }

    function errorMeta(requests) {
        if (!(requests.errors_24h > 0)) {
            return { meta: t('dashboard.meta_no_errors'), tone: 'success' };
        }

        const status = requests.top_error_status;
        const reason = dictionary(`dashboard.status_${status}`);

        return {
            meta: reason
                ? t('dashboard.meta_error_top', { status, reason })
                : String(status ?? ''),
            tone: 'danger',
        };
    }

    function renderStats(summary) {
        const { sessions, requests, conversations = {} } = summary;
        const growth = change(requests.last_24h, requests.previous_24h);

        statGridEl.removeAttribute('aria-busy');
        statGridEl.innerHTML = [
            statCard({
                label: t('dashboard.card_sessions'),
                value: sessions.active,
                iconName: 'monitor',
                href: '/sessions',
                meta: t('dashboard.meta_new_this_week', {
                    count: formatNumber(sessions.new_this_week ?? 0),
                }),
            }),
            statCard({
                label: t('dashboard.card_unread'),
                value: summary.unread_notifications,
                iconName: 'bell',
                href: '/notifications',
                ...(summary.unread_notifications_today > 0
                    ? {
                          meta: t('dashboard.meta_new_today', {
                              count: formatNumber(
                                  summary.unread_notifications_today,
                              ),
                          }),
                          tone: 'primary',
                      }
                    : { meta: t('dashboard.meta_nothing_new') }),
            }),
            statCard({
                label: t('dashboard.card_chats'),
                value: conversations.total ?? 0,
                iconName: 'chat',
                href: '/chat',
                meta: t('dashboard.meta_with_new', {
                    count: formatNumber(conversations.with_unread ?? 0),
                }),
                tone: conversations.with_unread > 0 ? 'primary' : '',
            }),
            statCard({
                label: t('dashboard.card_requests_24h'),
                value: requests.last_24h ?? 0,
                iconName: 'activity',
                ...(growth
                    ? {
                          meta: t('dashboard.meta_vs_yesterday', {
                              percent: growth,
                          }),
                          tone: growth.startsWith('+') ? 'success' : '',
                      }
                    : {}),
            }),
            statCard({
                label: t('dashboard.card_errors_24h'),
                value: requests.errors_24h ?? 0,
                iconName: 'alert',
                ...errorMeta(requests),
            }),
            statCard({
                label: t('dashboard.card_devices'),
                value: sessions.devices ?? 0,
                iconName: 'phone',
                meta: sessions.latest_device
                    ? t('dashboard.meta_latest_device', {
                          device: sessions.latest_device,
                      })
                    : '',
            }),
        ].join('');
    }

    function instanceTile(label, value, meta = '', tone = '') {
        return `
            <div class="dashboard-tile">
                <span class="dashboard-tile__label">${escapeHtml(label)}</span>
                ${figure(value, 'dashboard-tile__value')}
                ${meta ? `<span class="dashboard-tile__meta${tone ? ` dashboard-stat__meta--${tone}` : ''}">${escapeHtml(meta)}</span>` : ''}
            </div>
        `;
    }

    function renderInstance(instance) {
        if (!instance) {
            instanceOverviewEl.hidden = true;

            return;
        }

        const services = instance.services || {};
        const failed = instance.queue_failed ?? 0;

        instanceOverviewEl.hidden = false;
        instanceStatusEl.textContent = '';
        instanceStatsEl.innerHTML = `
            <div class="dashboard-tiles">
                ${instanceTile(
                    t('dashboard.instance_users'),
                    instance.total_users,
                    t('dashboard.instance_users_month', {
                        count: formatNumber(instance.users_this_month ?? 0),
                    }),
                )}
                ${instanceTile(
                    t('dashboard.instance_active_today'),
                    instance.active_today ?? 0,
                    t('dashboard.instance_active_share', {
                        percent: percentOf(
                            instance.active_today,
                            instance.total_users,
                        ),
                    }),
                )}
                ${instanceTile(
                    t('dashboard.instance_rpm'),
                    instance.requests_last_minute ?? 0,
                    t('dashboard.instance_rpm_peak', {
                        count: formatNumber(
                            instance.requests_peak_per_minute ?? 0,
                        ),
                    }),
                )}
                ${instanceTile(
                    t('dashboard.instance_5xx'),
                    `${percentOf(instance.server_errors_24h, instance.requests_24h)}%`,
                    t('dashboard.instance_5xx_period'),
                    instance.server_errors_24h > 0 ? 'danger' : '',
                )}
                ${instanceTile(
                    t('dashboard.instance_queue'),
                    instance.queue_pending ?? 0,
                    failed > 0
                        ? t('dashboard.instance_queue_failed', {
                              count: formatNumber(failed),
                          })
                        : t('dashboard.instance_queue_pending'),
                    failed > 0 ? 'danger' : '',
                )}
                ${instanceTile(
                    t('dashboard.instance_version'),
                    instance.version || '—',
                    instance.released_at
                        ? t('dashboard.instance_released', {
                              date: shortStamp(instance.released_at, {
                                  ...calendar,
                                  order: DATE_ORDERS['Y-m-d'],
                              }),
                          })
                        : '',
                )}
            </div>
            <ul class="dashboard-services" role="list">
                ${['reverb', 'queue', 'mail', 'database']
                    .map((service) => {
                        const up = Boolean(services[service]);

                        return `
                        <li class="dashboard-service">
                            <span class="dashboard-dot dashboard-dot--${up ? 'success' : 'danger'}" aria-hidden="true"></span>
                            ${escapeHtml(t(`dashboard.service_${service}`))}
                            <span class="sr-only">${escapeHtml(up ? t('dashboard.service_up') : t('dashboard.service_down'))}</span>
                        </li>
                    `;
                    })
                    .join('')}
            </ul>
        `;
    }

    /** The status code's color: green for 2xx, blue for 3xx, red from 400. */
    function statusTone(statusCode) {
        if (!statusCode) {
            return '';
        }

        if (statusCode >= 400) {
            return 'danger';
        }

        return statusCode >= 300 ? 'info' : 'success';
    }

    /** "42 ms", or "1.2 s" from a second up, so the column stays narrow. */
    function requestDuration(milliseconds) {
        if (milliseconds === null || milliseconds === undefined) {
            return '';
        }

        if (milliseconds >= 1000) {
            return t('dashboard.duration_s', {
                value: formatNumber(milliseconds / 1000, {
                    maximumFractionDigits: 1,
                }),
            });
        }

        return t('dashboard.duration_ms', {
            value: formatNumber(milliseconds),
        });
    }

    function renderRecentRequests(logs) {
        if (!logs.length) {
            recentRequestsEl.innerHTML = emptyState(
                t('dashboard.no_recent_requests'),
                { icon: 'activity', plain: true },
            );

            return;
        }

        recentRequestsEl.innerHTML = `
            <ul class="mono dashboard-requests" role="list">
                ${logs
                    .slice(0, RECENT_LIMIT)
                    .map(
                        (log) => `
                    <li class="dashboard-request" title="${escapeHtml(log.created_at ?? '')}">
                        <span class="dashboard-request__method">${escapeHtml(log.method)}</span>
                        <span class="dashboard-request__path">${escapeHtml(log.path)}</span>
                        <span class="dashboard-request__status dashboard-request__status--${statusTone(log.status_code)}">${escapeHtml(log.status_code ?? '—')}</span>
                        <span class="dashboard-request__duration">${escapeHtml(requestDuration(log.duration_ms))}</span>
                    </li>
                `,
                    )
                    .join('')}
            </ul>
        `;
    }

    function sessionDevice(session) {
        return (
            [session.browser, session.platform].filter(Boolean).join(' · ') ||
            session.device_name ||
            t('common.unknown')
        );
    }

    function sessionIcon(session) {
        const kind =
            `${session.device_type || ''} ${session.platform || ''}`.toLowerCase();

        return /mobile|phone|iphone|android|ios/.test(kind)
            ? 'phone'
            : 'monitor';
    }

    /**
     * The current session's badge, an "End" button for the other active
     * ones (named after its device, since every row has one), or an
     * "Ended" note.
     */
    function sessionAside(session) {
        if (session.is_current) {
            return `<span class="badge badge--success">${escapeHtml(t('dashboard.current_session'))}</span>`;
        }

        if (session.status === 'active') {
            const label = t('dashboard.end_session_label', {
                device: sessionDevice(session),
            });

            return `
                <button type="button" class="btn btn--sm dashboard-session__end" data-revoke-session="${escapeHtml(session.id)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
                    ${escapeHtml(t('dashboard.end_session'))}
                </button>
            `;
        }

        return `<span class="dashboard-session__ended">${escapeHtml(t('dashboard.session_ended'))}</span>`;
    }

    function renderRecentSessions(sessions) {
        if (!sessions.length) {
            recentSessionsEl.innerHTML = emptyState(
                t('dashboard.no_recent_sessions'),
                { icon: 'monitor', plain: true },
            );

            return;
        }

        recentSessionsEl.innerHTML = `
            <ul class="dashboard-sessions" role="list">
                ${sessions
                    .slice(0, RECENT_LIMIT)
                    .map(
                        (session) => `
                    <li class="dashboard-session">
                        <span class="dashboard-session__icon" aria-hidden="true">${icon(sessionIcon(session), { size: 16 })}</span>
                        <div class="dashboard-session__main">
                            <a href="/sessions/${escapeHtml(session.id)}" class="dashboard-session__device truncate">${escapeHtml(sessionDevice(session))}</a>
                            <span class="dashboard-session__meta truncate">${escapeHtml([session.location || session.ip_address, shortStamp(session.last_activity_at, calendar)].filter(Boolean).join(' · '))}</span>
                        </div>
                        ${sessionAside(session)}
                    </li>
                `,
                    )
                    .join('')}
            </ul>
        `;
    }

    /** The last message as plain text: mention tokens read as "@Name". */
    function conversationPreview(conversation) {
        const message = conversation.last_message;

        if (!message) {
            return t('dashboard.no_messages_yet');
        }

        const body = message.body
            ? plainTextPreview(message.body)
            : t('dashboard.attachment');

        return conversation.type !== 'private' && message.sender
            ? `${message.sender}: ${body}`
            : body;
    }

    /** An unread count whose number is spoken with what it counts. */
    function unreadBadge(count) {
        if (!(count > 0)) {
            return '';
        }

        return `
            <span class="mono dashboard-chat__unread">
                <span aria-hidden="true">${escapeHtml(formatNumber(count))}</span>
                <span class="sr-only">${escapeHtml(t('dashboard.unread_count', { count: formatNumber(count) }))}</span>
            </span>
        `;
    }

    function renderRecentConversations(conversations) {
        if (!recentConversationsEl) {
            return;
        }

        if (!conversations.length) {
            recentConversationsEl.innerHTML = emptyState(
                t('dashboard.no_recent_conversations'),
                { icon: 'chat', plain: true },
            );

            return;
        }

        recentConversationsEl.innerHTML = `
            <ul class="dashboard-chats" role="list">
                ${conversations
                    .slice(0, RECENT_LIMIT)
                    .map((conversation) => {
                        const title = conversation.title || t('common.unknown');
                        const avatar = conversation.avatar
                            ? `<span class="avatar dashboard-chat__avatar">${avatarMedia(conversation.avatar)}</span>`
                            : `<span class="avatar dashboard-chat__avatar avatar--hue-${avatarHue(title)}"><span class="avatar__initials" aria-hidden="true">${escapeHtml(initials(title))}</span></span>`;

                        return `
                    <li>
                        <a href="/chat/${escapeHtml(conversation.id)}" class="dashboard-chat${conversation.unread_count > 0 ? ' dashboard-chat--unread' : ''}">
                            ${avatar}
                            <span class="dashboard-chat__body">
                                <span class="dashboard-chat__title truncate">${escapeHtml(title)}</span>
                                <span class="dashboard-chat__preview truncate">${escapeHtml(conversationPreview(conversation))}</span>
                            </span>
                            <span class="dashboard-chat__side">
                                <span class="mono dashboard-chat__time">${escapeHtml(shortStamp(conversation.last_message_at, calendar, { capitalised: true }))}</span>
                                ${unreadBadge(conversation.unread_count)}
                            </span>
                        </a>
                    </li>
                `;
                    })
                    .join('')}
            </ul>
        `;
    }

    /**
     * Nothing may stay a skeleton, nor look like real data, once the
     * summary has failed: the stat grid offers a retry, every other
     * widget says it could not load, and the profile bar falls back to
     * its neutral title with no figures.
     */
    function renderLoadError() {
        statGridEl.removeAttribute('aria-busy');
        statGridEl.innerHTML = errorState(t('dashboard.load_failed'));

        const failed = emptyState(t('dashboard.load_failed'), {
            icon: 'alert',
            plain: true,
        });

        [
            recentRequestsEl,
            recentSessionsEl,
            recentConversationsEl,
            instanceStatsEl,
        ].forEach((el) => {
            if (el) {
                el.innerHTML = failed;
            }
        });

        completenessValueEl.textContent = t('dashboard.profile');
        completenessCountEl.textContent = '';
        completenessBarEl.value = 0;
        profileCheckEls.forEach((check) => {
            delete check.dataset.state;
            check.querySelector('[data-profile-check-state]').textContent = '';
        });
    }

    /** Back to the first paint's skeletons while the summary reloads. */
    function renderLoading() {
        loadingMarkup.forEach((markup, el) => {
            el.innerHTML = markup;
        });
        statGridEl.setAttribute('aria-busy', 'true');
    }

    async function loadDashboard() {
        try {
            const [{ data }] = await Promise.all([
                api.get('/dashboard'),
                userReady,
            ]);
            const summary = data.data;

            renderProfile(summary.account);
            renderTail();
            renderStats(summary);
            renderInstance(summary.instance);
            renderRecentRequests(summary.recent_requests || []);
            renderRecentSessions(summary.recent_sessions || []);
            renderRecentConversations(summary.recent_conversations || []);
        } catch (error) {
            renderLoadError();
            showToast(
                apiErrorMessage(error, t('common.error_generic')),
                'error',
            );
        }
    }

    async function revokeSession(button) {
        try {
            const confirmed = await confirmDialog({
                title: t('confirm.revoke_session_title'),
                message: t('confirm.revoke_session_message'),
                confirmText: t('confirm.revoke_session_confirm'),
                cancelText: t('common.cancel'),
                danger: true,
                icon: 'logout',
                onConfirm: () =>
                    api.delete(`/sessions/${button.dataset.revokeSession}`),
            });

            if (!confirmed) {
                return;
            }

            showToast(t('sessions.revoked'));
            loadDashboard();
        } catch (error) {
            showToast(apiErrorMessage(error, t('sessions.error')), 'error');
        }
    }

    document.querySelectorAll('[data-dashboard-new-chat]').forEach((button) => {
        button.addEventListener('click', () => startCreate('private'));
    });

    $('[data-dashboard-toggle-theme]')?.addEventListener('click', toggleTheme);

    recentSessionsEl?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-revoke-session]');

        if (button) {
            revokeSession(button);
        }
    });

    statGridEl?.addEventListener('click', (event) => {
        if (event.target.closest('[data-retry]')) {
            renderLoading();
            loadDashboard();
        }
    });

    if (dateEl) {
        dateEl.textContent = longDate(new Date());
    }

    loadDashboard();
}

bootOnPage('[data-dashboard-welcome]', boot);
