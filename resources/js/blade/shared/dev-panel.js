import { t } from './i18n';

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
        return panel;
    }

    panel = document.createElement('div');
    panel.id = 'dev-panel';
    panel.style.cssText = `
        position: fixed; left: 12px; bottom: 12px; z-index: 500;
        max-width: min(420px, calc(100vw - 24px));
        border: 1px solid var(--ui-border); border-radius: var(--ui-radius);
        background: var(--ui-surface); box-shadow: var(--ui-shadow-md);
        font-size: 11.5px; font-family: ui-monospace, monospace;
        overflow: hidden;
    `;
    panel.innerHTML = `
        <button type="button" data-dev-panel-toggle style="width:100%; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 10px; border:none; background:var(--ui-surface-soft); color:var(--ui-text); cursor:pointer; font:inherit;">
            <span>&#9881; ${t('dev_panel.title')}</span>
            <span data-dev-panel-summary style="color:var(--ui-text-muted);"></span>
        </button>
        <div data-dev-panel-body style="max-height:220px; overflow-y:auto; padding:6px 10px;" hidden></div>
    `;
    document.body.appendChild(panel);

    panel.querySelector('[data-dev-panel-toggle]').addEventListener('click', () => {
        const body = panel.querySelector('[data-dev-panel-body]');
        body.hidden = !body.hidden;
    });

    return panel;
}

function statusColor(status, ok) {
    if (!ok || (status && status >= 400)) {
        return 'var(--ui-danger)';
    }

    return 'var(--ui-success)';
}

function render() {
    const el = ensurePanel();
    const latest = history[0];

    el.querySelector('[data-dev-panel-summary]').innerHTML = latest
        ? `<span style="color:${statusColor(latest.status, latest.ok)};">${latest.status ?? '—'}</span> ${latest.method} ${latest.duration ?? '—'}ms`
        : '';

    el.querySelector('[data-dev-panel-body]').innerHTML = history
        .map((entry) => `
            <div style="padding:4px 0; border-bottom:1px solid var(--ui-border); display:flex; gap:8px; align-items:baseline;">
                <span style="color:${statusColor(entry.status, entry.ok)}; font-weight:700; min-width:28px;">${entry.status ?? '—'}</span>
                <span style="color:var(--ui-text-secondary); min-width:36px;">${entry.method}</span>
                <span style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ui-text);">${entry.url}</span>
                <span style="color:var(--ui-text-muted);">${entry.duration ?? '—'}ms</span>
            </div>
        `)
        .join('');
}

export function initDevPanel() {
    document.addEventListener('dev-request', (event) => {
        history = [event.detail, ...history].slice(0, 20);
        render();
    });
}
