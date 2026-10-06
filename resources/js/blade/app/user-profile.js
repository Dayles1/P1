import { api } from '../axios';
import { getState } from '../shared/app-state';
import { avatarHue, avatarMedia, initials } from '../shared/auth-state';
import { confirmDialog } from '../shared/confirm';
import { escapeHtml } from '../shared/forms';
import { getLocale, t, tChoice } from '../shared/i18n';
import { icon } from '../shared/icon';
import { openModal } from '../shared/modal';
import { isWatchingOnline, toggleOnlineWatch } from '../shared/online-watch';
import { bootOnPage } from '../shared/page-boot';
import { initPresence, isOnline, onPresenceChange } from '../shared/presence';
import { emptyState, skeletonRows } from '../shared/skeleton';
import { apiErrorMessage, showToast } from '../shared/toast';

/*
|--------------------------------------------------------------------------
| Formatting
|--------------------------------------------------------------------------
*/

/** "16:40 · Tashkent" — the time now where the person is, or null. */
function localTime(timeZone) {
    if (!timeZone) {
        return null;
    }

    try {
        const time = new Intl.DateTimeFormat(getLocale(), {
            hour: '2-digit',
            minute: '2-digit',
            timeZone,
        }).format(new Date());

        return t('profile_page.local_time', {
            time,
            zone: timeZone.split('/').pop().replace(/_/g, ' '),
        });
    } catch {
        return null;
    }
}

/** "Был(а) в сети 12:40" / "… 3 сент.", from an ISO stamp. */
function lastSeen(iso) {
    if (!iso) {
        return t('chat.offline');
    }

    const date = new Date(iso);
    const sameDay = date.toDateString() === new Date().toDateString();

    return t('chat.last_seen', {
        time: sameDay
            ? date.toLocaleTimeString(getLocale(), {
                  hour: '2-digit',
                  minute: '2-digit',
              })
            : date.toLocaleDateString(getLocale(), {
                  day: 'numeric',
                  month: 'short',
              }),
    });
}

/** "вчера", "20 сент.", "12:40" — how the Recent list dates events. */
function eventDate(iso) {
    if (!iso) {
        return '';
    }

    const date = new Date(iso);
    const today = new Date();
    const days = Math.round(
        (new Date(today.toDateString()) - new Date(date.toDateString())) /
            86400000,
    );

    if (days === 0) {
        return date.toLocaleTimeString(getLocale(), {
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    if (days === 1) {
        try {
            return new Intl.RelativeTimeFormat(getLocale(), {
                numeric: 'auto',
            }).format(-1, 'day');
        } catch {
            // fall through to the date
        }
    }

    return date.toLocaleDateString(getLocale(), {
        day: 'numeric',
        month: 'short',
        ...(date.getFullYear() === today.getFullYear()
            ? {}
            : { year: 'numeric' }),
    });
}

function longDate(iso) {
    if (!iso) {
        return null;
    }

    return new Date(iso).toLocaleDateString(getLocale(), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function languageName(locale) {
    if (!locale) {
        return null;
    }

    try {
        const name = new Intl.DisplayNames([getLocale()], {
            type: 'language',
        }).of(locale);

        return name ? name.charAt(0).toUpperCase() + name.slice(1) : locale;
    } catch {
        return locale.toUpperCase();
    }
}

function fileSize(bytes) {
    if (!Number.isFinite(bytes)) {
        return '';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;

    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }

    return `${unit === 0 ? value : Math.round(value * 10) / 10} ${units[unit]}`;
}

function firstName(name) {
    return (
        String(name || '')
            .trim()
            .split(/\s+/)[0] || ''
    );
}

function chatUrl(profile) {
    return profile.private_conversation_id
        ? `/chat/${profile.private_conversation_id}`
        : `/chat?user=${profile.id}`;
}

function goTo(url) {
    if (window.Turbo) {
        window.Turbo.visit(url);
    } else {
        window.location.href = url;
    }
}

async function copyText(text, message) {
    try {
        await navigator.clipboard.writeText(text);
        showToast(message);
    } catch {
        showToast(text, 'info');
    }
}

/*
|--------------------------------------------------------------------------
| Markup pieces
|--------------------------------------------------------------------------
*/

function avatarHtml(person, size = 'xs') {
    const name = person?.name || '';

    return `<span class="avatar avatar--${size}${person?.avatar ? '' : ` avatar--hue-${avatarHue(name)}`}" title="${escapeHtml(name)}">${
        person?.avatar
            ? avatarMedia(person.avatar, name)
            : `<span class="avatar__initials" aria-hidden="true">${escapeHtml(initials(name))}</span>`
    }</span>`;
}

function mediaTileHtml(attachment) {
    const url = attachment.url || '';
    const label = escapeHtml(attachment.original_name || '');
    const media =
        attachment.kind === 'video'
            ? `<span class="user-profile__tile-play">${icon('play-fill', { size: 18 })}</span>`
            : url
              ? `<img src="${escapeHtml(url)}" alt="${label}" loading="lazy" data-user-tile-image>`
              : '';

    return `<a class="user-profile__tile" href="${escapeHtml(url || '#')}" target="_blank" rel="noopener" title="${label}">${media}</a>`;
}

function fileRowHtml(attachment) {
    const kindIcon =
        attachment.kind === 'voice' || attachment.kind === 'audio'
            ? 'mic'
            : 'file';

    return `
        <a class="user-profile__file" href="${escapeHtml(attachment.url || '#')}" target="_blank" rel="noopener">
            <span class="user-profile__file-icon">${icon(kindIcon, { size: 12 })}</span>
            <span class="user-profile__file-name">${escapeHtml(attachment.original_name || '')}</span>
            <span class="mono user-profile__file-size">${escapeHtml(fileSize(attachment.size))}</span>
        </a>
    `;
}

function linkRowHtml(link) {
    const url = link.url || '';

    return `
        <a class="user-profile__file" href="${escapeHtml(url || `/chat/${link.conversation_id}`)}" target="_blank" rel="noopener">
            <span class="user-profile__file-icon">${icon('link', { size: 12 })}</span>
            <span class="user-profile__file-name">${escapeHtml(url || link.body || '')}</span>
            <span class="mono user-profile__file-size">${escapeHtml(eventDate(link.created_at_iso))}</span>
        </a>
    `;
}

function groupRowHtml(group, { wide = false } = {}) {
    const title = group.title || '';

    return `
        <a href="/chat/${escapeHtml(group.id)}" class="user-profile__group${wide ? ' user-profile__group--row' : ''}">
            ${
                wide
                    ? avatarHtml({ name: title, avatar: group.avatar }, 'sm')
                    : `<span class="user-profile__group-mark user-profile__group-mark--${avatarHue(title)}" aria-hidden="true"></span>`
            }
            <span class="user-profile__group-title">${escapeHtml(title)}</span>
            <span class="user-profile__group-count">${escapeHtml(tChoice('user_profile.members', group.members_count || 0))}</span>
        </a>
    `;
}

function eventHtml(event) {
    const conversation = event.conversation;
    const chatTitle =
        conversation?.type === 'private' || !conversation?.title
            ? t('user_profile.activity.private_chat')
            : conversation.title;
    const chat = conversation
        ? `<a class="user-profile__event-chat" href="/chat/${escapeHtml(conversation.id)}">${escapeHtml(chatTitle)}</a>`
        : '';
    const quote =
        event.kind === 'message' && event.text
            ? `<span class="user-profile__event-quote">«${escapeHtml(event.text)}»</span>`
            : '';

    return `
        <div class="user-profile__event">
            <span class="user-profile__event-dot" aria-hidden="true"></span>
            <div class="user-profile__event-body">
                <span class="user-profile__event-text">${escapeHtml(t(`user_profile.activity.${event.kind}`))} ${chat}</span>
                ${quote}
                <span class="mono user-profile__event-time">${escapeHtml(eventDate(event.at_iso))}</span>
            </div>
        </div>
    `;
}

function menuItem(action, iconName, label, { danger = false } = {}) {
    return `
        <button type="button" class="menu-item${danger ? ' menu-item--danger' : ''}" role="menuitem" data-user-menu="${action}">
            ${icon(iconName, { size: 14, className: 'menu-item__icon' })}
            <span>${escapeHtml(label)}</span>
        </button>
    `;
}

/*
|--------------------------------------------------------------------------
| Page
|--------------------------------------------------------------------------
|
| Someone's profile as everyone sees it, filled from /api/users/{id}:
| "Start chat" opens the private chat (the one that exists, or a new one
| from the chat page), the write card sends a first message right away,
| the "more" menu copies the link, adds them to one of your groups,
| watches for them coming online, reports and blocks.
|
*/

let stopPresence = null;
let controller = null;

function boot() {
    const root = document.querySelector('[data-user-profile-page]');
    const userId = root.dataset.userId;
    const el = (selector) => root.querySelector(selector);
    const nameEl = el('[data-user-name]');
    const avatarEl = el('[data-user-avatar]');
    const statusEl = el('[data-user-status]');
    const actionsEl = el('[data-user-actions]');
    const tabs = [...root.querySelectorAll('[data-user-tab]')];

    controller = new AbortController();
    const { signal } = controller;

    let profile = null;
    let filesKind = 'media';
    let filesPage = 1;
    let filesLoaded = false;

    /* ---------- Head ---------- */

    function renderStatus() {
        if (!profile) {
            return;
        }

        const online = isOnline(profile.id);

        avatarEl.querySelector('.avatar__status')?.remove();
        avatarEl.insertAdjacentHTML(
            'beforeend',
            `<span class="avatar__status${online ? ' avatar__status--online' : ''}"></span>`,
        );

        const time = localTime(profile.timezone);

        statusEl.innerHTML = [
            `<span class="user-profile__status-item"><span class="user-profile__dot${online ? ' user-profile__dot--online' : ''}" aria-hidden="true"></span>${escapeHtml(online ? t('profile_page.online') : lastSeen(profile.last_seen_at))}</span>`,
            time
                ? `<span class="user-profile__status-item">${icon('clock', { size: 12 })}${escapeHtml(time)}</span>`
                : '',
            profile.reply_time
                ? `<span class="user-profile__status-item">${icon('chat', { size: 12 })}${escapeHtml(t(`user_profile.reply_time.${profile.reply_time}`))}</span>`
                : '',
        ].join('');
    }

    function renderHead() {
        const name = profile.name || '';
        const hue = avatarHue(name);

        root.dataset.hue = hue;
        document.title = `${name} — ${document.title.split(' — ').pop()}`;

        const headerTitle = document.querySelector('[data-header-title]');

        if (headerTitle) {
            headerTitle.textContent = name;
        }

        nameEl.textContent = name;
        avatarEl.className = `avatar user-profile__avatar${profile.avatar ? '' : ` avatar--hue-${hue}`}`;
        avatarEl.innerHTML = profile.avatar
            ? avatarMedia(profile.avatar, name)
            : `<span class="avatar__initials" aria-hidden="true">${escapeHtml(initials(name))}</span>`;

        const roleEl = el('[data-user-role]');

        roleEl.hidden = !profile.role;
        roleEl.className = 'badge badge--primary';
        roleEl.textContent = profile.role || '';
        el('[data-user-banned]').hidden = !profile.is_banned;
        el('[data-user-blocked]').hidden = !profile.is_blocked;

        el('[data-user-position]').innerHTML = [
            profile.position
                ? `<span>${escapeHtml(profile.position)}</span>`
                : '',
            profile.position && profile.department
                ? '<span class="user-profile__department"> · </span>'
                : '',
            profile.department
                ? `<span class="user-profile__department">${escapeHtml(profile.department)}</span>`
                : '',
        ].join('');

        renderStatus();
        renderActions();
    }

    function renderActions() {
        if (profile.is_me) {
            actionsEl.innerHTML = `
                <a href="/settings/profile" class="btn btn--outline user-profile__action--wide">${icon('edit', { size: 15 })}<span class="user-profile__action-label">${escapeHtml(t('profile_page.edit'))}</span></a>
            `;

            return;
        }

        const watching = isWatchingOnline(profile.id);
        const primary = profile.is_blocked
            ? `<button type="button" class="btn btn--primary" data-user-menu="unblock">${icon('ban', { size: 15 })} ${escapeHtml(t('user_profile.menu.unblock'))}</button>`
            : `<a href="${escapeHtml(chatUrl(profile))}" class="btn btn--primary">${icon('chat', { size: 15 })} ${escapeHtml(t('user_profile.start_chat'))}</a>`;
        const call = profile.phone
            ? `<a href="tel:${escapeHtml(String(profile.phone).replace(/[^\d+]/g, ''))}" class="btn btn--outline" aria-label="${escapeHtml(t('user_profile.call'))}">${icon('callp', { size: 15 })}<span class="user-profile__action-label">${escapeHtml(t('user_profile.call'))}</span></a>`
            : '';

        actionsEl.innerHTML = `
            ${primary}
            ${call}
            <div class="dropdown user-profile__more" data-dropdown id="user-profile-more">
                <button type="button" class="dropdown__trigger" data-dropdown-trigger aria-haspopup="true" aria-expanded="false" aria-controls="user-profile-more-menu" aria-label="${escapeHtml(t('user_profile.more'))}" title="${escapeHtml(t('user_profile.more'))}">
                    ${icon('more', { size: 16 })}
                </button>
                <div class="dropdown__menu dropdown__menu--right" data-dropdown-menu id="user-profile-more-menu" role="menu" hidden>
                    ${menuItem('copy-link', 'link', t('user_profile.menu.copy_link'))}
                    ${menuItem('add-to-group', 'user-plus', t('user_profile.menu.add_to_group'))}
                    ${menuItem('notify-online', 'bell', t(watching ? 'user_profile.menu.notify_online_off' : 'user_profile.menu.notify_online'))}
                    <div class="user-profile__menu-divider" role="separator"></div>
                    ${menuItem('report', 'flag', t('user_profile.menu.report'), { danger: true })}
                    ${menuItem(profile.is_blocked ? 'unblock' : 'block', 'ban', t(profile.is_blocked ? 'user_profile.menu.unblock' : 'user_profile.menu.block'), { danger: true })}
                </div>
            </div>
        `;
    }

    /* ---------- Tabs ---------- */

    function renderTabs() {
        tabs.forEach((tab) => {
            const key = tab.dataset.userTab;

            if (key === 'groups') {
                tab.textContent = t('user_profile.tabs.groups', {
                    count: profile.common_groups_count ?? 0,
                });
            }

            if (key === 'files') {
                tab.textContent = t('user_profile.tabs.files', {
                    count:
                        (profile.shared?.media_count ?? 0) +
                        (profile.shared?.files_count ?? 0),
                });
            }
        });
    }

    function selectTab(key, { focus = false } = {}) {
        tabs.forEach((tab) => {
            const selected = tab.dataset.userTab === key;

            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;

            if (selected && focus) {
                tab.focus();
            }
        });

        root.querySelectorAll('[data-user-panel]').forEach((panel) => {
            panel.hidden = panel.dataset.userPanel !== key;
        });

        root.classList.toggle('user-profile--tabbed', key !== 'overview');

        if (key === 'files' && !filesLoaded) {
            loadFiles();
        }
    }

    /* ---------- Overview ---------- */

    function renderAbout() {
        const tags = profile.tags || [];

        el('[data-user-about]').innerHTML = `
            ${
                profile.bio
                    ? `<p class="user-profile__bio">${escapeHtml(profile.bio)}</p>`
                    : `<p class="user-profile__muted">${escapeHtml(t('user_profile.no_bio'))}</p>`
            }
            ${
                tags.length
                    ? `<div class="user-profile__tags">${tags.map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`).join('')}</div>`
                    : ''
            }
        `;
    }

    function renderRecent() {
        const events = profile.recent_activity || [];

        el('[data-user-recent]').innerHTML = events.length
            ? events.map(eventHtml).join('')
            : `<p class="user-profile__muted">${escapeHtml(t('user_profile.no_activity'))}</p>`;
    }

    function renderShared() {
        const media = profile.shared?.recent_media || [];
        const files = profile.shared?.recent_files || [];

        el('[data-user-open-files]').hidden = !media.length && !files.length;
        el('[data-user-shared]').innerHTML =
            media.length || files.length
                ? `
                    ${media.length ? `<div class="user-profile__media">${media.map(mediaTileHtml).join('')}</div>` : ''}
                    ${files.map(fileRowHtml).join('')}
                `
                : `<p class="user-profile__muted">${escapeHtml(t('user_profile.no_shared'))}</p>`;
    }

    /* ---------- Side ---------- */

    function renderWrite() {
        const card = el('[data-user-write]');

        card.hidden = profile.is_me || !profile.can_message;
        el('[data-user-write-title]').textContent = t(
            'user_profile.write.title',
            { name: firstName(profile.name) },
        );
    }

    function fact(key, html) {
        el(`[data-user-fact="${key}"]`).innerHTML = html || '—';
    }

    function renderContacts() {
        fact(
            'email',
            profile.email
                ? `<a class="user-profile__fact-value user-profile__fact-value--mono" href="mailto:${escapeHtml(profile.email)}">${escapeHtml(profile.email)}</a>
                   <button type="button" class="user-profile__copy" data-user-copy="${escapeHtml(profile.email)}" aria-label="${escapeHtml(t('user_profile.contact.copy'))}" title="${escapeHtml(t('user_profile.contact.copy'))}">${icon('copy', { size: 12 })}</button>`
                : '',
        );
        fact(
            'telegram',
            profile.telegram
                ? `<a class="user-profile__fact-value user-profile__fact-value--mono" href="https://t.me/${encodeURIComponent(profile.telegram)}" target="_blank" rel="noopener">@${escapeHtml(profile.telegram)}</a>`
                : '',
        );

        if (profile.phone) {
            fact(
                'phone',
                `<a class="user-profile__fact-value user-profile__fact-value--mono" href="tel:${escapeHtml(String(profile.phone).replace(/[^\d+]/g, ''))}">${escapeHtml(profile.phone)}</a>`,
            );
        } else if (profile.phone_hidden) {
            fact(
                'phone',
                `<span class="user-profile__fact-value user-profile__fact-value--muted"><span class="user-profile__title-wide">${escapeHtml(t('user_profile.contact.phone_hidden'))}</span><span class="user-profile__title-narrow">${escapeHtml(t('user_profile.contact.phone_hidden_short'))}</span></span>
                 <span class="user-profile__lock">${icon('lock', { size: 12 })}</span>`,
            );
        } else {
            fact('phone', '');
        }

        fact(
            'department',
            profile.department ? escapeHtml(profile.department) : '',
        );
        fact(
            'language',
            profile.locale ? escapeHtml(languageName(profile.locale)) : '',
        );
        fact(
            'joined',
            profile.joined_at_iso
                ? escapeHtml(
                      t('user_profile.contact.joined_since', {
                          date: longDate(profile.joined_at_iso),
                      }),
                  )
                : '',
        );
    }

    function renderCommon() {
        const groups = profile.common_groups || [];
        const mutual = profile.mutual_contacts || { users: [], count: 0 };
        const names = mutual.users.map((person) => firstName(person.name));
        const rest = mutual.count - names.length;

        let namesText = names.join(', ');

        if (rest <= 0 && names.length > 1) {
            namesText = `${names.slice(0, -1).join(', ')} ${t('user_profile.and')} ${names[names.length - 1]}`;
        }

        el('[data-user-common-title]').innerHTML = `
            <span class="user-profile__title-wide">${escapeHtml(t('user_profile.sections.common'))}</span>
            <span class="user-profile__title-narrow">${escapeHtml(t('user_profile.sections.common_groups', { count: groups.length }))}</span>
        `;

        el('[data-user-common]').innerHTML =
            names.length || groups.length
                ? `
                    ${
                        names.length
                            ? `<div class="user-profile__mutual">
                                <span class="user-profile__mutual-stack">${mutual.users.map((person) => avatarHtml(person)).join('')}</span>
                                <span class="user-profile__mutual-text">${escapeHtml(
                                    rest > 0
                                        ? t('user_profile.mutual_more', {
                                              names: namesText,
                                              count: rest,
                                          })
                                        : t('user_profile.mutual', {
                                              names: namesText,
                                          }),
                                )}</span>
                            </div>`
                            : ''
                    }
                    ${groups.map((group) => groupRowHtml(group)).join('')}
                `
                : `<p class="user-profile__muted">${escapeHtml(t('user_profile.no_groups'))}</p>`;
    }

    function renderGroupsTab() {
        const groups = profile.common_groups || [];

        el('[data-user-groups]').innerHTML = groups.length
            ? groups
                  .map((group) => groupRowHtml(group, { wide: true }))
                  .join('')
            : emptyState(escapeHtml(t('user_profile.no_groups')), {
                  icon: 'users',
                  plain: true,
              });
    }

    function render() {
        renderHead();
        renderTabs();
        renderAbout();
        renderRecent();
        renderShared();
        renderWrite();
        renderContacts();
        renderCommon();
        renderGroupsTab();
    }

    /* ---------- Files tab ---------- */

    async function loadFiles({ append = false } = {}) {
        const list = el('[data-user-files]');

        filesLoaded = true;

        if (!append) {
            filesPage = 1;
            list.innerHTML = skeletonRows(3);
        }

        const kind = filesKind;

        try {
            const { data } = await api.get(`/users/${userId}/shared`, {
                params: { kind, page: filesPage },
            });

            if (kind !== filesKind) {
                return;
            }

            const items = data.data || [];
            const hasMore =
                data.pagination &&
                data.pagination.current_page < data.pagination.last_page;

            let html;

            if (kind === 'media') {
                html = items.map(mediaTileHtml).join('');
            } else if (kind === 'links') {
                html = items.map(linkRowHtml).join('');
            } else {
                html = items.map(fileRowHtml).join('');
            }

            list.querySelector('[data-user-files-more]')?.remove();

            if (!append) {
                list.innerHTML = items.length
                    ? kind === 'media'
                        ? `<div class="user-profile__media user-profile__media--page" data-user-files-items>${html}</div>`
                        : `<div data-user-files-items>${html}</div>`
                    : emptyState(escapeHtml(t('user_profile.files.empty')), {
                          icon: kind === 'links' ? 'link' : 'folder',
                          plain: true,
                      });
            } else {
                list.querySelector(
                    '[data-user-files-items]',
                )?.insertAdjacentHTML('beforeend', html);
            }

            if (hasMore) {
                list.insertAdjacentHTML(
                    'beforeend',
                    `<button type="button" class="btn btn--outline btn--sm user-profile__more-btn" data-user-files-more>${escapeHtml(t('user_profile.files.load_more'))}</button>`,
                );
            }
        } catch (error) {
            list.innerHTML = emptyState(
                escapeHtml(
                    apiErrorMessage(error, t('user_profile.files.error')),
                ),
                { icon: 'alert', plain: true },
            );
        }
    }

    /* ---------- Actions ---------- */

    async function ensureConversation() {
        if (profile.private_conversation_id) {
            return profile.private_conversation_id;
        }

        const { data } = await api.post('/conversations', {
            type: 'private',
            user_ids: [profile.id],
        });

        profile.private_conversation_id = data.data.id;

        return profile.private_conversation_id;
    }

    async function sendFirstMessage(event) {
        event.preventDefault();

        const input = el('[data-user-write-input]');
        const button = el('[data-user-write-submit]');
        const body = input.value.trim();

        if (!body) {
            goTo(chatUrl(profile));

            return;
        }

        button.disabled = true;

        try {
            const conversationId = await ensureConversation();

            await api.post(`/conversations/${conversationId}/messages`, {
                body,
                client_id: `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            });

            input.value = '';
            goTo(`/chat/${conversationId}`);
        } catch (error) {
            showToast(
                apiErrorMessage(error, t('user_profile.write.error')),
                'error',
            );
        } finally {
            button.disabled = false;
        }
    }

    async function openAddToGroup() {
        const memberOf = new Set(
            (profile.common_groups || []).map((group) => Number(group.id)),
        );
        const { close, modal } = openModal({
            title: t('user_profile.add_to_group.title'),
            bodyHtml: `<p class="user-profile-dialog__note">${escapeHtml(t('user_profile.add_to_group.hint'))}</p><div data-add-groups>${skeletonRows(3)}</div>`,
        });
        const listEl = modal.querySelector('[data-add-groups]');

        try {
            const { data } = await api.get('/conversations', {
                params: { per_page: 100 },
            });
            const groups = (data.data || []).filter(
                (conversation) =>
                    ['group', 'channel'].includes(conversation.type) &&
                    ['creator', 'owner', 'admin'].includes(
                        conversation.my_role,
                    ),
            );

            listEl.innerHTML = groups.length
                ? `<ul class="user-profile-dialog__list" role="list">${groups
                      .map(
                          (group) => `
                        <li class="user-profile-dialog__item">
                            ${avatarHtml({ name: group.title, avatar: group.avatar }, 'sm')}
                            <span class="user-profile-dialog__title">${escapeHtml(group.title || '')}</span>
                            ${
                                memberOf.has(Number(group.id))
                                    ? `<span class="user-profile-dialog__note">${escapeHtml(t('user_profile.add_to_group.member'))}</span>`
                                    : `<button type="button" class="btn btn--outline btn--sm" data-add-group="${escapeHtml(group.id)}" data-add-title="${escapeHtml(group.title || '')}">${escapeHtml(t('user_profile.add_to_group.add'))}</button>`
                            }
                        </li>
                    `,
                      )
                      .join('')}</ul>`
                : emptyState(escapeHtml(t('user_profile.add_to_group.empty')), {
                      icon: 'users',
                      plain: true,
                  });
        } catch (error) {
            listEl.innerHTML = emptyState(
                escapeHtml(
                    apiErrorMessage(
                        error,
                        t('user_profile.add_to_group.error'),
                    ),
                ),
                { icon: 'alert', plain: true },
            );
        }

        listEl.addEventListener('click', async (event) => {
            const button = event.target.closest('[data-add-group]');

            if (!button) {
                return;
            }

            button.disabled = true;

            try {
                await api.post(
                    `/conversations/${button.dataset.addGroup}/members`,
                    { user_ids: [profile.id] },
                );
                showToast(
                    t('user_profile.add_to_group.added', {
                        name: profile.name,
                        title: button.dataset.addTitle,
                    }),
                );
                close();
                load();
            } catch (error) {
                button.disabled = false;
                showToast(
                    apiErrorMessage(
                        error,
                        t('user_profile.add_to_group.error'),
                    ),
                    'error',
                );
            }
        });
    }

    function openReport() {
        const reasons = ['spam', 'abuse', 'fake', 'other'];
        const { close, modal } = openModal({
            title: t('user_profile.report.title', { name: profile.name }),
            bodyHtml: `
                <form data-report-form novalidate>
                    <span class="field-label">${escapeHtml(t('user_profile.report.reason'))}</span>
                    <fieldset class="user-profile-dialog__reasons choice-group" role="radiogroup" aria-label="${escapeHtml(t('user_profile.report.reason'))}">
                        ${reasons
                            .map(
                                (reason, index) => `
                            <label class="radio">
                                <input type="radio" class="radio__input" name="reason" value="${reason}" ${index === 0 ? 'checked' : ''}>
                                <span class="radio__dot" aria-hidden="true"></span>
                                <span class="radio__text"><span class="radio__label">${escapeHtml(t(`user_profile.report.reasons.${reason}`))}</span></span>
                            </label>
                        `,
                            )
                            .join('')}
                    </fieldset>
                    <div class="field-group">
                        <label class="field-label" for="report-comment">${escapeHtml(t('user_profile.report.comment'))}</label>
                        <textarea class="field-input h-auto" id="report-comment" name="comment" rows="3" maxlength="500" placeholder="${escapeHtml(t('user_profile.report.comment_placeholder'))}"></textarea>
                    </div>
                </form>
            `,
            footerHtml: `
                <button type="button" class="btn btn--outline" data-report-cancel>${escapeHtml(t('common.cancel'))}</button>
                <button type="button" class="btn btn--danger" data-report-submit>${escapeHtml(t('user_profile.report.submit'))}</button>
            `,
        });

        modal
            .querySelector('[data-report-cancel]')
            .addEventListener('click', close);
        modal
            .querySelector('[data-report-submit]')
            .addEventListener('click', async (event) => {
                const form = modal.querySelector('[data-report-form]');
                const button = event.currentTarget;

                button.disabled = true;

                try {
                    await api.post(`/users/${profile.id}/report`, {
                        reason: form.elements.reason.value,
                        comment: form.elements.comment.value.trim() || null,
                    });
                    close();
                    showToast(t('user_profile.report.sent'));
                } catch (error) {
                    button.disabled = false;
                    showToast(
                        apiErrorMessage(error, t('user_profile.report.error')),
                        'error',
                    );
                }
            });
    }

    async function setBlocked(blocked) {
        if (blocked) {
            const confirmed = await confirmDialog({
                title: t('user_profile.block.confirm_title', {
                    name: profile.name,
                }),
                message: t('user_profile.block.confirm_body', {
                    name: firstName(profile.name),
                }),
                confirmText: t('user_profile.menu.block'),
                danger: true,
                icon: 'ban',
            });

            if (!confirmed) {
                return;
            }
        }

        try {
            if (blocked) {
                await api.post(`/users/${profile.id}/block`);
            } else {
                await api.delete(`/users/${profile.id}/block`);
            }

            profile.is_blocked = blocked;
            profile.can_message = !blocked;
            showToast(
                t(
                    blocked
                        ? 'user_profile.block.blocked'
                        : 'user_profile.block.unblocked',
                    { name: profile.name },
                ),
            );
            render();
        } catch (error) {
            const status = error?.response?.status;

            showToast(
                status === 404 || status === 405
                    ? t('user_profile.block.unavailable')
                    : apiErrorMessage(error, t('user_profile.block.error')),
                'error',
            );
        }
    }

    function onAction(action) {
        if (action === 'copy-link') {
            copyText(
                `${window.location.origin}/users/${profile.id}`,
                t('user_profile.link_copied'),
            );
        } else if (action === 'add-to-group') {
            openAddToGroup();
        } else if (action === 'notify-online') {
            const watching = toggleOnlineWatch(profile.id, profile.name);

            showToast(
                t(
                    watching
                        ? 'user_profile.notify.on'
                        : 'user_profile.notify.off',
                    { name: profile.name },
                ),
                'info',
            );
            renderActions();
        } else if (action === 'report') {
            openReport();
        } else if (action === 'block') {
            setBlocked(true);
        } else if (action === 'unblock') {
            setBlocked(false);
        }
    }

    /* ---------- Wiring ---------- */

    root.addEventListener(
        'click',
        (event) => {
            const menu = event.target.closest('[data-user-menu]');

            if (menu && profile) {
                menu.closest('[data-dropdown]')
                    ?.querySelector('[data-dropdown-menu]')
                    ?.setAttribute('hidden', '');
                onAction(menu.dataset.userMenu);

                return;
            }

            const tab = event.target.closest('[data-user-tab]');

            if (tab) {
                selectTab(tab.dataset.userTab);

                return;
            }

            if (event.target.closest('[data-user-open-files]')) {
                selectTab('files');
                root.scrollIntoView({ block: 'start', behavior: 'smooth' });

                return;
            }

            const kind = event.target.closest('[data-user-kind]');

            if (kind) {
                filesKind = kind.dataset.userKind;
                root.querySelectorAll('[data-user-kind]').forEach((button) =>
                    button.setAttribute(
                        'aria-pressed',
                        String(button === kind),
                    ),
                );
                loadFiles();

                return;
            }

            if (event.target.closest('[data-user-files-more]')) {
                filesPage += 1;
                loadFiles({ append: true });

                return;
            }

            const copy = event.target.closest('[data-user-copy]');

            if (copy) {
                copyText(copy.dataset.userCopy, t('user_profile.copied'));

                return;
            }

            const chip = event.target.closest('[data-user-chip]');

            if (chip) {
                const input = el('[data-user-write-input]');

                input.value = chip.textContent.trim();
                input.focus();
            }
        },
        { signal },
    );

    el('[data-user-tabs]').addEventListener(
        'keydown',
        (event) => {
            if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) {
                return;
            }

            const index = tabs.findIndex(
                (tab) => tab.getAttribute('aria-selected') === 'true',
            );
            const next =
                tabs[
                    (index +
                        (event.key === 'ArrowRight' ? 1 : -1) +
                        tabs.length) %
                        tabs.length
                ];

            event.preventDefault();
            selectTab(next.dataset.userTab, { focus: true });
        },
        { signal },
    );

    el('[data-user-write-form]').addEventListener('submit', sendFirstMessage, {
        signal,
    });

    el('[data-user-write-input]').addEventListener(
        'keydown',
        (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                el('[data-user-write-form]').requestSubmit();
            }
        },
        { signal },
    );

    el('[data-user-write-input]').addEventListener(
        'input',
        (event) => {
            event.target.style.height = 'auto';
            event.target.style.height = `${event.target.scrollHeight + 2}px`;
        },
        { signal },
    );

    // A shared image that is gone leaves its tinted tile, not a broken icon.
    root.addEventListener(
        'error',
        (event) => {
            if (event.target.matches?.('[data-user-tile-image]')) {
                event.target.remove();
            }
        },
        { capture: true, signal },
    );

    async function load() {
        try {
            const { data } = await api.get(`/users/${userId}`);

            profile = data.data;
            filesLoaded = false;
            render();

            if (
                root
                    .querySelector('[data-user-tab="files"]')
                    ?.getAttribute('aria-selected') === 'true'
            ) {
                loadFiles();
            }
        } catch (error) {
            nameEl.textContent = t('user_profile.not_found');
            el('[data-user-about]').innerHTML = emptyState(
                escapeHtml(apiErrorMessage(error, t('user_profile.not_found'))),
                { icon: 'alert', plain: true },
            );
            el('[data-user-common]').innerHTML = '';
        }
    }

    initPresence();
    stopPresence = onPresenceChange(renderStatus);

    // Keep "16:40" current while the page is open.
    const clock = setInterval(renderStatus, 60000);

    signal.addEventListener('abort', () => clearInterval(clock));

    // The current user may be known before the profile arrives.
    if (String(getState().user?.id) === String(userId)) {
        root.classList.add('user-profile--me');
    }

    load();
}

function teardown() {
    stopPresence?.();
    stopPresence = null;
    controller?.abort();
    controller = null;
}

bootOnPage('[data-user-profile-page]', boot, teardown);
