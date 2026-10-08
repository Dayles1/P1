/**
 * Everything drawn over the 3D view while playing: the clock and biome,
 * the save status, the hero's level and experience, health, mana,
 * stamina and armour, the menu buttons, what the keys (or buttons) would
 * do right now, pick-up notes, the hotbar with the class skill next to
 * it, a strip of carried resources, the stance, the breath bar, a red
 * flash when hurt, the level-up banner, the pause card, the death card
 * and the debug readout.
 *
 * On a computer every button shows the key that does the same (I, Q, P,
 * Esc, G, Enter); on a touch screen they are just buttons. The vitals sit
 * at the bottom left on a computer and move to the top left on a touch
 * screen, out of the thumbs' way.
 */

import type { Hero } from '../hero';
import type { Tab } from '../i18n';
import { t } from '../i18n';
import { condition, HOTBAR } from '../inventory';
import type { Inventory } from '../inventory';
import { ITEMS } from '../items';
import type { ItemId } from '../items';
import { throughArmor } from '../player/vitals';
import type { Vitals } from '../player/vitals';
import { button, element, icon } from './dom';
import type { IconName } from './icons';

export type PromptKey = 'attack' | 'use' | 'place' | 'skill' | 'rise' | 'dive';

/** What the crosshair is over: a creature, something else to use, nothing. */
export type AimTarget = 'enemy' | 'thing' | null;

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
    skill: () => void;
}

const PROMPT_ICONS: Record<PromptKey, IconName> = {
    attack: 'sword',
    use: 'hand',
    place: 'build',
    skill: 'spark',
    rise: 'jump',
    dive: 'crouch',
};

/** A key's label on a button (computers only). */
export function keyBadge(key: string): HTMLElement {
    return element('kbd', 'sb-key', key);
}

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
    private manaFill: HTMLElement;
    private manaText: HTMLElement;
    private staminaFill: HTMLElement;
    private armorText: HTMLElement;
    private vitals: HTMLElement;
    private heroLine: HTMLElement;
    private levelBadge: HTMLElement;
    private xpFill: HTMLElement;
    private skill: HTMLButtonElement;
    private skillShade: HTMLElement;
    private skillCost: HTMLElement;
    private banner: HTMLElement;
    private aim: HTMLElement;
    private aimKey = '';
    private bannerTimer = 0;
    private skillKey = '';
    private heroKey = '';
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
            artifacts: 'O',
        };

        for (const [tab, iconName] of [
            ['bag', 'bag'],
            ['craft', 'craft'],
            ['hero', 'hero'],
            ['artifacts', 'gem'],
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

            if (!touch) {
                open.append(keyBadge(keys[tab]));
            }

            menu.append(open);
        }

        const pause = button('sb-round', '', actions.pause, 'pause');
        pause.title = `${t.paused} (Esc)`;
        pause.setAttribute('aria-label', t.paused);
        this.guardTouch(pause, actions.pause);

        if (!touch) {
            pause.append(keyBadge('Esc'));
        }

        menu.append(pause);
        corner.append(this.status, menu);

        this.vitals = element('div', 'sb-vitals');
        const heroRow = element('div', 'sb-vitals__hero');
        this.levelBadge = element('span', 'sb-level');
        this.heroLine = element('span', 'sb-vitals__name');
        const xp = element('div', 'sb-xp');
        this.xpFill = element('div', 'sb-xp__fill');
        xp.append(this.xpFill);
        heroRow.append(this.levelBadge, this.heroLine, xp);

        const bar = (kind: string, iconName: IconName | null) => {
            const row = element(
                'div',
                `sb-vitals__row sb-vitals__row--${kind}`,
            );
            const track = element('div', `sb-bar sb-bar--${kind}`);
            const fill = element('div', 'sb-bar__fill');
            const text = element('span', 'sb-bar__text');
            track.append(fill, text);

            if (iconName) {
                row.append(icon(iconName, `sb-ui-icon sb-vitals__${kind}`));
            }

            row.append(track);

            return { row, fill, text };
        };

        const health = bar('health', 'heart');
        this.healthFill = health.fill;
        this.healthText = health.text;
        const mana = bar('mana', 'spark');
        this.manaFill = mana.fill;
        this.manaText = mana.text;
        const stamina = bar('stamina', null);
        this.staminaFill = stamina.fill;
        stamina.row.title = t.stamina;
        const armor = element('div', 'sb-vitals__armor');
        this.armorText = element('span', '');
        armor.append(icon('shield'), this.armorText);
        this.vitals.append(heroRow, health.row, mana.row, stamina.row, armor);
        heroRow.hidden = true;
        mana.row.hidden = true;

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

        if (!touch) {
            this.playButton.append(keyBadge('Enter'));
        }

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
        const wake = button(
            'sb-button sb-button--primary sb-card__play',
            t.respawn,
            actions.respawn,
            'play',
        );

        if (!touch) {
            wake.append(keyBadge('Enter'));
        }

        deathCard.append(
            icon('skull', 'sb-ui-icon sb-death__icon'),
            element('h1', '', t.died),
            this.deathCause,
            this.deathWake,
            wake,
        );
        this.death.append(deathCard);

        // Enter plays (or wakes up) without reaching for the mouse.
        window.addEventListener('keydown', (event) => {
            if (event.code !== 'Enter' && event.code !== 'NumpadEnter') {
                return;
            }

            if (!this.death.hidden) {
                actions.respawn();
            } else if (!this.overlay.hidden) {
                actions.start();
            }
        });

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

        // The class skill, right of the hotbar.
        this.skill = element('button', 'sb-hotbar__slot sb-skill');
        this.skill.type = 'button';
        this.skill.hidden = true;
        this.skillShade = element('span', 'sb-skill__shade');
        this.skillCost = element('span', 'sb-skill__cost');
        this.skill.append(
            icon('spark', 'sb-ui-icon sb-skill__icon'),
            this.skillShade,
            this.skillCost,
        );

        if (!touch) {
            this.skill.append(element('span', 'sb-hotbar__key', 'G'));
        }

        this.skill.addEventListener('click', (event) => {
            event.stopPropagation();
            actions.skill();
        });
        this.guardTouch(this.skill, actions.skill);
        this.hotbar.append(this.skill);

        this.banner = element('div', 'sb-banner');
        this.banner.hidden = true;

        // The crosshair: where blows, bolts and E go.
        this.aim = element('div', 'sb-aim');
        this.aim.hidden = true;

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
            this.aim,
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
            this.banner,
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
                          {
                              attack: t.lmb,
                              use: 'E',
                              place: 'R',
                              skill: 'G',
                              rise: t.key_space,
                              dive: 'C',
                          }[line.key],
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

    /** Health, mana and stamina bars, and armour points. */
    setVitals(vitals: Vitals, armor: number): void {
        const shown = Math.ceil(vitals.health);
        const mana = Math.floor(vitals.mana);
        const stamina = Math.round((vitals.stamina / vitals.maxStamina) * 50);
        armor = Math.round(armor * 10) / 10;
        const key = `${shown}/${vitals.maxHealth}|${mana}/${vitals.maxMana}|${stamina}|${armor}`;

        if (key === this.vitalsKey) {
            return;
        }

        this.vitalsKey = key;
        const share = Math.max(0, vitals.health / vitals.maxHealth);
        this.healthFill.style.width = `${share * 100}%`;
        this.healthText.textContent = `${shown} / ${vitals.maxHealth}`;
        this.vitals.classList.toggle('sb-vitals--low', share < 0.3);
        this.vignette.classList.toggle('sb-vignette--low', share < 0.3);
        this.manaFill.parentElement!.parentElement!.hidden =
            vitals.maxMana === 0;

        if (vitals.maxMana > 0) {
            this.manaFill.style.width = `${(vitals.mana / vitals.maxMana) * 100}%`;
            this.manaText.textContent = `${mana} / ${vitals.maxMana}`;
        }

        this.staminaFill.style.width = `${stamina * 2}%`;
        this.staminaFill.parentElement!.classList.toggle(
            'sb-bar--out',
            stamina === 0,
        );
        this.armorText.textContent = `${armor} · ${Math.round((1 - throughArmor(armor)) * 100)}%`;
        this.armorText.parentElement!.hidden = armor === 0;
        this.armorText.parentElement!.title = `${t.armor}: ${Math.round((1 - throughArmor(armor)) * 100)}% ${t.armor_blocks}`;
    }

    /** The crosshair: shown while playing, red over a creature. */
    setAim(shown: boolean, target: AimTarget): void {
        const key = `${shown}|${target}`;

        if (key === this.aimKey) {
            return;
        }

        this.aimKey = key;
        this.aim.hidden = !shown;
        this.aim.classList.toggle('sb-aim--enemy', target === 'enemy');
        this.aim.classList.toggle('sb-aim--thing', target === 'thing');
    }

    /** The hero's level, class and experience. */
    setHero(hero: Hero): void {
        const key = `${hero.level}|${hero.xp}|${hero.freePoints}`;

        if (key === this.heroKey) {
            return;
        }

        this.heroKey = key;
        this.levelBadge.textContent = String(hero.level);
        this.levelBadge.classList.toggle(
            'sb-level--points',
            hero.freePoints > 0,
        );
        this.levelBadge.title =
            hero.freePoints > 0
                ? `${t.free_points}: ${hero.freePoints} (P)`
                : t.level;
        this.heroLine.textContent = `${t.classes[hero.heroClass][0]} · ${t.level_short} ${hero.level}`;
        this.xpFill.style.width = hero.maxed
            ? '100%'
            : `${(hero.xp / hero.toNext) * 100}%`;
        this.xpFill.parentElement!.title = hero.maxed
            ? t.max_level
            : `${t.xp}: ${hero.xp} / ${hero.toNext}`;
        this.heroLine.parentElement!.hidden = false;
    }

    /** The skill button: ready, cooling down, or short of mana. */
    setSkill(
        hero: Hero | null,
        cooldown: number,
        mana: number,
        active: boolean,
    ): void {
        if (!hero) {
            this.skill.hidden = true;

            return;
        }

        const skill = hero.skill;
        const share = cooldown > 0 ? cooldown / skill.cooldown : 0;
        const short = mana < skill.cost;
        const key = `${skill.name}|${Math.ceil(share * 20)}|${short}|${active}`;

        if (key === this.skillKey) {
            return;
        }

        this.skillKey = key;
        this.skill.hidden = false;
        this.skill.title = `${t.skills[skill.name][0]} — ${t.skills[skill.name][1]}${this.touch ? '' : ' (G)'}`;
        this.skillShade.style.height = `${share * 100}%`;
        this.skillCost.textContent = String(skill.cost);
        this.skill.classList.toggle('sb-skill--short', short);
        this.skill.classList.toggle('sb-skill--active', active);
    }

    /** A banner across the screen: the new level, and points to put in. */
    levelUp(level: number, freePoints: number): void {
        this.banner.replaceChildren(
            element('strong', '', `${t.level_up}: ${level}`),
            ...(freePoints > 0
                ? [
                      element(
                          'span',
                          '',
                          `${t.free_points}: ${freePoints}${this.touch ? '' : ' — P'}`,
                      ),
                  ]
                : []),
        );
        this.banner.hidden = false;
        this.banner.classList.remove('sb-banner--shown');
        void this.banner.offsetWidth;
        this.banner.classList.add('sb-banner--shown');
        window.clearTimeout(this.bannerTimer);
        this.bannerTimer = window.setTimeout(() => {
            this.banner.hidden = true;
        }, 3600);
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
