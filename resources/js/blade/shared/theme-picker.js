import { t } from './i18n';
import { openModal } from './modal';
import { THEMES, getStoredTheme, setTheme, resolveAppliedTheme, watchSystemTheme } from './theme';

/**
 * Every theme rendered as a real miniature UI (header/card/input/button)
 * scoped via a nested `data-theme` attribute — the same `--ui-*` custom
 * properties the whole site uses cascade down to the mini elements inside,
 * so the preview is never a fake color swatch, it's the actual design
 * system rendered small.
 */
function previewCard(code) {
    const isSystem = code === 'system';
    const scopeTheme = isSystem ? resolveAppliedTheme('system') : code;
    const name = t(`theme.${code}`);

    return `
        <button
            type="button"
            class="theme-picker-card"
            data-theme-option="${code}"
            role="radio"
            aria-checked="false"
            aria-pressed="false"
        >
            <div class="theme-picker-card__preview" data-theme="${scopeTheme}">
                <div class="theme-picker-card__preview-header"></div>
                <div class="theme-picker-card__preview-block"></div>
                <div class="theme-picker-card__preview-row">
                    <div class="theme-picker-card__preview-input"></div>
                    <div class="theme-picker-card__preview-button"></div>
                </div>
            </div>
            <div class="theme-picker-card__footer">
                <span class="theme-picker-card__name">${name}</span>
                <span class="theme-picker-card__check" aria-hidden="true">✓</span>
            </div>
        </button>
    `;
}

function syncActiveCard(grid) {
    const current = getStoredTheme();

    grid.querySelectorAll('[data-theme-option]').forEach((card) => {
        const active = card.dataset.themeOption === current;

        card.setAttribute('aria-checked', String(active));
        card.setAttribute('aria-pressed', String(active));
    });
}

/**
 * Fills `grid` (any container element) with the full theme picker grid and
 * wires it up — shared by the header's modal panel and the Settings ->
 * Appearance section, so there's exactly one implementation of "pick a
 * theme" in the app, not a modal-only one and a separate inline one.
 */
export function renderThemeGrid(grid) {
    grid.classList.add('theme-picker-grid');
    grid.setAttribute('role', 'radiogroup');
    grid.setAttribute('aria-label', t('theme.label'));
    grid.innerHTML = THEMES.map(previewCard).join('');
    syncActiveCard(grid);

    grid.addEventListener('click', (event) => {
        const card = event.target.closest('[data-theme-option]');

        if (!card) {
            return;
        }

        setTheme(card.dataset.themeOption);
        syncActiveCard(grid);
    });
}

export function openThemePicker() {
    const { modal } = openModal({
        title: t('theme.picker_title'),
        wide: true,
        bodyHtml: `
            <p style="margin:0 0 16px; color:var(--ui-text-secondary); font-size:13px;">
                ${t('theme.picker_subtitle')}
            </p>
            <div data-theme-grid></div>
        `,
    });

    renderThemeGrid(modal.querySelector('[data-theme-grid]'));
}

/** Wires up every `[data-theme-picker-trigger]` button to open the panel. */
export function initThemePicker() {
    watchSystemTheme();

    document.querySelectorAll('[data-theme-picker-trigger]').forEach((trigger) => {
        trigger.addEventListener('click', openThemePicker);
    });
}
