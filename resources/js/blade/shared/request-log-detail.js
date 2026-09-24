import { prettyJson, methodClass, statusClass } from './format';
import { escapeHtml } from './forms';
import { t } from './i18n';
import { icon } from './icon';
import { openModal } from './modal';

function field(label, value) {
    return `
        <div>
            <div class="detail-field__label">${label}</div>
            <div class="detail-field__value">${value ?? '—'}</div>
        </div>
    `;
}

function detailBlock(label, value) {
    if (value === null || value === undefined) {
        return '';
    }

    return `
        <div class="detail-block">
            <div class="detail-field__label">${label}</div>
            <pre class="detail-block__code">${escapeHtml(value)}</pre>
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
            <div class="row row--wrap gap-2 mb-4">
                <span class="${methodClass(log.method)}">${log.method}</span>
                <span class="${statusClass(log.status_code)}">${log.status_code ?? '—'}</span>
                <span class="text-sm secondary">${escapeHtml(log.path)}</span>
            </div>
            <div class="detail-grid detail-grid--dense">
                ${field(t('sessions.time'), log.created_at)}
                ${field(t('sessions.duration'), log.duration_ms != null ? `${log.duration_ms} ms` : '—')}
                ${field(t('sessions.ip_address'), log.ip_address)}
                ${ownerBlock}
            </div>
            ${log.body_truncated || log.response_truncated ? `<div class="alert alert--warning mb-3"><span class="alert__icon">${icon('alert', { size: 14 })}</span><div class="alert__content">${t('sessions.truncated_notice')}</div></div>` : ''}
            ${detailBlock(t('sessions.query'), prettyJson(log.query))}
            ${detailBlock(t('sessions.headers'), prettyJson(log.headers))}
            ${detailBlock(t('sessions.body'), prettyJson(log.body))}
            ${detailBlock(t('sessions.response'), prettyJson(log.response_body))}
        `,
    });
}
