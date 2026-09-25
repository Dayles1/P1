import { t } from './i18n';
import { icon } from './icon';

/**
 * A small collapsible strip showing the most recent API call's real
 * metadata (method, endpoint, status, duration) — only ever built from
 * actual `dev-request` events the axios client fires (see axios/client.js),
 * never fabricated. Only rendered while Settings -> Developer's toggle is
 * on for this user (checked via the `data-developer-mode` attribute the
 * site-chrome bootstrap sets from their saved preference).
 */
let panel = null;
let history = [];

function ensurePanel() {
    if (panel) {
        // Turbo Drive replaces <body>'s contents on every navigation; this
        // node isn't part of any server-rendered page (it's created here,
        // client-side, once) so `data-turbo-permanent` — which only
        // preserves elements present in *both* the current and incoming
        // documents — doesn't apply. Re-attach the same node (and with it
        // the same `history` array/open-closed state) instead of losing it.
        if (!document.body.contains(panel)) {
            document.body.appendChild(panel);
        }

        return panel;
    }

    panel = document.createElement('div');
    panel.id = 'dev-panel';
    panel.className = 'dev-panel';
    panel.innerHTML = `
        <button type="button" class="dev-panel__toggle" data-dev-panel-toggle>
            <span class="row gap-2">${icon('code', { size: 14 })} ${t('dev_panel.title')}</span>
            <span class="dev-panel__summary" data-dev-panel-summary></span>
        </button>
        <div class="dev-panel__body" data-dev-panel-body hidden></div>
    `;
    document.body.appendChild(panel);

    panel
        .querySelector('[data-dev-panel-toggle]')
        .addEventListener('click', () => {
            const body = panel.querySelector('[data-dev-panel-body]');
            body.hidden = !body.hidden;
        });

    return panel;
}

function statusClass(status, ok) {
    if (!ok || (status && status >= 400)) {
        return 'dev-panel__status--error';
    }

    return 'dev-panel__status--ok';
}

function render() {
    const el = ensurePanel();
    const latest = history[0];

    el.querySelector('[data-dev-panel-summary]').innerHTML = latest
        ? `<span class="${statusClass(latest.status, latest.ok)}">${latest.status ?? '—'}</span> ${latest.method} ${latest.duration ?? '—'}ms`
        : '';

    el.querySelector('[data-dev-panel-body]').innerHTML = history
        .map(
            (entry) => `
            <div class="dev-panel__entry">
                <span class="dev-panel__status ${statusClass(entry.status, entry.ok)}">${entry.status ?? '—'}</span>
                <span class="dev-panel__method">${entry.method}</span>
                <span class="dev-panel__url">${entry.url}</span>
                <span class="dev-panel__duration">${entry.duration ?? '—'}ms</span>
            </div>
        `,
        )
        .join('');
}

export function initDevPanel() {
    document.addEventListener('dev-request', (event) => {
        history = [event.detail, ...history].slice(0, 20);
        render();
    });

    // Re-attach proactively too — otherwise the panel only reappears once
    // the *next* API call fires a `dev-request` event, which can be a
    // visibly empty page for a moment on a navigation with no immediate
    // request.
    document.addEventListener('turbo:load', () => {
        if (panel) {
            ensurePanel();
        }
    });
}
