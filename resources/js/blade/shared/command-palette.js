import { api } from '../axios';
import { getState, logout, setTheme } from './app-state';
import { hasRole, initials } from './auth-state';
import { escapeHtml } from './forms';
import { t } from './i18n';
import { icon } from './icon';
import { getStoredTheme, resolveAppliedTheme } from './theme';

/**
 * Ctrl/Cmd+K — one box for people, messages and commands.
 *
 * Commands and navigation are local and filtered as you type; people
 * (`/chat/users/search`, ≥ 2 characters) and messages (`/messages/search`)
 * come from the API, debounced, and a stale response never overwrites a
 * newer query's results. Arrow keys move the selection, Enter runs it,
 * Esc (or a click outside) closes.
 */

const SEARCH_DELAY_MS = 200;
const MIN_REMOTE_QUERY = 2;
const GROUP_ORDER = ['people', 'messages', 'commands', 'navigation'];

let overlay = null;
let input = null;
let results = null;
let items = [];
let activeIndex = 0;
let searchTimer = null;
let searchToken = 0;
let previouslyFocused = null;

function visit(url) {
    if (window.Turbo) {
        window.Turbo.visit(url);
    } else {
        window.location.href = url;
    }
}

/**
 * "New chat" / "New group" from anywhere: on the chat page the existing
 * pickers are opened directly; elsewhere chat.js opens them on arrival
 * from the `?new=` parameter.
 */
export function startCreate(kind) {
    const trigger = document.querySelector(
        kind === 'group' ? '[data-start-group]' : '[data-start-private]',
    );

    if (trigger) {
        trigger.click();

        return;
    }

    visit(`/chat?new=${kind === 'group' ? 'group' : 'private'}`);
}

export function toggleTheme() {
    const applied = resolveAppliedTheme(getStoredTheme());

    setTheme(applied === 'dark' ? 'light' : 'dark');
}

function localCommands() {
    const user = getState().user;
    const commands = [
        {
            group: 'commands',
            icon: 'edit',
            label: t('shell.new_chat'),
            run: () => startCreate('private'),
        },
        {
            group: 'commands',
            icon: 'users',
            label: t('shell.new_group'),
            run: () => startCreate('group'),
        },
        {
            group: 'commands',
            icon: 'moon',
            label: t('palette.toggle_theme'),
            keys: ['Ctrl', 'Shift', 'L'],
            run: toggleTheme,
        },
        {
            group: 'commands',
            icon: 'user',
            label: t('shell.my_account'),
            run: () => visit('/settings/profile'),
        },
        {
            group: 'commands',
            icon: 'logout',
            label: t('nav.log_out'),
            run: async () => {
                await logout();
                window.location.href = '/login';
            },
        },
        {
            group: 'navigation',
            icon: 'home',
            label: t('nav.home'),
            run: () => visit('/dashboard'),
        },
        {
            group: 'navigation',
            icon: 'chat',
            label: t('nav.chat'),
            run: () => visit('/chat'),
        },
        {
            group: 'navigation',
            icon: 'bell',
            label: t('nav.notifications'),
            run: () => visit('/notifications'),
        },
        {
            group: 'navigation',
            icon: 'coins',
            label: t('nav.currencies'),
            run: () => visit('/currencies'),
        },
        {
            group: 'navigation',
            icon: 'shield',
            label: t('shell.security_sessions'),
            run: () => visit('/settings/security'),
        },
        {
            group: 'navigation',
            icon: 'spark',
            label: t('shell.whats_new'),
            run: () => visit('/changelog'),
        },
    ];

    if (hasRole(user, 'SUPER_ADMIN', 'ADMIN')) {
        commands.push({
            group: 'navigation',
            icon: 'sliders',
            label: t('shell.administration'),
            run: () => visit('/admin/users'),
        });
    }

    return commands;
}

function matches(label, query) {
    return label.toLowerCase().includes(query.toLowerCase());
}

/** Escapes `text`, then bolds the first case-insensitive match of `query`. */
function highlight(text, query) {
    const safe = escapeHtml(text);

    if (!query) {
        return safe;
    }

    const index = text.toLowerCase().indexOf(query.toLowerCase());

    if (index < 0) {
        return safe;
    }

    return (
        escapeHtml(text.slice(0, index)) +
        `<mark>${escapeHtml(text.slice(index, index + query.length))}</mark>` +
        escapeHtml(text.slice(index + query.length))
    );
}

function tileHtml(item) {
    if (item.avatar) {
        return item.avatar.url
            ? `<span class="avatar avatar--sm"><img class="avatar__image" src="${escapeHtml(item.avatar.url)}" alt=""></span>`
            : `<span class="avatar avatar--sm"><span class="avatar__initials">${escapeHtml(initials(item.avatar.name))}</span></span>`;
    }

    return `<span class="command-palette__tile">${icon(item.icon, { size: 18 })}</span>`;
}

function itemHtml(item, index, query) {
    const keys = item.keys
        ? `<span class="command-palette__keys">${item.keys.map((key) => `<kbd class="kbd">${key}</kbd>`).join('')}</span>`
        : icon('arrow', { size: 16, className: 'command-palette__arrow' });

    return `
        <button
            type="button"
            class="command-palette__item"
            role="option"
            id="command-palette-item-${index}"
            data-palette-index="${index}"
            aria-selected="${index === activeIndex}"
        >
            ${tileHtml(item)}
            <span class="command-palette__text">
                <span class="command-palette__label">${highlight(item.label, query)}</span>
                ${item.meta ? `<span class="command-palette__meta">${escapeHtml(item.meta)}</span>` : ''}
            </span>
            ${keys}
        </button>
    `;
}

function render(list, query, { pending = false } = {}) {
    items = GROUP_ORDER.flatMap((group) =>
        list.filter((item) => item.group === group),
    );
    activeIndex = Math.min(activeIndex, Math.max(items.length - 1, 0));

    if (!items.length) {
        results.innerHTML = `<div class="command-palette__empty">${
            pending ? t('palette.searching') : t('palette.empty')
        }</div>`;
        input.removeAttribute('aria-activedescendant');

        return;
    }

    let index = 0;

    results.innerHTML = GROUP_ORDER.map((group) => {
        const groupItems = items.filter((item) => item.group === group);

        if (!groupItems.length) {
            return '';
        }

        return `
            <div role="group" aria-label="${t(`palette.${group}`)}">
                <div class="command-palette__group" aria-hidden="true">${t(`palette.${group}`)}</div>
                ${groupItems.map((item) => itemHtml(item, index++, query)).join('')}
            </div>
        `;
    }).join('');

    syncActive();
}

function syncActive() {
    results
        .querySelectorAll('[data-palette-index]')
        .forEach((el) =>
            el.setAttribute(
                'aria-selected',
                String(Number(el.dataset.paletteIndex) === activeIndex),
            ),
        );

    const active = results.querySelector(
        `[data-palette-index="${activeIndex}"]`,
    );

    if (active) {
        input.setAttribute('aria-activedescendant', active.id);
        active.scrollIntoView({ block: 'nearest' });
    }
}

async function remoteResults(query) {
    const [people, messages] = await Promise.all([
        api
            .get('/chat/users/search', { params: { q: query } })
            .then(({ data }) => data.data || [])
            .catch(() => []),
        api
            .get('/messages/search', { params: { q: query, per_page: 5 } })
            .then(({ data }) => data.data || [])
            .catch(() => []),
    ]);

    return [
        ...people.slice(0, 5).map((person) => ({
            group: 'people',
            avatar: { name: person.name, url: person.avatar || null },
            label: person.name,
            meta: person.email,
            run: async () => {
                const { data } = await api.post('/conversations', {
                    type: 'private',
                    user_ids: [person.id],
                });

                visit(`/chat/${data.data.id}`);
            },
        })),
        ...messages.map((message) => ({
            group: 'messages',
            icon: 'chat',
            label: message.body || '',
            meta: [message.sender?.name, message.created_at]
                .filter(Boolean)
                .join(' · '),
            run: () =>
                visit(`/chat/${message.conversation_id}?message=${message.id}`),
        })),
    ];
}

function search() {
    const query = input.value.trim();
    const local = localCommands().filter(
        (item) => !query || matches(item.label, query),
    );
    const token = ++searchToken;

    activeIndex = 0;
    window.clearTimeout(searchTimer);

    if (query.length < MIN_REMOTE_QUERY) {
        render(local, query);

        return;
    }

    render(local, query, { pending: true });

    searchTimer = window.setTimeout(async () => {
        const remote = await remoteResults(query);

        if (token === searchToken && overlay) {
            render([...remote, ...local], query);
        }
    }, SEARCH_DELAY_MS);
}

async function runItem(index) {
    const item = items[index];

    if (!item) {
        return;
    }

    closeCommandPalette();

    try {
        await item.run();
    } catch {
        // A failed action (e.g. network) leaves the user where they were.
    }
}

function onKeydown(event) {
    if (event.key === 'Escape') {
        event.preventDefault();
        closeCommandPalette();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();

        if (!items.length) {
            return;
        }

        const step = event.key === 'ArrowDown' ? 1 : -1;
        activeIndex = (activeIndex + step + items.length) % items.length;
        syncActive();
    } else if (event.key === 'Enter') {
        event.preventDefault();
        runItem(activeIndex);
    }
}

export function closeCommandPalette() {
    if (!overlay) {
        return;
    }

    window.clearTimeout(searchTimer);
    searchToken++;
    overlay.remove();
    overlay = null;
    document.body.classList.remove('scroll-lock');
    previouslyFocused?.focus?.();
}

/** Signed-in users only — every result either needs the API or the account. */
export function openCommandPalette() {
    if (!getState().user) {
        return;
    }

    if (overlay) {
        input.focus();

        return;
    }

    previouslyFocused = document.activeElement;

    overlay = document.createElement('div');
    overlay.className = 'command-palette-overlay';
    overlay.innerHTML = `
        <div class="command-palette" role="dialog" aria-modal="true" aria-label="${t('palette.label')}">
            <div class="command-palette__search">
                ${icon('search', { size: 20 })}
                <input
                    type="text"
                    class="command-palette__input"
                    placeholder="${t('palette.placeholder')}"
                    aria-label="${t('palette.placeholder')}"
                    role="combobox"
                    aria-expanded="true"
                    aria-controls="command-palette-results"
                    aria-autocomplete="list"
                    autocomplete="off"
                    spellcheck="false"
                >
                <kbd class="kbd">Esc</kbd>
            </div>
            <div class="command-palette__results" id="command-palette-results" role="listbox"></div>
            <div class="command-palette__footer" aria-hidden="true">
                <span>↑↓ ${t('palette.hint_select')}</span>
                <span>Enter ${t('palette.hint_open')}</span>
                <span>Esc ${t('palette.hint_close')}</span>
            </div>
        </div>
    `;

    input = overlay.querySelector('.command-palette__input');
    results = overlay.querySelector('.command-palette__results');

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closeCommandPalette();

            return;
        }

        const item = event.target.closest('[data-palette-index]');

        if (item) {
            runItem(Number(item.dataset.paletteIndex));
        }
    });

    results.addEventListener('mousemove', (event) => {
        const item = event.target.closest('[data-palette-index]');

        if (item && Number(item.dataset.paletteIndex) !== activeIndex) {
            activeIndex = Number(item.dataset.paletteIndex);
            syncActive();
        }
    });

    input.addEventListener('input', search);
    input.addEventListener('keydown', onKeydown);

    document.body.appendChild(overlay);
    document.body.classList.add('scroll-lock');
    search();
    input.focus();
}

let initialized = false;

/** Wires every `[data-command-palette-trigger]`; closes on Turbo navigation. */
export function initCommandPalette() {
    if (initialized) {
        return;
    }

    initialized = true;

    document.addEventListener('click', (event) => {
        if (event.target.closest('[data-command-palette-trigger]')) {
            openCommandPalette();
        }
    });

    document.addEventListener('turbo:before-visit', closeCommandPalette);
}
