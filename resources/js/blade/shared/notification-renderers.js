import { getState } from './app-state';
import { escapeHtml } from './forms';
import { getLocale, t } from './i18n';
import { icon } from './icon';
import { plainTextPreview } from './mentions';

/**
 * Mention bodies are written server-side as "{sender} mentioned you:
 * {preview}" (MentionNotification). Until the payload carries the sender
 * as its own field (`data.sender_name`), the name is read back from that
 * fixed prefix so the row can say "<b>Name</b> mentioned you in «Chat»:
 * preview" in the viewer's language; anything that doesn't match falls
 * back to the generic "<b>title</b>: body" line.
 */
const MENTION_BODY = /^(.+?) mentioned you: /s;

/**
 * Message bodies are written server-side as "{sender}: {preview}"
 * (MessageNotification) — the preview is empty for a message that is
 * only attachments, which leaves just "{sender}: ".
 */
const MESSAGE_BODY = /^(.+?):(?: |$)/s;

/**
 * t() with each `:param` filled in one pass, so a value is never itself
 * searched for placeholders (a chat called "Team :name", say) and a
 * parameter never matches inside a longer one (`:to` inside `:total`).
 */
export function interpolate(key, params = {}) {
    return t(key).replace(/:([A-Za-z_]\w*)/g, (placeholder, name) =>
        Object.hasOwn(params, name) ? String(params[name]) : placeholder,
    );
}

/**
 * The dictionary key for `count` under a plural group such as
 * `notifications.unread_summary` ({one, few, many, other}), picked with
 * the locale's plural rules; a missing form falls back to `other`.
 */
export function pluralKey(baseKey, count) {
    let form = 'other';

    try {
        form = new Intl.PluralRules(getLocale()).select(count);
    } catch {
        // An unknown locale just uses the "other" form.
    }

    const key = `${baseKey}.${form}`;

    return t(key) === key ? `${baseKey}.other` : key;
}

/**
 * One renderer per notification `type` — add a new type here (icon, the
 * module it comes from, and how its line reads) instead of growing an
 * if/else chain anywhere a notification gets drawn. Both the header
 * popover and the full Notification Center render off of this same map,
 * so there's exactly one place that knows what each type looks like.
 */
const RENDERERS = {
    system: {
        icon: 'spark',
        source: 'notifications.source.system',
        text: systemLine,
    },
    message: {
        icon: 'chat',
        source: 'notifications.source.chat',
        text: messageLine,
    },
    mention: {
        icon: 'chat',
        source: 'notifications.source.chat',
        text: mentionLine,
    },
};

function typeOf(notification) {
    return Object.hasOwn(RENDERERS, notification.type)
        ? notification.type
        : 'system';
}

/** Trimmed text of a field, with `@[Name](id)` mention tokens read as "@Name". */
function plainField(value) {
    return plainTextPreview(String(value || '')).trim();
}

/**
 * "<b>title</b>: body" — the bold lead only ever prefixes a body; a
 * title on its own is a plain sentence. A body that repeats the title as
 * its own "title:" prefix drops it instead of printing the name twice.
 */
function leadLine(notification, fallbackTitle) {
    const title = plainField(notification.title);
    let body = plainField(notification.body);

    if (title && (body === `${title}:` || body.startsWith(`${title}: `))) {
        body = body.slice(title.length + 1).trim();
    }

    if (title && body) {
        return `<strong>${escapeHtml(title)}</strong>: ${escapeHtml(body)}`;
    }

    return escapeHtml(title || body || fallbackTitle);
}

/**
 * Who sent a chat message and what it said, from `data.sender_name` /
 * `data.preview` when the payload has them, otherwise read back out of
 * the "{sender}: {preview}" body. A private chat is titled with the
 * sender's name, so that prefix is tried first (a name may hold ": ").
 * Null when the body isn't in that shape.
 */
function messageParts(notification) {
    const title = String(notification.title || '').trim();
    const body = String(notification.body || '');
    const titleIsPrefix =
        title && (body === `${title}:` || body.startsWith(`${title}: `));
    const sender = String(
        notification.data?.sender_name ||
            (titleIsPrefix ? title : body.match(MESSAGE_BODY)?.[1]) ||
            '',
    ).trim();

    if (!sender) {
        return null;
    }

    const preview =
        notification.data?.preview ??
        (body.startsWith(`${sender}:`) ? body.slice(sender.length + 1) : body);

    return { sender, preview: plainField(preview) };
}

/**
 * "<b>Name</b>: what they wrote" for a private chat, "<b>Name</b> in
 * «Chat»: what they wrote" for a group; a message that is only
 * attachments reads "<b>Name</b>: Attachment", like the chat list does.
 */
function messageLine(notification) {
    const parts = messageParts(notification);

    if (!parts) {
        return leadLine(notification, t('notifications.type_message'));
    }

    const chat = plainField(notification.title);
    const name = `<strong>${escapeHtml(parts.sender)}</strong>`;
    const lead =
        chat && chat !== parts.sender
            ? interpolate('notifications.text.message_in', {
                  chat: escapeHtml(chat),
                  name,
              })
            : name;

    return `${lead}: ${escapeHtml(parts.preview || t('notifications.text.attachment'))}`;
}

/** System events read as one plain sentence: "Version 1.5 is out — see what's new". */
function systemLine(notification) {
    const parts = [
        plainField(notification.title),
        plainField(notification.body),
    ].filter(Boolean);

    return escapeHtml(
        parts.length ? parts.join(' — ') : t('notifications.type_system'),
    );
}

/** "<b>Name</b> mentioned you in «Chat»: what they wrote". */
function mentionLine(notification) {
    const body = String(notification.body || '');
    const sender =
        notification.data?.sender_name || body.match(MENTION_BODY)?.[1];

    if (!sender) {
        return leadLine(notification, t('notifications.type_mention'));
    }

    const name = `<strong>${escapeHtml(sender)}</strong>`;
    const chat = notification.title && notification.title !== sender;
    const preview = plainField(
        notification.data?.preview ?? body.replace(MENTION_BODY, ''),
    );
    const lead = chat
        ? interpolate('notifications.text.mention_in', {
              chat: escapeHtml(notification.title),
              name,
          })
        : interpolate('notifications.text.mention', { name });

    return preview ? `${lead}: ${escapeHtml(preview)}` : lead;
}

/*
|--------------------------------------------------------------------------
| Dates — always in the signed-in user's own timezone and clock format
| (their account settings), falling back to the browser's when the user
| hasn't loaded yet or has none set.
|--------------------------------------------------------------------------
*/

function clockSettings() {
    const settings = getState().user?.settings || {};

    return {
        timeZone: settings.timezone?.name || undefined,
        hour12: settings.time_format === '12h',
    };
}

/** An Intl formatter in the user's timezone (or the browser's, if theirs is unknown to Intl). */
function formatWith(locale, options) {
    const { timeZone } = clockSettings();

    try {
        return new Intl.DateTimeFormat(locale, { ...options, timeZone });
    } catch {
        return new Intl.DateTimeFormat(locale, options);
    }
}

/** Calendar year/month/day of `date` in the user's timezone. */
function zonedParts(date) {
    const parts = formatWith('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    }).formatToParts(date);
    const part = (type) => Number(parts.find((p) => p.type === type)?.value);

    return { year: part('year'), month: part('month'), day: part('day') };
}

/** 0 for today, 1 for yesterday, … — by calendar day, not by 24h windows. */
function calendarDaysAgo(date) {
    const then = zonedParts(date);
    const today = zonedParts(new Date());

    return Math.round(
        (Date.UTC(today.year, today.month - 1, today.day) -
            Date.UTC(then.year, then.month - 1, then.day)) /
            86400000,
    );
}

/** "14:11" (or "2:11 PM" for a 12-hour clock). */
function clockTime(date) {
    const { hour12 } = clockSettings();
    // hourCycle, not hour12: `hour12: false` prints midnight as "24:05" in some locales.
    const options = {
        hour: hour12 ? 'numeric' : '2-digit',
        minute: '2-digit',
        hourCycle: hour12 ? 'h12' : 'h23',
    };

    try {
        return formatWith(getLocale(), options).format(date);
    } catch {
        return formatWith(undefined, options).format(date);
    }
}

/**
 * "21 September" — month names come from the dictionary rather than
 * Intl, which in some browsers has no real data for `uz` and prints
 * "M09" instead of a month name.
 */
function calendarDate(date) {
    const { year, month, day } = zonedParts(date);
    const sameYear = year === zonedParts(new Date()).year;

    return t(
        sameYear ? 'notifications.date.day' : 'notifications.date.day_year',
        { day, month: t(`notifications.date.months.${month - 1}`), year },
    );
}

/** Day heading in the Notification Center: "Today", "Yesterday", "21 September". */
function dayLabel(date) {
    const days = calendarDaysAgo(date);

    if (days <= 0) {
        return t('notifications.groups.today');
    }

    if (days === 1) {
        return t('notifications.groups.yesterday');
    }

    return calendarDate(date);
}

function parseDate(iso) {
    const date = iso ? new Date(iso) : null;

    return date && !Number.isNaN(date.getTime()) ? date : null;
}

/** Popover time: "5 min ago", "2 h ago", "Yesterday, 14:11", "21 September, 10:00". */
function relativeTime(date) {
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);

    if (minutes < 1) {
        return t('notifications.just_now');
    }

    if (minutes < 60) {
        return t('notifications.minutes_ago', { count: minutes });
    }

    const days = calendarDaysAgo(date);

    if (days <= 0) {
        return t('notifications.hours_ago', {
            count: Math.floor(minutes / 60),
        });
    }

    if (days === 1) {
        return t('notifications.date.yesterday_at', { time: clockTime(date) });
    }

    return t('notifications.date.at', {
        date: calendarDate(date),
        time: clockTime(date),
    });
}

function timeTag(date, text) {
    return date
        ? `<time datetime="${escapeHtml(date.toISOString())}">${escapeHtml(text)}</time>`
        : '';
}

/**
 * Same target resolution for a dropdown click, a Notification Center
 * click, and an OS notification popup click — dispatches an in-page event
 * when we're already on /chat (so the persistent app shell isn't torn
 * down for a same-page conversation switch), otherwise a Turbo soft-visit
 * for an internal route so the shell survives, falling back to a real
 * navigation only for an external/non-Turbo target.
 */
export function openNotificationTarget(notification) {
    const conversationId = notification.data?.conversation_id;
    const messageId = notification.data?.message_id;

    if (conversationId && window.location.pathname.startsWith('/chat')) {
        document.dispatchEvent(
            new CustomEvent('chat:open-conversation', {
                detail: {
                    conversationId: Number(conversationId),
                    messageId: messageId ? Number(messageId) : null,
                },
            }),
        );

        return;
    }

    if (!notification.action_url) {
        return;
    }

    const url = new URL(notification.action_url, window.location.origin);

    if (messageId) {
        url.searchParams.set('message', messageId);
    }

    const target = url.pathname + url.search;

    if (window.Turbo && url.origin === window.location.origin) {
        window.Turbo.visit(target);
    } else {
        window.location.href = target;
    }
}

/**
 * Marks a notification read (fire-and-forget — the realtime
 * `notifications.read` broadcast is the authoritative sync, this is just
 * for instant feedback) and opens its target. Shared by the bell dropdown,
 * the Notification Center, and an OS notification popup click so all three
 * behave identically instead of three hand-rolled copies.
 */
export function markNotificationReadAndOpen(api, notification) {
    if (notification.id) {
        api.post(`/notifications/${notification.id}/read`).catch(() => {});
    }

    openNotificationTarget(notification);
}

/**
 * The API's NotificationResource shape for any notification. A live one
 * pushed over Reverb arrives flat (its data fields next to `id` and
 * `type`, see BroadcastNotificationCreated::broadcastWith) with no
 * timestamps — it is unread and was created just now.
 */
export function normalizeNotification(notification) {
    if (notification.data && notification.created_at) {
        return notification;
    }

    const { id, type, title, body, action_url: actionUrl } = notification;

    return {
        id,
        type,
        title: title ?? null,
        body: body ?? null,
        action_url: actionUrl ?? null,
        data: notification.data ?? { ...notification },
        read_at: notification.read_at ?? null,
        created_at: notification.created_at ?? new Date().toISOString(),
    };
}

/**
 * One clickable row. `meta` is the already-built second line (time, or
 * "module · time"). The unread marker keeps the `notif-item--unread`
 * class and `.notif-item__dot` element both callers toggle on read.
 */
function itemHtml(notification, meta) {
    const type = typeOf(notification);
    const renderer = RENDERERS[type];
    const unread = !notification.read_at;
    const conversationId = notification.data?.conversation_id;
    const messageId = notification.data?.message_id;

    return `
        <button
            type="button"
            class="notif-item notif-item--${type}${unread ? ' notif-item--unread' : ''}"
            data-notif-id="${escapeHtml(notification.id)}"
            data-notif-url="${escapeHtml(notification.action_url || '')}"
            ${conversationId ? `data-notif-conversation-id="${escapeHtml(conversationId)}"` : ''}
            ${messageId ? `data-notif-message-id="${escapeHtml(messageId)}"` : ''}
        >
            <span class="notif-item__icon">${icon(renderer.icon, { size: 18 })}</span>
            <span class="notif-item__body">
                <span class="notif-item__text">${renderer.text(notification)}</span>
                <span class="notif-item__meta">${meta}</span>
            </span>
            ${unread ? `<span class="notif-item__dot"><span class="sr-only">${escapeHtml(t('notifications.unread_marker'))}</span></span>` : ''}
        </button>
    `;
}

/** A row for the header popover — the time reads relative ("5 min ago"). */
export function notificationItemHtml(notification) {
    const normalized = normalizeNotification(notification);
    const date = parseDate(normalized.created_at);

    return itemHtml(normalized, date ? timeTag(date, relativeTime(date)) : '');
}

/**
 * The Notification Center feed: rows grouped under a heading per day
 * ("Today", "Yesterday", "21 September"), each row saying which module
 * it came from and at what time ("Chat · 10:42").
 */
export function notificationFeedHtml(notifications) {
    let previousDay = null;

    return notifications
        .map(normalizeNotification)
        .map((notification) => {
            const date = parseDate(notification.created_at);
            const day = date ? Object.values(zonedParts(date)).join('-') : '';
            const heading =
                day !== previousDay && date
                    ? `<h2 class="notif-feed__day">${escapeHtml(dayLabel(date))}</h2>`
                    : '';
            const source = t(RENDERERS[typeOf(notification)].source);
            const meta = date
                ? `${escapeHtml(source)} · ${timeTag(date, clockTime(date))}`
                : escapeHtml(source);

            previousDay = day;

            return heading + itemHtml(notification, meta);
        })
        .join('');
}
