/**
 * Everything drawn over the 3D view while playing: the clock and biome,
 * the save status, health and armour, the menu buttons, what the keys
 * (or buttons) would do right now, pick-up notes, the hotbar, a strip of
 * carried resources, the stance, the breath bar, a red flash when hurt,
 * the pause card, the death card and the debug readout.
 *
 * On a computer the vitals sit at the bottom left; on a touch screen they
 * move to the top left, out of the thumbs' way.
 */

import type { Tab } from '../i18n';
import { t } from '../i18n';
import { condition, HOTBAR } from '../inventory';
import type { Inventory } from '../inventory';
import { ITEMS } from '../items';
import type { ItemId } from '../items';
import { MAX_HEALTH, throughArmor } from '../player/vitals';
import { button, element, icon } from './dom';
import type { IconName } from './icons';

export type PromptKey = 'attack' | 'use' | 'place';

export interface PromptLine {
    key: PromptKey;
    text: string;
}

export interface HudActions {
    start: () => void;
    select: (slot: number) => void;
    open: (tab: Tab) => void;
    pause: () => void;
    respawn: () => void;
}

const PROMPT_ICONS: Record<PromptKey, IconName> = {
    attack: 'sword',
    use: 'hand',
    place: 'build',
};

export class Hud {
    private overlay: HTMLElement;
    private startText: HTMLElement;
    private playButton: HTMLButtonElement;
    private death: HTMLElement;
    private deathCause: HTMLElement;
    private deathWake: HTMLElement;
    private status: HTMLElement;
    private clock: HTMLElement;
    private fps: HTMLElement;
    private prompt: HTMLElement;
    private toasts: HTMLElement;
    private hotbar: HTMLElement;
    private strip: HTMLElement;
    private stance: HTMLElement;
    private breath: HTMLElement;
    private breathFill: HTMLElement;
    private healthFill: HTMLElement;
    private healthText: HTMLElement;
    private armorText: HTMLElement;
    private vitals: HTMLElement;
    private vignette: HTMLElement;
    private debug: HTMLElement;
    private statusTimer = 0;
    private promptKey = '';
    private clockText = '';
    private vitalsKey = '';

    constructor(
        root: HTMLElement,
        backUrl: string,
        private touch: boolean,
        actions: HudActions,
    ) {
        const top = element('div', 'sb-top');
        const back = element('a', 'sb-back', `← ${t.back}`);
        back.href = backUrl;
        this.clock = element('span', 'sb-clock');
        this.fps = element('span', 'sb-fps');
        this.fps.hidden = true;
        top.append(back, this.clock, this.fps);

        const corner = element('div', 'sb-corner');
        this.status = element('span', 'sb-status');
        const menu = element('nav', 'sb-menu-buttons');
        const keys: Record<string, string> = {
            bag: 'I',
            craft: 'Q',
            hero: 'P',
        };

        for (const [tab, iconName] of [
            ['bag', 'bag'],
            ['craft', 'craft'],
            ['hero', 'hero'],
        ] as [Tab, IconName][]) {
            const open = button(
                'sb-round',
                '',
                () => actions.open(tab),
                iconName,
            );
            open.title = touch ? t.tabs[tab] : `${t.tabs[tab]} (${keys[tab]})`;
            open.setAttribute('aria-label', t.tabs[tab]);
            this.guardTouch(open, () => actions.open(tab));
            menu.append(open);
        }

        const pause = button('sb-round', '', actions.pause, 'pause');
        pause.title = `${t.paused} (Esc)`;
        pause.setAttribute('aria-label', t.paused);
        this.guardTouch(pause, actions.pause);
        menu.append(pause);
        corner.append(this.status, menu);

        this.vitals = element('div', 'sb-vitals');
        const health = element('div', 'sb-vitals__row');
        const bar = element('div', 'sb-bar sb-bar--health');
        this.healthFill = element('div', 'sb-bar__fill');
        this.healthText = element('span', 'sb-bar__text');
        bar.append(this.healthFill, this.healthText);
        health.append(icon('heart', 'sb-ui-icon sb-vitals__heart'), bar);
        const armor = element('div', 'sb-vitals__armor');
        this.armorText = element('span', '');
        armor.append(icon('shield'), this.armorText);
        this.vitals.append(health, armor);

        this.overlay = element('div', 'sb-overlay');
        const card = element('div', 'sb-card');
        this.startText = element(
            'p',
            'sb-start',
            touch ? t.start_touch : t.start,
        );
        this.playButton = button(
            'sb-button sb-button--primary sb-card__play',
            t.play,
            actions.start,
            'play',
        );
        const row = element('div', 'sb-card__row');
        row.append(
            button('sb-button', t.tabs.bag, () => actions.open('bag'), 'bag'),
            button(
                'sb-button',
                t.tabs.settings,
                () => actions.open('settings'),
                'settings',
            ),
        );
        const exit = element('a', 'sb-button');
        exit.href = backUrl;
        exit.append(icon('exit'), element('span', '', t.exit));
        row.append(exit);
        card.append(
            element('h1', '', t.title),
            this.startText,
            this.playButton,
            row,
        );

        if (!touch) {
            const controls = element('details', 'sb-card__controls');
            const list = element('dl', 'sb-controls');

            for (const [key, action] of t.controls) {
                list.append(element('dt', '', key), element('dd', '', action));
            }

            controls.append(element('summary', '', t.controls_title), list);
            card.append(controls);
        }

        this.overlay.append(card);
        this.overlay.addEventListener('click', (event) => {
            if (event.target === this.overlay) {
                actions.start();
            }
        });

        this.death = element('div', 'sb-overlay sb-death');
        this.death.hidden = true;
        const deathCard = element('div', 'sb-card sb-card--death');
        this.deathCause = element('p', 'sb-death__cause');
        this.deathWake = element('p', 'sb-start');
        deathCard.append(
            icon('skull', 'sb-ui-icon sb-death__icon'),
            element('h1', '', t.died),
            this.deathCause,
            this.deathWake,
            button(
                'sb-button sb-button--primary sb-card__play',
                t.respawn,
                actions.respawn,
                'play',
            ),
        );
        this.death.append(deathCard);

        this.prompt = element('div', 'sb-prompt');
        this.toasts = element('div', 'sb-toasts');
        this.hotbar = element('div', 'sb-hotbar');

        for (let slot = 0; slot < HOTBAR; slot++) {
            const cell = element('button', 'sb-hotbar__slot');
            cell.type = 'button';
            cell.addEventListener('click', () => actions.select(slot));
            this.guardTouch(cell, () => actions.select(slot));
            this.hotbar.append(cell);
        }

        this.strip = element('div', 'sb-strip');
        this.stance = element('div', 'sb-stance');
        this.stance.hidden = true;
        this.breath = element('div', 'sb-breath');
        this.breathFill = element('div', 'sb-breath__fill');
        this.breath.append(this.breathFill);
        this.breath.hidden = true;
        this.vignette = element('div', 'sb-vignette');
        this.debug = element('pre', 'sb-debug');
        this.debug.hidden = true;

        const rotate = element('div', 'sb-rotate');
        rotate.append(
            element('span', 'sb-rotate__icon', '⟳'),
            element('p', '', t.rotate),
        );

        root.append(
            this.vignette,
            top,
            corner,
            this.vitals,
            this.prompt,
            this.toasts,
            this.hotbar,
            this.strip,
            this.stance,
            this.breath,
            this.debug,
            this.overlay,
            this.death,
            rotate,
        );
    }

    get debugShown(): boolean {
        return !this.debug.hidden;
    }

    /** The pause card: "Play" the first time, "Resume" after. */
    showPaused(paused: boolean, started = false): void {
        this.overlay.hidden = !paused;

        if (paused) {
            this.startText.textContent = started
                ? t.paused
                : this.touch
                  ? t.start_touch
                  : t.start;
            this.playButton.querySelector('span:last-child')!.textContent =
                started ? t.resume : t.play;
        }
    }

    /** The death card (null hides it). */
    showDeath(cause: string | null, wake = ''): void {
        this.death.hidden = cause === null;
        this.deathCause.textContent = cause ?? '';
        this.deathWake.textContent = wake;
    }

    /** "☀ 13:40 · Forest". */
    setClock(time: number, biome: string): void {
        const minutes = Math.floor(time * 24 * 60);
        const day = time > 0.25 && time < 0.75;
        const text = `${day ? '☀' : '☾'} ${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')} · ${biome}`;

        if (text !== this.clockText) {
            this.clockText = text;
            this.clock.textContent = text;
        }
    }

    /** The FPS counter (null hides it). */
    setFps(text: string | null): void {
        this.fps.hidden = text === null;

        if (text !== null && this.fps.textContent !== text) {
            this.fps.textContent = text;
        }
    }

    setPrompt(lines: PromptLine[]): void {
        const key = lines.map((line) => line.key + line.text).join('|');

        if (key === this.promptKey) {
            return;
        }

        this.promptKey = key;
        this.prompt.replaceChildren(
            ...lines.map((line) => {
                const row = element('div', 'sb-prompt__line');
                const label = this.touch
                    ? icon(PROMPT_ICONS[line.key], 'sb-ui-icon sb-prompt__icon')
                    : element(
                          'kbd',
                          '',
                          { attack: t.lmb, use: 'E', place: 'R' }[line.key],
                      );
                row.append(label, element('span', '', line.text));

                return row;
            }),
        );
    }

    /** A short note that floats up and fades: "+2 Wood". */
    toast(text: string, item?: ItemId, tone: 'plain' | 'bad' = 'plain'): void {
        const note = element(
            'div',
            `sb-toast${tone === 'bad' ? ' sb-toast--bad' : ''}`,
        );

        if (item) {
            const picture = element('span', 'sb-icon');
            picture.innerHTML = ITEMS[item].icon;
            note.append(picture);
        }

        note.append(element('span', '', text));
        this.toasts.append(note);
        window.setTimeout(() => note.remove(), 1800);

        while (this.toasts.children.length > 4) {
            this.toasts.firstElementChild?.remove();
        }
    }

    setStatus(text: string): void {
        this.status.textContent = text;
        this.status.classList.add('sb-status--shown');
        window.clearTimeout(this.statusTimer);
        this.statusTimer = window.setTimeout(
            () => this.status.classList.remove('sb-status--shown'),
            1600,
        );
    }

    setStance(text: string | null): void {
        this.stance.hidden = text === null;
        this.stance.textContent = text ?? '';
    }

    /** The breath bar shows only while it is not full. */
    setBreath(breath: number): void {
        this.breath.hidden = breath >= 0.999;
        this.breathFill.style.width = `${Math.round(breath * 100)}%`;
        this.breath.classList.toggle('sb-breath--low', breath < 0.3);
    }

    /** Health bar and armour points. */
    setVitals(health: number, armor: number): void {
        const shown = Math.ceil(health);
        const key = `${shown}|${armor}`;

        if (key === this.vitalsKey) {
            return;
        }

        this.vitalsKey = key;
        const share = Math.max(0, health / MAX_HEALTH);
        this.healthFill.style.width = `${share * 100}%`;
        this.healthText.textContent = `${shown}`;
        this.vitals.classList.toggle('sb-vitals--low', share < 0.3);
        this.vignette.classList.toggle('sb-vignette--low', share < 0.3);
        this.armorText.textContent = `${armor} · ${Math.round((1 - throughArmor(armor)) * 100)}%`;
        this.armorText.parentElement!.hidden = armor === 0;
        this.armorText.parentElement!.title = `${t.armor}: ${Math.round((1 - throughArmor(armor)) * 100)}% ${t.armor_blocks}`;
    }

    /** A red flash around the edges. */
    hurt(): void {
        this.vignette.classList.remove('sb-vignette--hit');
        // Restart the animation.
        void this.vignette.offsetWidth;
        this.vignette.classList.add('sb-vignette--hit');
    }

    /** Hotbar slots and the totals of carried resources. */
    setInventory(inventory: Inventory): void {
        Array.from(this.hotbar.children).forEach((cell, slot) => {
            const stack = inventory.slots[slot];
            cell.classList.toggle(
                'sb-hotbar__slot--selected',
                slot === inventory.selected,
            );
            (cell as HTMLElement).title = stack ? t.items[stack.item][0] : '';
            cell.innerHTML =
                `<span class="sb-hotbar__key">${slot + 1}</span>` +
                (stack
                    ? `<span class="sb-icon">${ITEMS[stack.item].icon}</span>` +
                      (stack.count > 1
                          ? `<span class="sb-hotbar__count">${stack.count}</span>`
                          : '') +
                      (ITEMS[stack.item].durability
                          ? `<span class="sb-wear"><span style="width:${Math.round(condition(stack) * 100)}%"></span></span>`
                          : '')
                    : '');
        });

        this.strip.replaceChildren(
            ...(Object.keys(ITEMS) as ItemId[])
                .filter(
                    (item) =>
                        !ITEMS[item].durability &&
                        !ITEMS[item].tool &&
                        !ITEMS[item].placeable,
                )
                .map((item) => [item, inventory.total(item)] as const)
                .filter(([, count]) => count > 0)
                .map(([item, count]) => {
                    const chip = element('div', 'sb-strip__item');
                    chip.title = t.items[item][0];
                    const picture = element('span', 'sb-icon');
                    picture.innerHTML = ITEMS[item].icon;
                    chip.append(picture);

                    if (!ITEMS[item].artifact) {
                        chip.append(element('span', '', String(count)));
                    }

                    return chip;
                }),
        );
    }

    toggleDebug(): void {
        this.debug.hidden = !this.debug.hidden;
    }

    setDebug(text: string): void {
        this.debug.textContent = text;
    }

    /** On a touch screen a tap must not also start looking around. */
    private guardTouch(target: HTMLElement, action: () => void): void {
        target.addEventListener(
            'touchstart',
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                action();
            },
            { passive: false },
        );
    }
}
