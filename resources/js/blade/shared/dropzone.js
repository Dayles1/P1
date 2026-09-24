import { escapeHtml } from './forms';
import { t } from './i18n';
import { icon } from './icon';

/**
 * Drag-and-drop file picker (<x-blade.u-i.dropzone>). The zone wraps a
 * real <input type="file"> (keyboard and click still work); dropped or
 * chosen files are checked against `accept` and `data-max-size` (bytes),
 * then handed to the page as one event — the page owns the upload:
 *
 *   zone.addEventListener('dropzone:files', ({ detail }) => {
 *       detail.files     // File[] that passed
 *       detail.rejected  // [{ file, reason }] with a translated reason
 *   });
 */

export function formatBytes(bytes) {
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

    const rounded = unit === 0 ? value : Math.round(value * 10) / 10;

    return `${new Intl.NumberFormat(window.__i18n?.locale || 'en').format(rounded)} ${units[unit]}`;
}

function accepts(file, accept) {
    if (!accept) {
        return true;
    }

    return accept
        .split(',')
        .map((rule) => rule.trim().toLowerCase())
        .some((rule) => {
            if (rule.startsWith('.')) {
                return file.name.toLowerCase().endsWith(rule);
            }

            if (rule.endsWith('/*')) {
                return file.type.startsWith(rule.slice(0, -1));
            }

            return file.type === rule;
        });
}

function handleFiles(zone, fileList) {
    const input = zone.querySelector('.dropzone__input');
    const maxSize = Number(zone.dataset.maxSize) || 0;
    const files = [];
    const rejected = [];

    [...fileList].forEach((file) => {
        if (!accepts(file, input?.accept)) {
            rejected.push({ file, reason: t('components.file_not_allowed') });
        } else if (maxSize && file.size > maxSize) {
            rejected.push({
                file,
                reason: t('components.file_too_large', {
                    size: formatBytes(maxSize),
                }),
            });
        } else {
            files.push(file);
        }
    });

    zone.dispatchEvent(
        new CustomEvent('dropzone:files', {
            bubbles: true,
            detail: { files, rejected },
        }),
    );
}

const FILE_ICONS = {
    image: 'image',
    video: 'play',
};

/**
 * One file row: `status` is 'done' | 'uploading' | 'error'. `progress`
 * (0–100) shows while uploading; `error` replaces the meta line.
 * The trailing button carries [data-file-remove] or, on error,
 * [data-file-retry] with `id` — the page wires both.
 */
export function fileRowHtml({
    id = '',
    name,
    size = null,
    type = '',
    status = 'done',
    progress = 0,
    error = '',
}) {
    const kind = FILE_ICONS[type.split('/')[0]] || 'file';
    const meta =
        status === 'error'
            ? `<span class="file-row__meta">${escapeHtml(error)}</span>`
            : status === 'uploading'
              ? `<span class="file-row__progress">
                    <span class="progress progress--thin grow"><progress class="progress__bar" value="${progress}" max="100"></progress></span>
                    <span>${progress}%</span>
                 </span>`
              : `<span class="file-row__meta">${[formatBytes(size), t('components.file_uploaded')].filter(Boolean).join(' · ')}</span>`;
    const action =
        status === 'error'
            ? `<button type="button" class="icon-btn icon-btn--sm icon-btn--ghost" data-file-retry="${escapeHtml(id)}" aria-label="${t('components.retry')}">${icon('refresh', { size: 18 })}</button>`
            : `<button type="button" class="icon-btn icon-btn--sm icon-btn--ghost" data-file-remove="${escapeHtml(id)}" aria-label="${t('components.remove')}">${icon('trash', { size: 18 })}</button>`;

    return `
        <div class="file-row${status === 'error' ? ' file-row--error' : ''}" data-file-row="${escapeHtml(id)}">
            <span class="file-row__icon">${icon(kind, { size: 20 })}</span>
            <span class="file-row__body">
                <span class="file-row__name">${escapeHtml(name)}</span>
                ${meta}
            </span>
            ${action}
        </div>
    `;
}

let initialized = false;

export function initDropzones() {
    if (initialized) {
        return;
    }

    initialized = true;

    let dragDepth = 0;

    document.addEventListener('dragenter', (event) => {
        const zone = event.target.closest?.('[data-dropzone]');

        if (!zone) {
            return;
        }

        event.preventDefault();
        dragDepth++;
        zone.classList.add('dropzone--active');

        const count = event.dataTransfer?.items?.length || 1;
        const text = zone.querySelector('.dropzone__drop-text');

        if (text) {
            text.textContent = t('components.drop_release', { count });
        }
    });

    document.addEventListener('dragover', (event) => {
        if (event.target.closest?.('[data-dropzone]')) {
            event.preventDefault();
        }
    });

    document.addEventListener('dragleave', (event) => {
        const zone = event.target.closest?.('[data-dropzone]');

        if (zone && --dragDepth <= 0) {
            dragDepth = 0;
            zone.classList.remove('dropzone--active');
        }
    });

    document.addEventListener('drop', (event) => {
        const zone = event.target.closest?.('[data-dropzone]');

        if (!zone) {
            return;
        }

        event.preventDefault();
        dragDepth = 0;
        zone.classList.remove('dropzone--active');

        if (event.dataTransfer?.files?.length) {
            handleFiles(zone, event.dataTransfer.files);
        }
    });

    document.addEventListener('change', (event) => {
        const input = event.target;

        if (!input.matches?.('.dropzone__input')) {
            return;
        }

        const zone = input.closest('[data-dropzone]');

        if (zone && input.files?.length) {
            handleFiles(zone, input.files);
            input.value = '';
        }
    });
}
