import { prettyJson, methodClass, statusClass } from './format';
import { escapeHtml } from './forms';
import { t } from './i18n';
import { openModal } from './modal';

function field(label, value) {
    return `
        <div>
            <div style="font-size:11.5px; color: var(--ui-text-muted); text-transform:uppercase; letter-spacing:.03em; margin-bottom:3px;">${label}</div>
            <div style="font-size:13.5px; color: var(--ui-text); font-weight:600;">${value ?? '—'}</div>
        </div>
    `;
}

function detailBlock(label, value) {
    if (value === null || value === undefined) {
        return '';
    }

    return `
        <div style="margin-bottom:14px;">
            <div style="font-size:11.5px; color: var(--ui-text-muted); text-transform:uppercase; letter-spacing:.03em; margin-bottom:5px;">${label}</div>
            <pre style="margin:0; padding:10px 12px; background: var(--ui-surface-soft); border-radius: var(--ui-radius-sm); font-size:12px; overflow-x:auto; white-space:pre-wrap; word-break:break-word;">${escapeHtml(value)}</pre>
        </div>
    `;
}

export function openRequestLogDetailModal(log) {
    const ownerBlock = log.user
        ? field(
              t('admin.user'),
              `${escapeHtml(log.user.name)} &middot; ${escapeHtml(log.user.email)}`,
          )
        : '';

    openModal({
        title: t('sessions.request_detail_title'),
        wide: true,
        bodyHtml: `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
                <span class="${methodClass(log.method)}">${log.method}</span>
                <span class="${statusClass(log.status_code)}">${log.status_code ?? '—'}</span>
                <span style="font-size:12.5px; color:var(--ui-text-secondary);">${escapeHtml(log.path)}</span>
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px,1fr)); gap:12px; margin-bottom:16px;">
                ${field(t('sessions.time'), log.created_at)}
                ${field(t('sessions.duration'), log.duration_ms != null ? `${log.duration_ms} ms` : '—')}
                ${field(t('sessions.ip_address'), log.ip_address)}
                ${ownerBlock}
            </div>
            ${log.body_truncated || log.response_truncated ? `<div class="alert alert--warning" style="margin-bottom:14px;"><span class="alert__icon">!</span><div class="alert__content">${t('sessions.truncated_notice')}</div></div>` : ''}
            ${detailBlock(t('sessions.query'), prettyJson(log.query))}
            ${detailBlock(t('sessions.headers'), prettyJson(log.headers))}
            ${detailBlock(t('sessions.body'), prettyJson(log.body))}
            ${detailBlock(t('sessions.response'), prettyJson(log.response_body))}
        `,
    });
}
