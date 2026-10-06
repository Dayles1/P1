import { escapeHtml } from '../../shared/forms';
import { t, tChoice } from '../../shared/i18n';
import { icon } from '../../shared/icon';
import { plainText } from './format';
import { formatDuration, formatSize } from './time';

/*
| The pieces of a message card that are not its text: attachments (an
| album of photos, inline video, voice, audio, files), the forwarded-from
| line, a link preview, a poll, and the sentence a service message reads
| as. Every value is escaped; sizes go into inline styles only as numbers.
*/

export function attachmentKind(attachment) {
    if (attachment.kind) {
        return attachment.kind;
    }

    const mime = attachment.mime_type || '';

    if (mime.startsWith('image/')) {
        return 'image';
    }

    if (mime.startsWith('video/')) {
        return 'video';
    }

    if (mime.startsWith('audio/')) {
        return /voice-/.test(attachment.original_name || '')
            ? 'voice'
            : 'audio';
    }

    return 'file';
}

/** What a message reads as in one line (list, reply quote, pins). */
export function messagePreview(message) {
    if (!message) {
        return '';
    }

    if (message.type === 'system') {
        return systemText(message);
    }

    if (message.type === 'poll' && message.poll) {
        return `📊 ${message.poll.question}`;
    }

    if (message.body) {
        return plainText(message.body);
    }

    const attachment = message.attachments?.[0];

    if (!attachment) {
        return t('chat.attachment_preview');
    }

    return kindLabel(attachmentKind(attachment), attachment.original_name);
}

export function kindLabel(kind, name = '') {
    switch (kind) {
        case 'image':
            return t('chat.photo');
        case 'video':
            return t('chat.video');
        case 'voice':
            return t('chat.voice_message');
        case 'audio':
            return t('chat.audio');
        default:
            return name || t('chat.attachment_preview');
    }
}

/** Deterministic bar heights for a voice message's waveform. */
function waveBars(seed, count = 34) {
    let value = Number(String(seed).replace(/\D/g, '').slice(-6)) || 7;

    return Array.from({ length: count }, () => {
        value = (value * 9301 + 49297) % 233280;

        return 6 + Math.round((value / 233280) * 18);
    });
}

function voiceHtml(attachment) {
    const duration = Number(attachment.duration) || 0;

    return `
        <div class="chat-audio" data-audio="${escapeHtml(attachment.url)}" data-duration="${duration}" data-attachment-id="${escapeHtml(attachment.id)}">
            <button type="button" class="chat-audio__play" data-audio-toggle aria-label="${escapeHtml(t('chat.play'))}">${icon('play-fill', { size: 14 })}</button>
            <span class="chat-audio__wave" data-audio-seek aria-hidden="true">${waveBars(
                attachment.id,
            )
                .map((h) => `<i style="height:${h}px"></i>`)
                .join('')}</span>
            <span class="mono chat-audio__time" data-audio-time>${escapeHtml(formatDuration(duration))}</span>
            <button type="button" class="mono chat-audio__speed" data-audio-speed>1×</button>
        </div>
    `;
}

function extensionOf(name) {
    const parts = String(name || '').split('.');

    return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

export function fileHtml(attachment) {
    const extension = extensionOf(attachment.original_name);
    const meta = [
        formatSize(attachment.size),
        attachment.duration ? formatDuration(attachment.duration) : '',
    ]
        .filter(Boolean)
        .join(' · ');

    return `
        <div class="chat-attachment-file chat-attachment-file--${escapeHtml(fileTone(extension))}" data-attachment-id="${escapeHtml(attachment.id)}">
            <span class="chat-attachment-file__badge">${escapeHtml((extension || t('chat.file_badge')).slice(0, 4))}</span>
            <span class="chat-attachment-file__body">
                <a class="chat-attachment-file__name" href="${escapeHtml(attachment.url)}" target="_blank" rel="noopener">${escapeHtml(attachment.original_name || '')}</a>
                <span class="mono chat-attachment-file__size">${escapeHtml(meta)}</span>
            </span>
            <a class="chat-attachment-file__download" href="${escapeHtml(attachment.url)}" download="${escapeHtml(attachment.original_name || '')}" aria-label="${escapeHtml(t('chat.download'))}" title="${escapeHtml(t('chat.download'))}">${icon('download', { size: 15 })}</a>
        </div>
    `;
}

function fileTone(extension) {
    if (['pdf'].includes(extension)) {
        return 'red';
    }

    if (['xls', 'xlsx', 'csv'].includes(extension)) {
        return 'green';
    }

    if (['doc', 'docx', 'txt', 'rtf'].includes(extension)) {
        return 'blue';
    }

    if (['zip', 'rar', '7z'].includes(extension)) {
        return 'amber';
    }

    return 'grey';
}

function audioFileHtml(attachment) {
    return `
        <div class="chat-audio-file" data-attachment-id="${escapeHtml(attachment.id)}">
            ${fileHtml(attachment)}
            <audio class="chat-audio-file__player" controls preload="none" src="${escapeHtml(attachment.url)}"></audio>
        </div>
    `;
}

function videoHtml(attachment) {
    const width = Number(attachment.width) || 0;
    const height = Number(attachment.height) || 0;
    const ratio =
        width && height ? `style="aspect-ratio:${width}/${height}"` : '';

    return `
        <div class="chat-video" data-attachment-id="${escapeHtml(attachment.id)}">
            <video class="chat-video__player" src="${escapeHtml(attachment.url)}" controls preload="metadata" playsinline ${width ? `width="${width}"` : ''} ${height ? `height="${height}"` : ''} ${ratio}></video>
        </div>
    `;
}

/**
 * Photos: one keeps its own proportions (so the row's height is known
 * before it loads and the thread does not jump); several make a grid.
 */
function albumHtml(images) {
    const count = images.length;

    return `
        <div class="chat-album chat-album--${count === 1 ? 'single' : count === 2 || count === 4 ? 'two' : 'three'}">
            ${images
                .map((image) => {
                    const width = Number(image.width) || 0;
                    const height = Number(image.height) || 0;
                    const sized =
                        count === 1 && width && height
                            ? `width="${width}" height="${height}" style="aspect-ratio:${width}/${height}"`
                            : '';

                    return `<button type="button" class="chat-album__item" data-lightbox="${escapeHtml(image.url)}" data-attachment-id="${escapeHtml(image.id)}"><img class="chat-attachment-image" src="${escapeHtml(image.url)}" alt="${escapeHtml(image.original_name || '')}" loading="lazy" decoding="async" ${sized}></button>`;
                })
                .join('')}
        </div>
    `;
}

export function attachmentsHtml(message) {
    const attachments = message.attachments || [];

    if (!attachments.length) {
        return '';
    }

    const images = attachments.filter((a) => attachmentKind(a) === 'image');
    const rest = attachments.filter((a) => attachmentKind(a) !== 'image');

    return `
        <div class="chat-card__attachments">
            ${images.length ? albumHtml(images) : ''}
            ${rest
                .map((attachment) => {
                    switch (attachmentKind(attachment)) {
                        case 'video':
                            return videoHtml(attachment);
                        case 'voice':
                            return voiceHtml(attachment);
                        case 'audio':
                            return audioFileHtml(attachment);
                        default:
                            return fileHtml(attachment);
                    }
                })
                .join('')}
        </div>
    `;
}

export function forwardedHtml(message) {
    const from = message.forwarded_from;

    if (!from) {
        return '';
    }

    const where =
        from.conversation_title && from.conversation_title !== from.sender_name
            ? ` · ${escapeHtml(from.conversation_title)}`
            : '';

    return `
        <div class="chat-card__forwarded">
            ${icon('forward', { size: 12 })}
            <span>${escapeHtml(t('chat.forwarded_from'))}</span>
            <b ${from.sender_id ? `data-profile-user="${Number(from.sender_id)}" role="button" tabindex="0"` : ''}>${escapeHtml(from.sender_name || t('common.unknown'))}</b>${where}
        </div>
    `;
}

function hostOf(url) {
    try {
        return new URL(url).host;
    } catch {
        return url;
    }
}

export function linkPreviewHtml(message) {
    const preview = message.link_preview;

    if (!preview?.url || !/^https?:\/\//i.test(preview.url)) {
        return '';
    }

    const image =
        preview.image_url && /^https?:\/\//i.test(preview.image_url)
            ? `<img class="chat-link-preview__image" src="${escapeHtml(preview.image_url)}" alt="" loading="lazy">`
            : `<span class="chat-link-preview__icon">${icon('link', { size: 18 })}</span>`;

    return `
        <a class="chat-link-preview" href="${escapeHtml(preview.url)}" target="_blank" rel="noopener noreferrer">
            <span class="chat-link-preview__body">
                <span class="chat-link-preview__site">${escapeHtml(preview.site_name || hostOf(preview.url))}</span>
                ${preview.title ? `<span class="chat-link-preview__title">${escapeHtml(preview.title)}</span>` : ''}
                ${preview.description ? `<span class="chat-link-preview__text">${escapeHtml(preview.description)}</span>` : ''}
            </span>
            ${image}
        </a>
    `;
}

/** The sentence a service message reads as. */
export function systemText(message) {
    const system = message.system || {};
    const params = system.params || {};
    const actor = system.actor?.name || message.sender?.name || '';
    const names = Array.isArray(params.names)
        ? params.names.join(', ')
        : params.names || params.name || '';
    const key = `chat.system.${system.event || 'unknown'}`;
    const text = t(key, {
        actor,
        title: params.title ?? '',
        name: names,
        names,
        description: params.description ?? '',
        preview: params.preview ? plainText(params.preview) : '',
    });

    return text === key
        ? message.body || t('chat.system.unknown', { actor })
        : text;
}

export function systemHtml(message) {
    const event = message.system?.event || '';
    const target =
        event === 'message_pinned' && message.system?.params?.message_id
            ? `data-scroll-to="${Number(message.system.params.message_id)}"`
            : '';

    return `
        <div class="chat-system" data-message-id="${escapeHtml(message.id)}">
            <span class="chat-system__pill" ${target}>${escapeHtml(systemText(message))}</span>
        </div>
    `;
}

/**
 * A poll. Before voting (and while open) the options are buttons; after
 * voting, or once closed, each shows its share. With `multiple` the picks
 * are collected and sent with the "Vote" button.
 */
export function pollHtml(message, { canClose = false, picked = [] } = {}) {
    const poll = message.poll;

    if (!poll) {
        return '';
    }

    const myVotes = (poll.my_votes || []).map(Number);
    const voted = myVotes.length > 0;
    const showResults = voted || poll.closed;
    const total = Number(poll.total_voters) || 0;
    const votes =
        poll.options.reduce((sum, o) => sum + (Number(o.votes) || 0), 0) || 1;

    const meta = [
        tChoice('chat.poll.voters', total),
        poll.anonymous ? t('chat.poll.anonymous') : t('chat.poll.public'),
        poll.multiple ? t('chat.poll.multiple') : '',
        poll.closed ? t('chat.poll.closed') : '',
    ]
        .filter(Boolean)
        .join(' · ');

    const options = poll.options
        .map((option) => {
            const id = Number(option.id);
            const count = Number(option.votes) || 0;
            const percent = Math.round((count / votes) * 100);
            const mine = myVotes.includes(id);
            const isPicked = picked.map(Number).includes(id);

            if (showResults) {
                return `
                    <div class="chat-poll__option chat-poll__option--result ${mine ? 'chat-poll__option--mine' : ''}">
                        <span class="chat-poll__bar" style="width:${percent}%"></span>
                        <span class="chat-poll__text">${mine ? icon('check', { size: 13 }) : ''}${escapeHtml(option.text)}</span>
                        <span class="mono chat-poll__count">${percent}% · ${count}</span>
                    </div>
                `;
            }

            return `
                <button type="button" class="chat-poll__option ${isPicked ? 'chat-poll__option--picked' : ''}" data-poll-option="${id}" aria-pressed="${isPicked}">
                    <span class="chat-poll__radio ${poll.multiple ? 'chat-poll__radio--check' : ''}">${isPicked ? icon('check', { size: 11 }) : ''}</span>
                    <span class="chat-poll__text">${escapeHtml(option.text)}</span>
                </button>
            `;
        })
        .join('');

    const actions = [
        !showResults && poll.multiple
            ? `<button type="button" class="btn btn--primary btn--sm" data-poll-vote ${picked.length ? '' : 'disabled'}>${escapeHtml(t('chat.poll.vote'))}</button>`
            : '',
        voted && !poll.closed
            ? `<button type="button" class="btn btn--ghost btn--sm" data-poll-retract>${escapeHtml(t('chat.poll.retract'))}</button>`
            : '',
        canClose && !poll.closed
            ? `<button type="button" class="btn btn--ghost btn--sm" data-poll-close>${escapeHtml(t('chat.poll.close'))}</button>`
            : '',
    ]
        .filter(Boolean)
        .join('');

    return `
        <div class="chat-poll" data-poll="${escapeHtml(message.id)}">
            <div class="chat-poll__head">${icon('poll', { size: 14 })}<span class="chat-poll__question">${escapeHtml(poll.question)}</span></div>
            <div class="chat-poll__meta">${escapeHtml(meta)}</div>
            <div class="chat-poll__options">${options}</div>
            ${actions ? `<div class="chat-poll__actions">${actions}</div>` : ''}
        </div>
    `;
}
