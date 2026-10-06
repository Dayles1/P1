import {
    openCommandPalette,
    startCreate,
    toggleTheme,
    visit,
} from './command-palette';
import { t } from './i18n';
import { openModal } from './modal';

/**
 * "G, then a letter" goes to a section, as shown next to the sidebar and
 * account menu rows. Keyed by `event.code`, so it works in any keyboard
 * layout (Russian included).
 */
const GO_TO = {
    KeyH: '/dashboard',
    KeyC: '/chat',
    KeyP: '/profile',
    KeyS: '/sessions',
    KeyN: '/notifications',
};

/** How long after G the second key still counts. */
const SEQUENCE_MS = 1200;

/**
 * Whether the key press belongs to something the user is typing into.
 */
function isTyping(event) {
    const target = event.target;

    return (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    );
}

/**
 * Global shortcuts that make sense everywhere (Ctrl/Cmd+K, Ctrl/Cmd+/,
 * Ctrl/Cmd+Shift+L, Ctrl/Cmd+,) — they require a modifier key, so they're
 * safe to handle even while a text field has focus. The single-key ones
 * (G then a letter, C for a new chat) only act outside text fields. Page-specific ones (Enter to send, Shift+Enter for a
 * newline, ↑ to edit your last message) live where they act — chat.js —
 * since they only make sense with focus in that page's own composer.
 */
function shortcutRows() {
    const rows = [
        ['Ctrl/Cmd + K', t('shortcuts.search')],
        ['Ctrl/Cmd + /', t('shortcuts.help')],
        ['Ctrl/Cmd + Shift + L', t('palette.toggle_theme')],
        ['Ctrl/Cmd + ,', t('nav.settings')],
        ['G H', t('nav.home')],
        ['G C', t('nav.chat')],
        ['G P', t('nav.profile')],
        ['G S', t('nav.sessions')],
        ['G N', t('nav.notifications')],
        ['C', t('shell.new_chat')],
        ['Esc', t('shortcuts.close')],
        ['Enter', t('shortcuts.send')],
        ['Shift + Enter', t('shortcuts.newline')],
        ['↑', t('shortcuts.edit_last')],
    ];

    return rows
        .map(
            ([keys, label]) => `
            <div class="shortcut-row">
                <span>${label}</span>
                <kbd class="kbd">${keys}</kbd>
            </div>
        `,
        )
        .join('');
}

function openShortcutsHelp() {
    openModal({
        title: t('shortcuts.title'),
        bodyHtml: `<div>${shortcutRows()}</div>`,
    });
}

export function initShortcuts() {
    let awaitingSecondKey = 0;

    document.addEventListener('keydown', (event) => {
        if (
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            event.defaultPrevented ||
            isTyping(event) ||
            document.querySelector(
                '[data-modal]:not([hidden]), .command-palette:not([hidden])',
            )
        ) {
            return;
        }

        if (awaitingSecondKey && Date.now() - awaitingSecondKey < SEQUENCE_MS) {
            awaitingSecondKey = 0;

            if (GO_TO[event.code]) {
                event.preventDefault();
                visit(GO_TO[event.code]);
            }

            return;
        }

        if (event.code === 'KeyG') {
            awaitingSecondKey = Date.now();
        } else if (event.code === 'KeyC') {
            event.preventDefault();
            startCreate('private');
        }
    });

    document.addEventListener(
        'keydown',
        (event) => {
            const meta = event.ctrlKey || event.metaKey;

            if (!meta) {
                return;
            }

            if (event.key === ',') {
                event.preventDefault();
                visit('/settings/profile');

                return;
            }

            if (event.key === 'k' || event.key === 'K') {
                event.preventDefault();
                openCommandPalette();

                return;
            }

            if (event.shiftKey && (event.key === 'l' || event.key === 'L')) {
                event.preventDefault();
                toggleTheme();

                return;
            }

            if (event.key === '/') {
                event.preventDefault();
                openShortcutsHelp();
            }
        },
        { capture: true },
    );
}

export { openShortcutsHelp };
