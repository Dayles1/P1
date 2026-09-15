import { escapeHtml } from './forms';

/**
 * Mentions are stored in the raw message body as `@[Name](id)` — there's
 * no `username` column on users (display names can contain spaces), so a
 * stable, unambiguous reference needs the id; the readable name alongside
 * it means the raw body is still legible even where it isn't rendered
 * through this parser (e.g. a notification preview).
 */
const MENTION_PATTERN = /@\[([^\]]+)\]\((\d+)\)/g;

export function mentionToken(name, id) {
    return `@[${name}](${id})`;
}

/** Renders a raw message body to safe HTML, turning mention tokens into styled chips — everything else is escaped. */
export function renderMessageBody(rawBody) {
    let result = '';
    let lastIndex = 0;
    let match;

    MENTION_PATTERN.lastIndex = 0;

    while ((match = MENTION_PATTERN.exec(rawBody)) !== null) {
        result += escapeHtml(rawBody.slice(lastIndex, match.index));

        const [full, name, id] = match;
        result += `<span class="mention-chip" data-user-id="${id}">@${escapeHtml(name)}</span>`;
        lastIndex = match.index + full.length;
    }

    result += escapeHtml(rawBody.slice(lastIndex));

    return result;
}

/** Plain-text preview (notification-style) — mentions collapse to "@Name". */
export function plainTextPreview(rawBody) {
    return rawBody.replace(MENTION_PATTERN, (_, name) => `@${name}`);
}
