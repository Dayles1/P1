import { escapeHtml } from '../../shared/forms';
import { t } from '../../shared/i18n';
import { icon } from '../../shared/icon';

/*
| Message text formatting, Telegram's markdown flavour:
|   **bold**  __italic__  ~~strike~~  `code`  ```lang\npre```  ||spoiler||
| plus @[Name](id) mentions and bare links. The raw text is escaped
| first; markup is only ever added around already-escaped text, and the
| only attribute values written are escaped too — nothing from the body
| reaches the page as HTML.
*/

const MENTION = /@\[([^\]]+)\]\((\d+)\)/g;
const CODE_BLOCK = /```([A-Za-z0-9_+#.-]{0,20})[ \t]*\n?([\s\S]*?)```/g;
const INLINE_CODE = /`([^`\n]+)`/g;
const STASH = /\uE000(\d+)\uE000/g;

function linkHtml(href, label) {
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

/**
 * Bare links in escaped text: http(s)://… and www.… An entity such as
 * &quot; ends a link, and trailing punctuation stays outside it.
 */
function linkify(escaped, stash) {
    return escaped.replace(
        /(^|[\s(>\uE000])((?:https?:\/\/|www\.)(?:(?!&quot;|&#39;|&lt;|&gt;)[^\s<\uE000])+)/gi,
        (whole, lead, url) => {
            const trail = url.match(/(?:[.,;:!?)\]]|&amp;)+$/)?.[0] ?? '';
            const clean = trail ? url.slice(0, -trail.length) : url;
            const href = /^www\./i.test(clean) ? `https://${clean}` : clean;

            stash.push(linkHtml(href, clean));

            return `${lead}\uE000${stash.length - 1}\uE000${trail}`;
        },
    );
}

function inlineMarkup(escaped) {
    return escaped
        .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
        .replace(/__(?=\S)([\s\S]*?\S)__/g, '<em>$1</em>')
        .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<s>$1</s>')
        .replace(
            /\|\|(?=\S)([\s\S]*?\S)\|\|/g,
            '<span class="chat-spoiler" data-spoiler tabindex="0">$1</span>',
        );
}

/** Plain text (no code) → HTML with mentions, links and inline markup. */
function renderText(raw, stash) {
    const withLinks = raw.replace(
        /\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]+)\)/g,
        (_, label, href) => {
            stash.push(linkHtml(escapeHtml(href), escapeHtml(label)));

            return `\uE000${stash.length - 1}\uE000`;
        },
    );
    const withMentions = withLinks.replace(MENTION, (_, name, id) => {
        stash.push(
            `<span class="mention-chip" data-user-id="${escapeHtml(id)}">@${escapeHtml(name)}</span>`,
        );

        return `\uE000${stash.length - 1}\uE000`;
    });

    return inlineMarkup(linkify(escapeHtml(withMentions), stash));
}

function renderInline(raw, stash) {
    let html = '';
    let last = 0;

    INLINE_CODE.lastIndex = 0;

    for (const match of raw.matchAll(INLINE_CODE)) {
        html += renderText(raw.slice(last, match.index), stash);
        html += `<code class="chat-inline-code">${escapeHtml(match[1])}</code>`;
        last = match.index + match[0].length;
    }

    return html + renderText(raw.slice(last), stash);
}

function codeBlockHtml(language, code) {
    const label = language || t('chat.format.code');

    return `<div class="chat-code"><div class="chat-code__head"><span class="mono">${escapeHtml(label)}</span><button type="button" class="chat-code__copy" data-copy-code>${icon('copy', { size: 13 })}<span>${escapeHtml(t('chat.copy'))}</span></button></div><pre class="chat-code__pre"><code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre></div>`;
}

/** A message body as safe HTML. */
export function renderRichText(raw) {
    const body = String(raw ?? '');
    const stash = [];
    let html = '';
    let last = 0;

    CODE_BLOCK.lastIndex = 0;

    for (const match of body.matchAll(CODE_BLOCK)) {
        html += renderInline(body.slice(last, match.index), stash);
        html += codeBlockHtml(match[1], match[2]);
        last = match.index + match[0].length;
    }

    html += renderInline(body.slice(last), stash);

    // Stashed pieces may hold stashed pieces (a link label), so repeat.
    for (let i = 0; i < 3 && html.includes('\uE000'); i += 1) {
        html = html.replace(STASH, (_, index) => stash[Number(index)] ?? '');
    }

    return html;
}

/** One line of plain text: mentions as @Name, markup characters dropped. */
export function plainText(raw) {
    return String(raw ?? '')
        .replace(MENTION, (_, name) => `@${name}`)
        .replace(/\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]+)\)/g, '$1')
        .replace(/```[A-Za-z0-9_+#.-]*\n?/g, '')
        .replace(/\*\*|__|~~|\|\||`/g, '');
}

/** Only emoji (1–3 of them): shown large, as in Telegram. */
export function isEmojiOnly(raw) {
    const text = String(raw ?? '').trim();

    if (!text || text.length > 24) {
        return false;
    }

    const emoji = text.match(
        /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/gu,
    );

    return (
        Boolean(emoji) &&
        emoji.length <= 3 &&
        text.replace(/\s/g, '') === emoji.join('')
    );
}

/**
 * Wraps the textarea selection in a marker (Ctrl+B and friends); with
 * nothing selected the markers go around the caret.
 */
export function wrapSelection(textarea, before, after = before) {
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start;
    const value = textarea.value;
    const selected = value.slice(start, end);

    textarea.value =
        value.slice(0, start) + before + selected + after + value.slice(end);
    textarea.setSelectionRange(
        start + before.length,
        start + before.length + selected.length,
    );
    textarea.focus();
}
