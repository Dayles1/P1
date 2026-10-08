/**
 * The settings tab: graphics quality, camera sensitivity, volume and
 * sound, the FPS counter, and which graphics card the browser uses — with
 * a warning when it draws without one.
 */

import { t } from '../i18n';
import { QUALITIES } from '../settings';
import type { Quality } from '../settings';
import { button, element, escape } from './dom';
import type { MenuHost, TabView } from './menu';

export class SettingsTab implements TabView {
    readonly element: HTMLElement;
    private note: HTMLElement;

    constructor(private host: MenuHost) {
        this.element = element('div', 'sb-settings');
        this.note = element('p', 'sb-hint');
    }

    /** Edge smoothing only follows "high" after a reload: say so. */
    noteQuality(quality: Quality): void {
        this.note.textContent =
            (quality === 'high') !== this.host.graphics.smoothing
                ? `${t.quality_hint} ${t.smoothing_note}`
                : t.quality_hint;
    }

    render(): void {
        const { settings, graphics } = this.host;

        const quality = element('div', 'sb-segmented');

        for (const each of QUALITIES) {
            quality.append(
                button(
                    `sb-segment${each === settings.quality ? ' sb-segment--active' : ''}`,
                    t.qualities[each],
                    () => {
                        this.host.changeSettings({ quality: each });
                        this.render();
                    },
                ),
            );
        }

        this.noteQuality(settings.quality);

        const sensitivity = this.slider(
            settings.sensitivity,
            0.4,
            2,
            0.1,
            (value) => this.host.changeSettings({ sensitivity: value }),
            (value) => `${value.toFixed(1)}×`,
        );
        const volume = this.slider(
            settings.volume,
            0,
            1,
            0.05,
            (value) => this.host.changeSettings({ volume: value }),
            (value) => `${Math.round(value * 100)}%`,
        );

        const sound = this.toggle(!this.host.muted(), () => {
            this.host.toggleMute();
            this.render();
        });
        const fps = this.toggle(settings.showFps, () => {
            this.host.changeSettings({ showFps: !settings.showFps });
            this.render();
        });

        const gpu = element('div', 'sb-settings__gpu');
        gpu.innerHTML = `<code>${escape(graphics.gpu || '—')}</code>`;

        if (graphics.software) {
            gpu.append(element('p', 'sb-warning', t.gpu_software));
        }

        this.element.replaceChildren(
            this.row(t.quality, quality, this.note),
            this.row(t.sensitivity, sensitivity),
            this.row(t.volume, volume),
            this.row(t.sound, sound),
            this.row(t.show_fps, fps),
            this.row(t.gpu, gpu),
        );
    }

    private row(label: string, ...controls: HTMLElement[]): HTMLElement {
        const row = element('div', 'sb-settings__row');
        const control = element('div', 'sb-settings__control');
        control.append(...controls);
        row.append(element('span', 'sb-settings__label', label), control);

        return row;
    }

    private slider(
        value: number,
        min: number,
        max: number,
        step: number,
        onChange: (value: number) => void,
        format: (value: number) => string,
    ): HTMLElement {
        const wrap = element('label', 'sb-slider');
        const input = element('input', '');
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(value);
        const shown = element('span', 'sb-slider__value', format(value));
        input.addEventListener('input', () => {
            const next = Number(input.value);
            shown.textContent = format(next);
            onChange(next);
        });
        wrap.append(input, shown);

        return wrap;
    }

    private toggle(on: boolean, onClick: () => void): HTMLElement {
        const toggle = button(
            `sb-toggle${on ? ' sb-toggle--on' : ''}`,
            '',
            onClick,
        );
        toggle.setAttribute('role', 'switch');
        toggle.setAttribute('aria-checked', String(on));
        toggle.append(element('span', 'sb-toggle__knob'));

        return toggle;
    }
}
