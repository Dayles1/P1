import { openCommandPalette, toggleTheme } from './command-palette';
import { t } from './i18n';
import { openModal } from './modal';

/**
 * Global shortcuts that make sense everywhere (Ctrl/Cmd+K, Ctrl/Cmd+/,
 * Ctrl/Cmd+Shift+L) — all require a modifier key, so they're safe to handle even while a text
 * field has focus. Page-specific ones (Enter to send, Shift+Enter for a
 * newline, ↑ to edit your last message) live where they act — chat.js —
 * since they only make sense with focus in that page's own composer.
 */
function shortcutRows() {
    const rows = [
        ['Ctrl/Cmd + K', t('shortcuts.search')],
        ['Ctrl/Cmd + /', t('shortcuts.help')],
        ['Ctrl/Cmd + Shift + L', t('palette.toggle_theme')],
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
    document.addEventListener(
        'keydown',
        (event) => {
            const meta = event.ctrlKey || event.metaKey;

            if (!meta) {
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
