import { t } from './i18n';
import { openModal } from './modal';

/**
 * Global shortcuts that make sense everywhere (Ctrl/Cmd+K, Ctrl/Cmd+/) —
 * both require a modifier key, so they're safe to handle even while a text
 * field has focus. Page-specific ones (Enter to send, Shift+Enter for a
 * newline, ↑ to edit your last message) live where they act — chat.js —
 * since they only make sense with focus in that page's own composer.
 */
function triggerSearch() {
    const chatSearchTrigger = document.querySelector(
        '[data-chat-global-search]',
    );

    if (chatSearchTrigger) {
        chatSearchTrigger.click();

        return;
    }

    document.querySelector('input[type="search"]')?.focus();
}

function shortcutRows() {
    const rows = [
        ['Ctrl/Cmd + K', t('shortcuts.search')],
        ['Ctrl/Cmd + /', t('shortcuts.help')],
        ['Esc', t('shortcuts.close')],
        ['Enter', t('shortcuts.send')],
        ['Shift + Enter', t('shortcuts.newline')],
        ['↑', t('shortcuts.edit_last')],
    ];

    return rows
        .map(
            ([keys, label]) => `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--ui-border);">
                <span style="font-size:13px; color:var(--ui-text);">${label}</span>
                <kbd style="padding:3px 8px; border:1px solid var(--ui-border); border-radius:6px; background:var(--ui-surface-soft); font-size:12px; font-family:ui-monospace, monospace;">${keys}</kbd>
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
                triggerSearch();

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
