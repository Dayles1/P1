import { api } from '../axios';
import { bootstrapAppState, getState } from '../shared/app-state';
import { avatarHue, avatarMedia, initials } from '../shared/auth-state';
import { startCreate } from '../shared/command-palette';
import { confirmDialog } from '../shared/confirm';
import { escapeHtml } from '../shared/forms';
import { getLocale, t, tChoice } from '../shared/i18n';
import { plainTextPreview } from '../shared/mentions';
import { bootOnPage } from '../shared/page-boot';
import { emptyState, errorState } from '../shared/skeleton';
import { showToast, apiErrorMessage } from '../shared/toast';

/** How many rows each "recent" card shows, so the cards of a row line up. */
const RECENT_LIMIT = 5;

/** The checks behind `account.profile_completeness` (GetDashboardSummary). */
const PROFILE_CHECKS = ['name', 'avatar', 'email', 'timezone'];

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

/**
 * Everything below used to run once at module top level. Under Turbo
 * Drive, `<main>` (and everything in it) is replaced by fresh server
 * HTML on every navigation, but this module is only ever evaluated once
 * per session — so all of this is wrapped in `boot()` and re-run via
 * `bootOnPage` on every `turbo:load` that lands on /dashboard, re-
 * querying the (new) DOM each time instead of operating on detached
 * nodes from a previous visit.
 */
function boot() {
    const greetingEl = document.querySelector('[data-dashboard-greeting]');
    const dateEl = document.querySelector('[data-dashboard-date]');
    const tailEl = document.querySelector('[data-dashboard-tail]');
    const statGridEl = document.querySelector('[data-stat-grid]');
    const completenessValueEl = document.querySelector(
        '[data-completeness-value]',
    );
    const completenessCountEl = document.querySelector(
        '[data-completeness-count]',
    );
    const completenessRingEl = document.querySelector(
        '[data-completeness-ring]',
    );
    const instanceStatusEl = document.querySelector('[data-instance-status]');
    const profileCheckEls = document.querySelectorAll('[data-profile-check]');
    const recentRequestsEl = document.querySelector('[data-recent-requests]');
    const recentSessionsEl = document.querySelector('[data-recent-sessions]');
    const recentConversationsEl = document.querySelector(
        '[data-recent-conversations]',
    );
    const instanceOverviewEl = document.querySelector(
        '[data-instance-overview]',
    );
    const instanceStatsEl = document.querySelector('[data-instance-stats]');

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

    /** A formatted figure, stepped down a size when it is too long for a narrow column. */
    function figure(value, className) {
        const formatted = formatNumber(value);
        const isLong = formatted.length >= LONG_VALUE_LENGTH;

        return `<span class="mono ${className}${isLong ? ` ${className}--long` : ''}">${escapeHtml(formatted)}</span>`;
    }

    function statCard({ label, value, meta = '', tone = '' }) {
        return `
            <div class="dashboard-stat">
                <span class="dashboard-stat__label">${escapeHtml(label)}</span>
                ${figure(value, 'dashboard-stat__value')}
                ${meta ? `<span class="dashboard-stat__meta${tone ? ` dashboard-stat__meta--${tone}` : ''}">${escapeHtml(meta)}</span>` : ''}
            </div>
        `;
    }

    /** One line of the instance overview: a status dot, a label, a figure. */
    function instanceRow(label, value, tone = 'success') {
        return `
            <li class="dashboard-instance__row">
                <span class="dashboard-dot dashboard-dot--${tone}" aria-hidden="true"></span>
                ${escapeHtml(label)}
                <span class="mono dashboard-instance__value">${escapeHtml(formatNumber(value))}</span>
            </li>
        `;
    }

    /** "Waiting to be read" (accent) or "All caught up" under an unread count. */
    function unreadMeta(count) {
        return count > 0
            ? {
                  meta: t('dashboard.stats_meta.unread_waiting'),
                  tone: 'primary',
              }
            : { meta: t('dashboard.stats_meta.all_read') };
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

    /**
     * The API returns the percentage and three of its four checks; the
     * fourth (a name) is whatever the percentage counts beyond those
     * three, so the chips always agree with the title.
     */
    function renderProfile(account) {
        const percent = account.profile_completeness ?? 0;
        const done = Math.round((percent * PROFILE_CHECKS.length) / 100);
        const checks = {
            avatar: Boolean(account.has_avatar),
            email: Boolean(account.email_verified),
            timezone: Boolean(account.has_timezone_set),
        };
        checks.name = done > Object.values(checks).filter(Boolean).length;

        const left = PROFILE_CHECKS.length - done;

        completenessValueEl.textContent = `${formatNumber(percent)}%`;
        completenessCountEl.textContent =
            left > 0
                ? tChoice('dashboard.steps_left', left)
                : t('dashboard.profile_done');
        completenessRingEl.setAttribute('stroke-dasharray', `${percent} 100`);

        profileCheckEls.forEach((check) => {
            const isDone = checks[check.dataset.profileCheck];

            check.dataset.state = isDone ? 'done' : 'todo';
            check.querySelector('[data-profile-check-state]').textContent =
                isDone ? t('dashboard.check_done') : t('dashboard.check_todo');
        });
    }

    /** " — 12 unread." after the greeting, or " — all caught up." */
    function renderTail(summary) {
        if (!tailEl) {
            return;
        }

        tailEl.textContent =
            summary.unread_messages > 0
                ? t('dashboard.tail_unread', {
                      unread: tChoice(
                          'dashboard.unread_messages_count',
                          summary.unread_messages,
                      ),
                  })
                : t('dashboard.tail_all_read');
    }

    function renderStats(summary) {
        const { sessions, requests } = summary;

        statGridEl.removeAttribute('aria-busy');
        statGridEl.innerHTML = [
            statCard({
                label: t('dashboard.stats.messages'),
                value: summary.unread_messages,
                ...unreadMeta(summary.unread_messages),
            }),
            statCard({
                label: t('dashboard.stats.notifications'),
                value: summary.unread_notifications,
                ...unreadMeta(summary.unread_notifications),
            }),
            statCard({
                label: t('dashboard.stats.sessions'),
                value: sessions.active,
                meta: t('dashboard.stats_meta.sessions_total', {
                    count: formatNumber(sessions.total),
                }),
            }),
            statCard({
                label: t('dashboard.stats.errors_week'),
                value: requests.errors_this_week,
                ...(requests.errors_this_week > 0
                    ? {
                          meta: t('dashboard.stats_meta.error_rate', {
                              percent: percentOf(
                                  requests.errors_this_week,
                                  requests.this_week,
                              ),
                          }),
                          tone: 'danger',
                      }
                    : {
                          meta: t('dashboard.stats_meta.no_errors'),
                          tone: 'success',
                      }),
            }),
        ].join('');
    }

    function renderInstance(instance) {
        if (!instance) {
            instanceOverviewEl.hidden = true;

            return;
        }

        const hasErrors = instance.errors_today > 0;

        instanceOverviewEl.hidden = false;
        instanceStatusEl.textContent = hasErrors
            ? t('dashboard.stats_meta.error_rate', {
                  percent: percentOf(
                      instance.errors_today,
                      instance.requests_today,
                  ),
              })
            : t('dashboard.stats_meta.no_errors');
        instanceStatusEl.dataset.tone = hasErrors ? 'danger' : 'success';
        instanceStatsEl.innerHTML = `
            <ul class="dashboard-instance" role="list">
                ${instanceRow(t('dashboard.instance.users'), instance.total_users)}
                ${instanceRow(t('dashboard.instance.active_sessions'), instance.active_sessions)}
                ${instanceRow(t('dashboard.instance.requests_today'), instance.requests_today)}
                ${instanceRow(t('dashboard.instance.errors_today'), instance.errors_today, hasErrors ? 'danger' : 'success')}
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

    /**
     * The current session's badge, an "End" button for the other active
     * ones (named after its device, since every row has one), or an
     * "Ended" badge. A narrow card shows the button as its icon alone.
     */
    function sessionAside(session) {
        if (session.is_current) {
            return `<span class="dashboard-session__this">${t('dashboard.this_device')}</span>`;
        }

        if (session.status === 'active') {
            const label = t('dashboard.end_session_label', {
                device: sessionDevice(session),
            });

            return `
                <button type="button" class="btn btn--ghost btn--sm" data-revoke-session="${escapeHtml(session.id)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
                    ${t('dashboard.end_session')}
                </button>
            `;
        }

        return `<span class="dashboard-session__ended">${t('dashboard.session_ended')}</span>`;
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
                        <span class="dashboard-dot dashboard-dot--${session.is_current ? 'success' : 'muted'}" aria-hidden="true"></span>
                        <div class="dashboard-session__main">
                            <a href="/sessions/${escapeHtml(session.id)}" class="dashboard-session__device truncate">${escapeHtml(sessionDevice(session))}</a>
                            <span class="dashboard-session__meta truncate">${escapeHtml([session.ip_address, shortStamp(session.last_activity_at, calendar)].filter(Boolean).join(' · '))}</span>
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
                            ? `<span class="avatar avatar--xs">${avatarMedia(conversation.avatar)}</span>`
                            : `<span class="avatar avatar--xs avatar--hue-${avatarHue(title)}"><span class="avatar__initials" aria-hidden="true">${escapeHtml(initials(title))}</span></span>`;

                        return `
                    <li>
                        <a href="/chat/${escapeHtml(conversation.id)}" class="dashboard-chat${conversation.unread_count > 0 ? ' dashboard-chat--unread' : ''}">
                            ${avatar}
                            <span class="dashboard-chat__title truncate">${escapeHtml(title)}</span>
                            <span class="dashboard-chat__preview truncate">${escapeHtml(conversationPreview(conversation))}</span>
                            ${unreadBadge(conversation.unread_count)}
                            <span class="mono dashboard-chat__time">${escapeHtml(shortStamp(conversation.last_message_at, calendar))}</span>
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
     * widget says it could not load, and the profile card falls back to
     * its neutral title with no figures and no call to action.
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

        completenessValueEl.textContent = '—';
        completenessCountEl.textContent = '';
        completenessRingEl.setAttribute('stroke-dasharray', '0 100');
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
            renderTail(summary);
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
