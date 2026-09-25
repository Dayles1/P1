import { setAccent, setTheme } from './app-state';
import { t } from './i18n';
import { icon } from './icon';
import { openModal } from './modal';
import {
    ACCENTS,
    THEMES,
    getStoredAccent,
    getStoredTheme,
    resolveAppliedTheme,
    watchSystemTheme,
} from './theme';

/**
 * Every theme rendered as a real miniature UI (header/card/input/button)
 * scoped via a nested `data-theme` attribute — the same `--ui-*` custom
 * properties the whole site uses cascade down to the mini elements inside,
 * so the preview is never a fake color swatch, it's the actual design
 * system rendered small, in the current accent.
 */
function previewCard(code, accent) {
    return `
        <button
            type="button"
            class="theme-picker-card"
            data-theme-option="${code}"
            role="radio"
            aria-checked="false"
            aria-pressed="false"
        >
            <div class="theme-picker-card__preview" data-theme="${resolveAppliedTheme(code)}" data-accent="${accent}">
                <div class="theme-picker-card__preview-header"></div>
                <div class="theme-picker-card__preview-block"></div>
                <div class="theme-picker-card__preview-row">
                    <div class="theme-picker-card__preview-input"></div>
                    <div class="theme-picker-card__preview-button"></div>
                </div>
            </div>
            <div class="theme-picker-card__footer">
                <span class="theme-picker-card__name">${t(`theme.${code}`)}</span>
                ${icon('check', { size: 16, className: 'theme-picker-card__check' })}
            </div>
        </button>
    `;
}

/**
 * The swatch scopes itself to the applied theme + its own accent, so it
 * paints with exactly the primary color tokens.css defines for that pair.
 */
function accentSwatch(code, appliedTheme) {
    const name = t(`theme.accent.${code}`);

    return `
        <button
            type="button"
            class="accent-swatch"
            data-accent-option="${code}"
            data-theme="${appliedTheme}"
            data-accent="${code}"
            role="radio"
            aria-checked="false"
            aria-label="${name}"
            title="${name}"
        >
            ${icon('check', { size: 16 })}
        </button>
    `;
}

function render(container) {
    const theme = getStoredTheme();
    const accent = getStoredAccent();

    container.innerHTML = `
        <div>
            <p class="theme-picker__label">${t('theme.mode_label')}</p>
            <div class="theme-picker-grid" role="radiogroup" aria-label="${t('theme.mode_label')}">
                ${THEMES.map((code) => previewCard(code, accent)).join('')}
            </div>
        </div>
        <div>
            <p class="theme-picker__label">${t('theme.accent_label')}</p>
            <div class="accent-picker" role="radiogroup" aria-label="${t('theme.accent_label')}">
                ${ACCENTS.map((code) => accentSwatch(code, resolveAppliedTheme(theme))).join('')}
            </div>
        </div>
    `;

    container.querySelectorAll('[data-theme-option]').forEach((card) => {
        const active = card.dataset.themeOption === theme;

        card.setAttribute('aria-checked', String(active));
        card.setAttribute('aria-pressed', String(active));
    });

    container.querySelectorAll('[data-accent-option]').forEach((swatch) => {
        swatch.setAttribute(
            'aria-checked',
            String(swatch.dataset.accentOption === accent),
        );
    });
}

/**
 * Fills `container` (any element) with the theme + accent picker and wires
 * it up — shared by the header's modal panel and the Settings ->
 * Appearance section, so there's exactly one implementation of "pick a
 * theme" in the app. Re-renders after each pick so the previews and
 * swatches follow the new theme/accent.
 */
export function renderThemeGrid(container) {
    container.classList.add('theme-picker');
    render(container);

    container.addEventListener('click', (event) => {
        const card = event.target.closest('[data-theme-option]');
        const swatch = event.target.closest('[data-accent-option]');

        if (card) {
            setTheme(card.dataset.themeOption);
        } else if (swatch) {
            setAccent(swatch.dataset.accentOption);
        } else {
            return;
        }

        render(container);
    });
}

export function openThemePicker() {
    const { modal } = openModal({
        title: t('theme.picker_title'),
        wide: true,
        bodyHtml: `
            <p class="theme-picker__hint mb-4">${t('theme.picker_subtitle')}</p>
            <div data-theme-grid></div>
        `,
    });

    renderThemeGrid(modal.querySelector('[data-theme-grid]'));
}

/** Wires up every `[data-theme-picker-trigger]` button to open the panel. */
export function initThemePicker() {
    watchSystemTheme();

    document
        .querySelectorAll('[data-theme-picker-trigger]')
        .forEach((trigger) => {
            trigger.addEventListener('click', openThemePicker);
        });
}
