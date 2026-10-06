import { api } from '../../axios';
import { avatarHue, avatarMedia, initials } from '../../shared/auth-state';
import { escapeHtml } from '../../shared/forms';
import { t, tChoice } from '../../shared/i18n';
import { icon } from '../../shared/icon';
import { openModal } from '../../shared/modal';
import { apiErrorMessage } from '../../shared/toast';
import { plainText } from './format';
import { kindLabel, messagePreview } from './message-parts';
import { formatDateTime, formatDuration, formatSize } from './time';

/*
| "Подробно": everything known about one message, one file, or the chat
| itself, in a dialog. The data comes from the server
| (`GET …/messages/{m}/info`, `GET /conversations/{c}`), so it covers
| readers and versions this page never saw.
*/

function avatar(person, size = 'sm') {
    const name = person?.name || '';
    const hue = person?.avatar ? '' : `avatar--hue-${avatarHue(name)}`;
    const inner = person?.avatar
        ? avatarMedia(person.avatar, name)
        : `<span class="avatar__initials">${escapeHtml(initials(name))}</span>`;

    return `<span class="avatar avatar--${size} ${hue}">${inner}</span>`;
}

function personRow(person, when = '', extra = '') {
    return `
        <li class="chat-info-row">
            ${avatar(person)}
            <span class="chat-info-row__name">${escapeHtml(person?.name || t('common.unknown'))}${extra}</span>
            ${when ? `<span class="mono chat-info-row__time">${escapeHtml(when)}</span>` : ''}
        </li>
    `;
}

function section(title, body, { count = null } = {}) {
    return `
        <section class="chat-info-section">
            <h3 class="chat-info-section__title">${escapeHtml(title)}${count !== null ? ` <span class="mono chat-info-section__count">${escapeHtml(count)}</span>` : ''}</h3>
            ${body}
        </section>
    `;
}

function facts(rows) {
    const visible = rows.filter(([, value]) => value);

    if (!visible.length) {
        return '';
    }

    return `<dl class="chat-info-facts chat-info-facts--dialog">${visible
        .map(
            ([label, value]) =>
                `<dt>${escapeHtml(label)}</dt><dd>${value}</dd>`,
        )
        .join('')}</dl>`;
}

function dimensions(attachment) {
    return attachment.width && attachment.height
        ? `${Number(attachment.width)}×${Number(attachment.height)}`
        : '';
}

function attachmentFacts(attachment) {
    return facts([
        [
            t('chat.msg_info.file_name'),
            `<a href="${escapeHtml(attachment.url)}" target="_blank" rel="noopener">${escapeHtml(attachment.original_name || '')}</a>`,
        ],
        [
            t('chat.msg_info.file_type'),
            escapeHtml(
                [kindLabel(attachment.kind, ''), attachment.mime_type]
                    .filter(Boolean)
                    .join(' · '),
            ),
        ],
        [t('chat.msg_info.file_size'), escapeHtml(formatSize(attachment.size))],
        [t('chat.msg_info.dimensions'), escapeHtml(dimensions(attachment))],
        [
            t('chat.msg_info.duration'),
            attachment.duration
                ? escapeHtml(formatDuration(Number(attachment.duration)))
                : '',
        ],
        [
            t('chat.msg_info.uploaded'),
            escapeHtml(formatDateTime(attachment.created_at_iso)),
        ],
    ]);
}

function readsHtml(info, { isPrivate, isMine }) {
    const reads = info.reads || [];
    const unread = info.unread_by || [];

    if (info.message?.type === 'system') {
        return '';
    }

    if (isPrivate) {
        if (!isMine) {
            return '';
        }

        const read = reads[0];

        return section(
            t('chat.msg_info.delivery'),
            `<p class="chat-info-line">${icon(read ? 'checks' : 'check', { size: 14 })}${escapeHtml(
                read
                    ? read.read_at_iso
                        ? t('chat.msg_info.read_at', {
                              time: formatDateTime(read.read_at_iso),
                          })
                        : t('chat.msg_info.read_no_time')
                    : t('chat.msg_info.not_read'),
            )}</p>`,
        );
    }

    return `
        ${section(
            t('chat.msg_info.read_by'),
            reads.length
                ? `<ul class="chat-info-list">${reads
                      .map((read) =>
                          personRow(
                              read.user,
                              read.read_at_iso
                                  ? formatDateTime(read.read_at_iso)
                                  : t('chat.msg_info.read_no_time'),
                          ),
                      )
                      .join('')}</ul>`
                : `<p class="chat-info-empty">${escapeHtml(t('chat.msg_info.nobody_read'))}</p>`,
            { count: reads.length },
        )}
        ${
            unread.length
                ? section(
                      t('chat.msg_info.not_read_by'),
                      `<ul class="chat-info-list">${unread.map((person) => personRow(person)).join('')}</ul>`,
                      { count: unread.length },
                  )
                : ''
        }
    `;
}

function editsHtml(info) {
    const edits = info.edits || { count: 0, history: [] };

    if (!edits.count) {
        return '';
    }

    const versions = (edits.history || [])
        .map(
            (edit, index) => `
                <li class="chat-info-version">
                    <div class="chat-info-version__meta">
                        <span>${escapeHtml(t('chat.msg_info.version', { number: index + 1 }))}</span>
                        <span class="mono">${escapeHtml(formatDateTime(edit.edited_at_iso))}</span>
                        ${edit.editor ? `<span>· ${escapeHtml(t('chat.msg_info.edited_by', { name: edit.editor.name }))}</span>` : ''}
                    </div>
                    <div class="chat-info-version__body">${escapeHtml(plainText(edit.previous_body || '')) || `<i>${escapeHtml(t('chat.msg_info.empty_body'))}</i>`}</div>
                </li>
            `,
        )
        .join('');

    return section(
        t('chat.msg_info.edits'),
        `
            <p class="chat-info-line">${escapeHtml(
                tChoice('chat.msg_info.edits_count', edits.count),
            )}${edits.last_edited_at_iso ? ` · ${escapeHtml(t('chat.msg_info.last_edit', { time: formatDateTime(edits.last_edited_at_iso) }))}` : ''}</p>
            <ol class="chat-info-versions">${versions}
                <li class="chat-info-version chat-info-version--current">
                    <div class="chat-info-version__meta"><span>${escapeHtml(t('chat.msg_info.current_version'))}</span></div>
                    <div class="chat-info-version__body">${escapeHtml(plainText(info.message?.body || ''))}</div>
                </li>
            </ol>
        `,
        { count: edits.count },
    );
}

function reactionsHtml(info) {
    const reactions = info.reactions || [];

    if (!reactions.length) {
        return '';
    }

    return section(
        t('chat.msg_info.reactions'),
        reactions
            .map(
                (reaction) => `
                    <div class="chat-info-reaction">
                        <span class="chat-info-reaction__emoji">${escapeHtml(reaction.emoji)}</span>
                        <ul class="chat-info-list">${(reaction.users || [])
                            .map((user) =>
                                personRow(
                                    user,
                                    formatDateTime(user.reacted_at_iso),
                                ),
                            )
                            .join('')}</ul>
                    </div>
                `,
            )
            .join(''),
        {
            count: reactions.reduce(
                (sum, reaction) => sum + (reaction.users?.length || 0),
                0,
            ),
        },
    );
}

function pollVotersHtml(info) {
    const voters = info.poll_voters;
    const poll = info.message?.poll;

    if (!poll) {
        return '';
    }

    if (!voters) {
        return section(
            t('chat.msg_info.poll'),
            `<p class="chat-info-empty">${escapeHtml(t('chat.poll.anonymous_hint'))}</p>`,
        );
    }

    return section(
        t('chat.msg_info.poll'),
        voters
            .map((group) => {
                const option = poll.options.find(
                    (o) => Number(o.id) === Number(group.option_id),
                );

                return `
                    <div class="chat-info-reaction">
                        <span class="chat-info-reaction__label">${escapeHtml(option?.text || '')} <span class="mono">${group.users.length}</span></span>
                        ${
                            group.users.length
                                ? `<ul class="chat-info-list">${group.users
                                      .map((user) =>
                                          personRow(
                                              user,
                                              formatDateTime(user.voted_at_iso),
                                          ),
                                      )
                                      .join('')}</ul>`
                                : ''
                        }
                    </div>
                `;
            })
            .join(''),
    );
}

function messageInfoHtml(info, { conversation, currentUserId }) {
    const message = info.message || {};
    const isPrivate = conversation?.type === 'private';
    const isMine = String(message.sender?.id) === String(currentUserId);
    const forwarded = info.forwarded_from;
    const reply = info.reply_to;

    const main = facts([
        [
            t('chat.msg_info.sent'),
            `<span class="mono">${escapeHtml(formatDateTime(info.sent_at_iso))}</span>`,
        ],
        [
            t('chat.msg_info.sender'),
            info.sender ? escapeHtml(info.sender.name) : '',
        ],
        [
            t('chat.msg_info.type'),
            escapeHtml(t(`chat.msg_info.type_${message.type || 'text'}`)),
        ],
        [
            t('chat.msg_info.pinned'),
            info.pinned
                ? escapeHtml(
                      [
                          formatDateTime(info.pinned.pinned_at_iso),
                          info.pinned.by
                              ? t('chat.msg_info.by', {
                                    name: info.pinned.by.name,
                                })
                              : '',
                      ]
                          .filter(Boolean)
                          .join(' · '),
                  )
                : '',
        ],
        [
            t('chat.msg_info.forwarded'),
            forwarded
                ? escapeHtml(
                      [
                          forwarded.sender_name,
                          forwarded.conversation_title,
                          formatDateTime(forwarded.created_at_iso),
                      ]
                          .filter(Boolean)
                          .join(' · '),
                  )
                : '',
        ],
        [
            t('chat.msg_info.reply_to'),
            reply
                ? `<button type="button" class="chat-info-link-btn" data-info-jump="${Number(reply.id)}">${escapeHtml(`${reply.sender_name || ''}: ${reply.body ? plainText(reply.body) : kindLabel(reply.attachment_kind)}`)}</button>`
                : '',
        ],
    ]);

    return `
        <div class="chat-info-dialog">
            <blockquote class="chat-info-quote">${escapeHtml(messagePreview(message)) || '—'}</blockquote>
            ${main}
            ${readsHtml(info, { isPrivate, isMine })}
            ${editsHtml(info)}
            ${reactionsHtml(info)}
            ${pollVotersHtml(info)}
            ${
                (info.attachments || []).length
                    ? section(
                          t('chat.msg_info.attachments'),
                          info.attachments
                              .map(
                                  (attachment) =>
                                      `<div class="chat-info-attachment">${attachmentFacts(attachment)}</div>`,
                              )
                              .join(''),
                          { count: info.attachments.length },
                      )
                    : ''
            }
        </div>
    `;
}

function loadingHtml() {
    return '<div class="chat-info-dialog"><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div></div>';
}

function errorHtml(error) {
    return `<div class="chat-info-dialog"><p class="chat-info-empty">${escapeHtml(apiErrorMessage(error, t('common.error_generic')))}</p></div>`;
}

/**
 * The details of one message. `onJump(messageId)` is called when the
 * quoted message is clicked.
 */
export async function openMessageInfo({
    conversation,
    messageId,
    currentUserId,
    onJump,
    attachmentId = null,
}) {
    const { modal, close } = openModal({
        title: attachmentId
            ? t('chat.msg_info.file_title')
            : t('chat.msg_info.title'),
        bodyHtml: loadingHtml(),
    });
    const body = modal.querySelector('.modal__body');
    modal.classList.add('chat-info-modal');

    body.addEventListener('click', (event) => {
        const jump = event.target.closest('[data-info-jump]');

        if (jump) {
            close();
            onJump?.(Number(jump.dataset.infoJump));
        }
    });

    try {
        const { data } = await api.get(
            `/conversations/${conversation.id}/messages/${messageId}/info`,
        );
        const info = data.data;

        if (attachmentId) {
            const attachment = (info.attachments || []).find(
                (a) => String(a.id) === String(attachmentId),
            );

            body.innerHTML = attachment
                ? `<div class="chat-info-dialog">${attachmentFacts(attachment)}${facts(
                      [
                          [
                              t('chat.msg_info.sender'),
                              escapeHtml(info.sender?.name || ''),
                          ],
                          [
                              t('chat.msg_info.sent'),
                              `<span class="mono">${escapeHtml(formatDateTime(info.sent_at_iso))}</span>`,
                          ],
                      ],
                  )}
                  <a class="btn btn--outline btn--sm" href="${escapeHtml(attachment.url)}" download="${escapeHtml(attachment.original_name || '')}">${icon('download', { size: 14 })}${escapeHtml(t('chat.download'))}</a></div>`
                : errorHtml(null);

            return;
        }

        body.innerHTML = messageInfoHtml(info, { conversation, currentUserId });
    } catch (error) {
        body.innerHTML = errorHtml(error);
    }
}

/** The details of the chat itself: created when and by whom, members, stats. */
export async function openConversationInfo({ conversation, title }) {
    const { modal } = openModal({
        title: t('chat.conv_info.title'),
        bodyHtml: loadingHtml(),
    });
    const body = modal.querySelector('.modal__body');
    modal.classList.add('chat-info-modal');

    try {
        const [{ data: show }, { data: membersData }] = await Promise.all([
            api.get(`/conversations/${conversation.id}`),
            api.get(`/conversations/${conversation.id}/members`, {
                params: { per_page: 100 },
            }),
        ]);
        const info = show.data;
        const members = membersData.data || [];
        const stats = info.stats || {};

        body.innerHTML = `
            <div class="chat-info-dialog">
                <blockquote class="chat-info-quote">${escapeHtml(title || info.title || '')}</blockquote>
                ${facts([
                    [
                        t('chat.conv_info.type'),
                        escapeHtml(t(`chat.conv_info.type_${info.type}`)),
                    ],
                    [
                        t('chat.conv_info.created'),
                        `<span class="mono">${escapeHtml(formatDateTime(info.created_at_iso))}</span>`,
                    ],
                    [
                        t('chat.conv_info.creator'),
                        info.creator ? escapeHtml(info.creator.name) : '',
                    ],
                    [
                        t('chat.conv_info.description'),
                        info.description ? escapeHtml(info.description) : '',
                    ],
                    [
                        t('chat.conv_info.my_role'),
                        info.my_role
                            ? escapeHtml(
                                  t(
                                      `chat.group.role_${info.my_role === 'owner' ? 'creator' : info.my_role}`,
                                  ),
                              )
                            : '',
                    ],
                ])}
                ${section(
                    t('chat.conv_info.stats'),
                    facts(
                        ['messages', 'media', 'files', 'voice', 'links'].map(
                            (key) => [
                                t(`chat.conv_info.stat_${key}`),
                                `<span class="mono">${Number(stats[key] || 0)}</span>`,
                            ],
                        ),
                    ),
                )}
                ${section(
                    t('chat.members'),
                    `<ul class="chat-info-list">${members
                        .map((member) =>
                            personRow(
                                member,
                                member.joined_at_iso
                                    ? t('chat.conv_info.joined', {
                                          time: formatDateTime(
                                              member.joined_at_iso,
                                              {
                                                  seconds: false,
                                              },
                                          ),
                                      })
                                    : '',
                                member.role && member.role !== 'member'
                                    ? ` <span class="chat-member__role">${escapeHtml(t(`chat.group.role_${member.role === 'owner' ? 'creator' : member.role}`))}</span>`
                                    : '',
                            ),
                        )
                        .join('')}</ul>`,
                    { count: info.members_count },
                )}
            </div>
        `;
    } catch (error) {
        body.innerHTML = errorHtml(error);
    }
}
