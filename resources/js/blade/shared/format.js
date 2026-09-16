/**
 * Client-only relative-time formatting ("2m ago"). The authoritative,
 * locale/timezone-aware absolute timestamp always comes from the backend
 * (`UserDateFormatter`, already applied server-side to every resource) —
 * this is a lightweight cosmetic layer on top of the `*_iso` field several
 * resources also expose.
 */
export function timeAgo(iso) {
    if (!iso) {
        return '';
    }

    const then = new Date(iso).getTime();

    if (Number.isNaN(then)) {
        return '';
    }

    const seconds = Math.round((Date.now() - then) / 1000);

    if (seconds < 10) {
        return 'just now';
    }

    const units = [
        ['y', 31536000],
        ['mo', 2592000],
        ['d', 86400],
        ['h', 3600],
        ['m', 60],
    ];

    for (const [label, secondsInUnit] of units) {
        const value = Math.floor(seconds / secondsInUnit);

        if (value >= 1) {
            return `${value}${label} ago`;
        }
    }

    return `${seconds}s ago`;
}

export function prettyJson(value) {
    if (value === null || value === undefined) {
        return null;
    }

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

export function methodClass(method) {
    return (
        {
            GET: 'pill pill--info',
            POST: 'pill pill--success',
            PUT: 'pill pill--warning',
            PATCH: 'pill pill--warning',
            DELETE: 'pill pill--danger',
        }[method] || 'pill pill--muted'
    );
}

export function statusClass(status) {
    if (!status) {
        return 'pill pill--muted';
    }

    if (status >= 500) {
        return 'pill pill--danger';
    }

    if (status >= 400) {
        return 'pill pill--warning';
    }

    if (status >= 300) {
        return 'pill pill--info';
    }

    return 'pill pill--success';
}
