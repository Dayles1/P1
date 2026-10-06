import { getLocale, hasLocaleData, t } from '../../shared/i18n';

/*
| Every chat time is formatted here from an ISO string, in the signed-in
| user's own timezone and 12/24h setting (their account settings), not
| in the sender's and not as the server pre-formatted it.
*/

let timeZone;
let hour12 = false;

/** Takes the timezone and clock from the user's settings (/auth/me). */
export function configureTime(user) {
    const name = user?.settings?.timezone?.name;

    try {
        timeZone = name
            ? new Intl.DateTimeFormat('en', {
                  timeZone: name,
              }).resolvedOptions().timeZone
            : undefined;
    } catch {
        timeZone = undefined;
    }

    hour12 = user?.settings?.time_format === '12h';
}

function locale() {
    return hasLocaleData() ? getLocale() : 'en';
}

function toDate(iso) {
    if (!iso) {
        return null;
    }

    const date = new Date(iso);

    return Number.isNaN(date.getTime()) ? null : date;
}

/** The calendar parts of a moment in the user's timezone. */
function parts(date) {
    const values = {};

    new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
    })
        .formatToParts(date)
        .forEach(({ type, value }) => {
            values[type] = value;
        });

    return values;
}

/** "2026-10-02" in the user's timezone — what groups messages into days. */
export function dayKey(iso) {
    const date = toDate(iso);

    if (!date) {
        return '';
    }

    const { year, month, day } = parts(date);

    return `${year}-${month}-${day}`;
}

function daysBetween(fromKey, toKey) {
    return Math.round((Date.parse(toKey) - Date.parse(fromKey)) / 86400000);
}

/** "14:05" (or "2:05 PM"). */
export function formatTime(iso, { seconds = false } = {}) {
    const date = toDate(iso);

    if (!date) {
        return '';
    }

    return new Intl.DateTimeFormat(locale(), {
        timeZone,
        hour: hour12 ? 'numeric' : '2-digit',
        minute: '2-digit',
        second: seconds ? '2-digit' : undefined,
        hour12,
    }).format(date);
}

/** "2 октября 2026" — the year only when it is not this year. */
export function formatDate(iso, { year = 'auto', month = 'long' } = {}) {
    const date = toDate(iso);

    if (!date) {
        return '';
    }

    const sameYear =
        dayKey(iso).slice(0, 4) ===
        dayKey(new Date().toISOString()).slice(0, 4);

    return new Intl.DateTimeFormat(locale(), {
        timeZone,
        day: 'numeric',
        month,
        year:
            year === 'always' || (year === 'auto' && !sameYear)
                ? 'numeric'
                : undefined,
    }).format(date);
}

/** "2 октября 2026, 14:05:09" — for "Подробно". */
export function formatDateTime(iso, { seconds = true } = {}) {
    if (!toDate(iso)) {
        return '';
    }

    return `${formatDate(iso, { year: 'always' })}, ${formatTime(iso, { seconds })}`;
}

/** The day chip: "Сегодня", "Вчера" or the date. */
export function dayLabel(iso) {
    const key = dayKey(iso);

    if (!key) {
        return '';
    }

    const diff = daysBetween(key, dayKey(new Date().toISOString()));

    if (diff === 0) {
        return t('chat.today');
    }

    if (diff === 1) {
        return t('chat.yesterday');
    }

    return formatDate(iso);
}

/** The chat list's time column: today the time, this week the weekday, older the date. */
export function listTime(iso) {
    const key = dayKey(iso);

    if (!key) {
        return '';
    }

    const diff = daysBetween(key, dayKey(new Date().toISOString()));

    if (diff <= 0) {
        return formatTime(iso);
    }

    if (diff < 7) {
        return new Intl.DateTimeFormat(locale(), {
            timeZone,
            weekday: 'short',
        }).format(toDate(iso));
    }

    return new Intl.DateTimeFormat(locale(), {
        timeZone,
        day: '2-digit',
        month: '2-digit',
        year: diff > 300 ? '2-digit' : undefined,
    }).format(toDate(iso));
}

/** "был(а) в 14:05" / "был(а) 2 окт." / "был(а) только что". */
export function lastSeenText(iso) {
    const date = toDate(iso);

    if (!date) {
        return t('chat.offline');
    }

    const minutes = Math.round((Date.now() - date.getTime()) / 60000);

    if (minutes < 2) {
        return t('chat.last_seen_recently');
    }

    if (dayKey(iso) === dayKey(new Date().toISOString())) {
        return t('chat.last_seen', { time: formatTime(iso) });
    }

    return t('chat.last_seen', { time: formatDate(iso, { month: 'short' }) });
}

/** "0:42" / "1:02:05" from seconds. */
export function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return '0:00';
    }

    const whole = Math.floor(seconds);
    const hours = Math.floor(whole / 3600);
    const mins = Math.floor((whole % 3600) / 60);
    const secs = String(whole % 60).padStart(2, '0');

    return hours
        ? `${hours}:${String(mins).padStart(2, '0')}:${secs}`
        : `${mins}:${secs}`;
}

/** "120 КБ" — units from the dictionary. */
export function formatSize(bytes) {
    if (!bytes && bytes !== 0) {
        return '';
    }

    if (bytes < 1024) {
        return t('chat.size_b', { size: bytes });
    }

    if (bytes < 1024 * 1024) {
        return t('chat.size_kb', { size: Math.round(bytes / 1024) });
    }

    return t('chat.size_mb', { size: (bytes / 1024 / 1024).toFixed(1) });
}
