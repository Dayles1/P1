/**
 * Everything drawn over the 3D view while playing, in the «Кремень» style
 * (chipped plates on basalt, a spark of orange for what matters now):
 *
 * - top left: the hero — an octagon portrait with the level in a diamond,
 *   experience, free points — and under it what is in effect (a fire
 *   near, the skill cooling down…);
 * - top middle: the compass with the sleeping bag and chests on it, the
 *   time with how long until sunset (orange near nightfall) and the land;
 *   under it the creature being fought, with its health;
 * - top right: the save status and the menu buttons; under them the feed
 *   of what was picked up ("+3 Wood 67", growing when it repeats);
 * - the middle: the crosshair (red over a creature), what the mouse would
 *   do, and the damage dealt floating up from where it landed;
 * - bottom left: carried resources; bottom middle: the held item with its
 *   durability, health (armour beside it), mana and stamina in bars of
 *   ten shares, the hotbar and the class skill as a diamond that fills as
 *   it recharges; bottom right: what the keys do right now;
 * - and the stance, the breath bar, a red flash when hurt, the level-up
 *   banner, the pause and death cards and the debug readout.
 *
 * On a computer every button shows its key; on a touch screen they are
 * just buttons, the bars move up under the hero and the key panels go.
 */

import type { Hero, HeroClass } from '../hero';
import type { Tab } from '../i18n';
import { t } from '../i18n';
import { condition, HOTBAR } from '../inventory';
import type { Inventory } from '../inventory';
import { ITEMS } from '../items';
import type { ItemId } from '../items';
import { throughArmor } from '../player/vitals';
import type { Vitals } from '../player/vitals';
import type { Biome } from '../world/biomes';
import { DAY_LENGTH } from '../world/sky';
import { button, element, icon } from './dom';
import { ICONS } from './icons';
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

/** A place shown on the compass: which way (radians, clockwise from north) and how far. */
export interface CompassMark {
    label: string;
    bearing: number;
    distance: number;
    tone: 'bag' | 'chest' | 'start';
}

/** Something in effect, as a small square under the hero. */
export interface Effect {
    icon: IconName;
    color: string;
    title: string;
    /** Seconds left, shown under the icon. */
    timer?: number;
    /** A line of text beside the squares. */
    note?: string;
}

/** The creature being fought. */
export interface TargetInfo {
    name: string;
    share: number;
    state: 'attacks' | 'flees' | null;
}

const PROMPT_ICONS: Record<PromptKey, IconName> = {
    attack: 'sword',
    use: 'hand',
    place: 'build',
    skill: 'spark',
    rise: 'jump',
    dive: 'crouch',
};

const CLASS_ICONS: Record<HeroClass, IconName> = {
    tank: 'shield',
    fighter: 'sword',
    assassin: 'speed',
    mage: 'spark',
};

const BIOME_COLORS: Record<Biome, string> = {
    meadow: '#B6E05A',
    forest: '#7FCB6A',
    desert: '#F2C14E',
    snow: '#CFE4FF',
    mountains: '#C9C1AE',
};

/** How long a line of the feed stays, ms (a repeat starts it again). */
const FEED_MS = 3000;
/** The compass shows this far either side of where the camera looks (radians). */
const COMPASS_SPAN = Math.PI / 2;
/** Night is near: the clock turns orange this long before sunset, ms. */
const DUSK_WARNING = 2 * 60_000;

/** A key's label on a button (computers only). */
export function keyBadge(key: string): HTMLElement {
    return element('kbd', 'sb-key', key);
}

/** "6:40" from milliseconds. */
function minutes(ms: number): string {
    const seconds = Math.max(0, Math.round(ms / 1000));

    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** An angle brought into −π…π. */
function wrap(angle: number): number {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** A bar of ten shares with a pale tail for what was just lost. */
class Bar {
    readonly element: HTMLElement;
    private fill: HTMLElement;
    private tail: HTMLElement;

    constructor(kind: string) {
        this.element = element('div', `sb-bar sb-bar--${kind}`);
        this.tail = element('div', 'sb-bar__tail');
        this.fill = element('div', 'sb-bar__fill');
        this.element.append(this.tail, this.fill);
    }

    set(share: number): void {
        const width = `${Math.max(0, Math.min(1, share)) * 100}%`;
        this.fill.style.width = width;
        this.tail.style.width = width;
    }
}

interface FeedLine {
    element: HTMLElement;
    count: HTMLElement;
    total: HTMLElement;
    added: number;
    timer: number;
}

export class Hud {
    private overlay: HTMLElement;
    private startText: HTMLElement;
    private playButton: HTMLButtonElement;
    private death: HTMLElement;
    private deathCause: HTMLElement;
    private deathWake: HTMLElement;
    private status: HTMLElement;
    private fps: HTMLElement;
    private heroPlate: HTMLElement;
    private portraitIcon: HTMLElement;
    private levelBadge: HTMLElement;
    private heroName: HTMLElement;
    private xpText: HTMLElement;
    private xpBar = new Bar('xp');
    private pointsLine: HTMLElement;
    private heroButton: HTMLButtonElement | null = null;
    private effects: HTMLElement;
    private compass: HTMLElement;
    private compassTape: HTMLElement;
    private clock: HTMLElement;
    private target: HTMLElement;
    private targetName: HTMLElement;
    private targetState: HTMLElement;
    private targetBar = new Bar('health');
    private feed: HTMLElement;
    /** Feed lines that grow when the same thing comes again, by what it is. */
    private feedLines = new Map<string, FeedLine>();
    private aim: HTMLElement;
    private aimHint: HTMLElement;
    private damages: HTMLElement;
    private now: HTMLElement;
    private nowLines: HTMLElement;
    private held: HTMLElement;
    private bars: HTMLElement;
    private healthText: HTMLElement;
    private armorText: HTMLElement;
    private manaText: HTMLElement;
    private staminaText: HTMLElement;
    private healthBar = new Bar('health');
    private manaBar = new Bar('mana');
    private staminaBar = new Bar('stamina');
    private manaPart: HTMLElement;
    private hotbar: HTMLElement;
    private skill: HTMLButtonElement;
    private skillFill: HTMLElement;
    private skillCost: HTMLElement;
    private strip: HTMLElement;
    private stance: HTMLElement;
    private breath: HTMLElement;
    private breathFill: HTMLElement;
    private banner: HTMLElement;
    private vignette: HTMLElement;
    private debug: HTMLElement;
    private aimKey = '';
    private bannerTimer = 0;
    private skillKey = '';
    private heroKey = '';
    private statusTimer = 0;
    private promptKey = '';
    private clockKey = '';
    private compassKey = '';
    private targetKey = '';
    private effectsKey = '';
    private vitalsKey = '';
    private heldKey = '';

    constructor(
        root: HTMLElement,
        backUrl: string,
        private touch: boolean,
        actions: HudActions,
    ) {
        // ◆ The hero.
        this.heroPlate = element('button', 'sb-plate sb-hero-plate');
        (this.heroPlate as HTMLButtonElement).type = 'button';
        this.heroPlate.hidden = true;
        this.heroPlate.addEventListener('click', () => actions.open('hero'));
        this.guardTouch(this.heroPlate, () => actions.open('hero'));
        const portrait = element('span', 'sb-portrait');
        this.portraitIcon = element('span', 'sb-portrait__icon');
        this.levelBadge = element('span', 'sb-level');
        portrait.append(this.portraitIcon, this.levelBadge);
        const heroInfo = element('span', 'sb-hero-plate__info');
        const heroHead = element('span', 'sb-hero-plate__head');
        this.heroName = element('span', 'sb-hero-plate__name');
        this.xpText = element('span', 'sb-hero-plate__xp');
        heroHead.append(this.heroName, this.xpText);
        this.pointsLine = element('span', 'sb-hero-plate__points');
        heroInfo.append(heroHead, this.xpBar.element, this.pointsLine);
        this.heroPlate.append(portrait, heroInfo);

        this.effects = element('div', 'sb-effects');

        // ◆ The compass, the clock and the land, the target.
        this.compass = element('div', 'sb-plate sb-compass');
        this.compassTape = element('div', 'sb-compass__tape');
        this.compass.append(this.compassTape);
        const pointer = element('div', 'sb-compass__pointer');
        this.clock = element('div', 'sb-clock');
        const compassBox = element('div', 'sb-compass-box');
        compassBox.append(this.compass, pointer, this.clock);

        this.target = element('div', 'sb-plate sb-target');
        this.target.hidden = true;
        const targetHead = element('div', 'sb-target__head');
        this.targetName = element('span', 'sb-target__name');
        this.targetState = element('span', 'sb-target__state');
        targetHead.append(this.targetName, this.targetState);
        this.target.append(targetHead, this.targetBar.element);
        compassBox.append(this.target);

        // ◆ The menu.
        const corner = element('div', 'sb-corner');
        this.status = element('span', 'sb-status');
        this.fps = element('span', 'sb-fps');
        this.fps.hidden = true;
        const back = element('a', 'sb-ib sb-back');
        back.href = backUrl;
        back.title = t.back;
        back.append(icon('exit'));
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
            const open = button('sb-ib', '', () => actions.open(tab), iconName);
            open.title = this.touch
                ? t.tabs[tab]
                : `${t.tabs[tab]} (${keys[tab]})`;
            open.setAttribute('aria-label', t.tabs[tab]);
            this.guardTouch(open, () => actions.open(tab));

            if (!this.touch) {
                open.append(keyBadge(keys[tab]));
            }

            if (tab === 'hero') {
                this.heroButton = open;
            }

            menu.append(open);
        }

        const pause = button('sb-ib', '', actions.pause, 'pause');
        pause.title = `${t.paused} (Esc)`;
        pause.setAttribute('aria-label', t.paused);
        this.guardTouch(pause, actions.pause);
        menu.append(pause);
        corner.append(this.fps, this.status, back, menu);

        this.feed = element('div', 'sb-feed');

        // ◆ The crosshair.
        this.aim = element('div', 'sb-aim');
        this.aim.hidden = true;

        for (const side of ['n', 's', 'w', 'e', 'c']) {
            this.aim.append(element('span', `sb-aim__${side}`));
        }

        this.aimHint = element('div', 'sb-plate sb-aim-hint');
        this.aimHint.hidden = true;
        this.damages = element('div', 'sb-damages');

        // ◆ What the keys do now.
        this.now = element('div', 'sb-plate sb-now');
        const nowHead = element('div', 'sb-label');
        nowHead.append(
            element('span', 'sb-diamond'),
            element('span', '', t.hud.now),
        );
        this.nowLines = element('div', 'sb-now__lines');
        this.now.append(nowHead, this.nowLines);
        this.now.hidden = true;

        // ◆ Held item, bars, hotbar and skill.
        this.held = element('div', 'sb-held');
        this.bars = element('div', 'sb-bars');
        const part = (label: HTMLElement, value: HTMLElement, bar: Bar) => {
            const box = element('div', 'sb-bars__part');
            const head = element('div', 'sb-bars__head');
            head.append(label, value);
            box.append(head, bar.element);

            return box;
        };
        const healthLabel = element('span', 'sb-bars__label');
        this.healthText = element('span', '');
        healthLabel.append(
            icon('heart', 'sb-ui-icon sb-bars__heart'),
            this.healthText,
        );
        this.armorText = element('span', 'sb-bars__armor');
        this.manaText = element('span', '');
        this.staminaText = element('span', '');
        this.manaPart = part(
            element('span', 'sb-bars__label', t.mana),
            this.manaText,
            this.manaBar,
        );
        this.manaPart.hidden = true;
        this.bars.append(
            part(healthLabel, this.armorText, this.healthBar),
            this.manaPart,
            part(
                element('span', 'sb-bars__label', t.stamina),
                this.staminaText,
                this.staminaBar,
            ),
        );

        this.hotbar = element('div', 'sb-hotbar');

        for (let slot = 0; slot < HOTBAR; slot++) {
            const cell = element('button', 'sb-slot sb-hotbar__slot');
            cell.type = 'button';
            cell.addEventListener('click', () => actions.select(slot));
            this.guardTouch(cell, () => actions.select(slot));
            this.hotbar.append(cell);
        }

        // The class skill, right of the hotbar: a diamond that fills as it recharges.
        this.skill = element('button', 'sb-skill');
        this.skill.type = 'button';
        this.skill.hidden = true;
        const inner = element('span', 'sb-skill__inner');
        this.skillFill = element('span', 'sb-skill__fill');
        inner.append(this.skillFill);
        this.skillCost = element('span', 'sb-skill__cost');
        this.skill.append(
            inner,
            icon('spark', 'sb-ui-icon sb-skill__icon'),
            this.skillCost,
        );

        if (!this.touch) {
            this.skill.append(keyBadge('G'));
        }

        this.skill.addEventListener('click', (event) => {
            event.stopPropagation();
            actions.skill();
        });
        this.guardTouch(this.skill, actions.skill);
        this.hotbar.append(this.skill);

        this.strip = element('div', 'sb-plate sb-strip');
        this.strip.hidden = true;
        this.stance = element('div', 'sb-plate sb-stance');
        this.stance.hidden = true;
        this.breath = element('div', 'sb-breath');
        this.breathFill = element('div', 'sb-breath__fill');
        this.breath.append(this.breathFill);
        this.breath.hidden = true;
        this.banner = element('div', 'sb-plate sb-banner');
        this.banner.hidden = true;
        this.vignette = element('div', 'sb-vignette');
        this.debug = element('pre', 'sb-debug');
        this.debug.hidden = true;

        // The pause and death cards.
        this.overlay = element('div', 'sb-overlay');
        const card = element('div', 'sb-card');
        this.startText = element(
            'p',
            'sb-start',
            this.touch ? t.start_touch : t.start,
        );
        this.playButton = button(
            'sb-button sb-button--primary sb-card__play',
            t.play,
            actions.start,
            'play',
        );

        if (!this.touch) {
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

        if (!this.touch) {
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

        if (!this.touch) {
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

        const rotate = element('div', 'sb-rotate');
        rotate.append(
            element('span', 'sb-rotate__icon', '⟳'),
            element('p', '', t.rotate),
        );

        root.append(
            this.vignette,
            this.damages,
            this.aim,
            this.aimHint,
            this.heroPlate,
            this.effects,
            compassBox,
            corner,
            this.feed,
            this.now,
            this.strip,
            this.stance,
            this.breath,
            this.held,
            this.bars,
            this.hotbar,
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

    /** "14:20 · until sunset 6:40 · Forest" — orange when night is near. */
    setClock(time: number, biome: Biome, biomeName: string): void {
        const total = Math.floor(time * 24 * 60);
        const day = time > 0.25 && time < 0.75;
        const left = day
            ? (0.75 - time) * DAY_LENGTH
            : ((((0.25 - time) % 1) + 1) % 1) * DAY_LENGTH;
        const hours = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
        const until = (day ? t.hud.until_sunset : t.hud.until_dawn).replace(
            '{t}',
            minutes(left),
        );
        const dusk = day && left < DUSK_WARNING;
        const key = `${hours}|${until}|${biome}|${dusk}`;

        if (key === this.clockKey) {
            return;
        }

        this.clockKey = key;
        const land = element('b', '', biomeName);
        land.style.color = BIOME_COLORS[biome];
        this.clock.replaceChildren(
            element('b', '', hours),
            element('span', 'sb-clock__until', until),
            land,
        );
        this.clock.classList.toggle('sb-clock--dusk', dusk);
    }

    /** The compass tape: letters and places, where the camera looks in the middle. */
    setCompass(heading: number, marks: CompassMark[]): void {
        const key = `${Math.round(heading * 200)}|${marks.map((mark) => `${mark.label}${Math.round(mark.distance)}${Math.round(mark.bearing * 50)}`).join(',')}`;

        if (key === this.compassKey) {
            return;
        }

        this.compassKey = key;
        const at = (bearing: number) =>
            wrap(bearing - heading) / COMPASS_SPAN / 2 + 0.5;
        const parts: HTMLElement[] = [];

        t.hud.compass.forEach((letter, index) => {
            const share = at((index * Math.PI) / 4);

            if (!letter || share < 0.03 || share > 0.97) {
                return;
            }

            const mark = element(
                'span',
                `sb-compass__letter${index === 0 ? ' sb-compass__letter--north' : ''}`,
                letter,
            );
            mark.style.left = `${share * 100}%`;
            parts.push(mark);
        });

        for (const mark of marks) {
            const share = Math.max(0.08, Math.min(0.92, at(mark.bearing)));
            const place = element(
                'span',
                `sb-compass__mark sb-compass__mark--${mark.tone}`,
            );
            place.append(
                element('span', 'sb-diamond'),
                element(
                    'span',
                    '',
                    `${mark.label} ${Math.round(mark.distance)} ${t.hud.metres}`,
                ),
            );
            place.style.left = `${share * 100}%`;
            parts.push(place);
        }

        this.compassTape.style.setProperty(
            '--sb-tick',
            `${(-(heading / COMPASS_SPAN / 2) * 100) % 5}%`,
        );
        this.compassTape.replaceChildren(...parts);
    }

    /** The creature being fought (null hides the plate). */
    setTarget(target: TargetInfo | null): void {
        const key = target
            ? `${target.name}|${Math.round(target.share * 100)}|${target.state}`
            : '';

        if (key === this.targetKey) {
            return;
        }

        this.targetKey = key;
        this.target.hidden = !target;

        if (target) {
            this.targetName.textContent = target.name;
            this.targetState.textContent = target.state
                ? t.hud[target.state]
                : '';
            this.targetState.className = `sb-target__state sb-target__state--${target.state ?? 'calm'}`;
            this.targetBar.set(target.share);
        }
    }

    /** What is in effect: small squares under the hero, and one line of text. */
    setEffects(effects: Effect[]): void {
        const key = effects
            .map(
                (effect) =>
                    `${effect.icon}${effect.timer ? Math.ceil(effect.timer) : ''}`,
            )
            .join('|');

        if (key === this.effectsKey) {
            return;
        }

        this.effectsKey = key;
        const note = effects.find((effect) => effect.note)?.note;
        this.effects.replaceChildren(
            ...effects.map((effect) => {
                const square = element('span', 'sb-fx');
                square.title = effect.title;
                square.style.color = effect.color;
                square.append(icon(effect.icon));

                if (effect.timer) {
                    square.append(
                        element('b', '', minutes(effect.timer * 1000)),
                    );
                }

                return square;
            }),
            ...(note ? [element('span', 'sb-plate sb-fx__note', note)] : []),
        );
    }

    /** The FPS counter (null hides it). */
    setFps(text: string | null): void {
        this.fps.hidden = text === null;

        if (text !== null && this.fps.textContent !== text) {
            this.fps.textContent = text;
        }
    }

    /**
     * What the keys would do: the mouse's under the crosshair, the rest in
     * the "now" panel (on a touch screen the buttons show it themselves).
     */
    setPrompt(lines: PromptLine[]): void {
        const key = lines.map((line) => line.key + line.text).join('|');

        if (key === this.promptKey) {
            return;
        }

        this.promptKey = key;
        const keyOf = (line: PromptLine) =>
            this.touch
                ? icon(PROMPT_ICONS[line.key], 'sb-ui-icon sb-prompt__icon')
                : keyBadge(
                      {
                          attack: t.lmb,
                          use: 'E',
                          place: 'R',
                          skill: 'G',
                          rise: t.key_space,
                          dive: 'C',
                      }[line.key],
                  );
        const attack = lines.find((line) => line.key === 'attack');
        this.aimHint.hidden = !attack;

        if (attack) {
            this.aimHint.replaceChildren(
                keyOf(attack),
                element('span', '', attack.text),
            );
        }

        const rest = lines.filter((line) => line.key !== 'attack');
        const rows = rest.map((line) => {
            const row = element('div', 'sb-now__line');
            row.append(keyOf(line), element('span', '', line.text));

            return row;
        });

        if (!this.touch) {
            const moves = element('div', 'sb-now__line');
            moves.append(
                keyBadge('Shift'),
                element('span', '', t.hud.run),
                keyBadge('C'),
                element('span', '', t.hud.crouch),
            );
            rows.push(moves);
        }

        this.nowLines.replaceChildren(...rows);
        this.now.hidden = rows.length === 0;
    }

    /** A note in the feed: "Level up", "The pickaxe broke"… */
    toast(
        text: string,
        item?: ItemId | { icon: string },
        tone: 'plain' | 'bad' | 'xp' = 'plain',
    ): void {
        const line = element(
            'div',
            `sb-plate sb-feed__line sb-feed__line--${tone}`,
        );

        if (item) {
            const picture = element('span', 'sb-icon');
            picture.innerHTML =
                typeof item === 'string' ? ITEMS[item].icon : item.icon;
            line.append(picture);
        }

        line.append(element('span', 'sb-feed__text', text));
        this.pushFeed(line);
        window.setTimeout(() => line.remove(), FEED_MS);
    }

    /** "+3 Wood 67" in the feed; picking up more of it soon after adds to the line. */
    gain(item: ItemId, added: number, total: number): void {
        this.bump(
            item,
            ITEMS[item].icon,
            t.items[item][0],
            added,
            String(total),
            'plain',
        );
    }

    /** "+35 experience" in the feed, growing like a pick-up. */
    xp(added: number): void {
        this.bump('xp', ICONS.star, t.hud.xp, added, '', 'xp');
    }

    /** Damage floating up from where it landed (screen pixels); a critical one bigger, in orange. */
    damage(x: number, y: number, amount: number, crit: boolean): void {
        const number = element(
            'span',
            `sb-damage${crit ? ' sb-damage--crit' : ''}`,
            String(Math.round(amount)),
        );
        number.style.left = `${x + (Math.random() - 0.5) * 30}px`;
        number.style.top = `${y}px`;
        this.damages.append(number);
        window.setTimeout(() => number.remove(), 700);
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

    /** Health (with armour beside it), mana and stamina. */
    setVitals(vitals: Vitals, armor: number): void {
        const shown = Math.ceil(vitals.health);
        const mana = Math.floor(vitals.mana);
        const stamina = Math.round(vitals.stamina);
        armor = Math.round(armor * 10) / 10;
        const key = `${shown}/${vitals.maxHealth}|${mana}/${vitals.maxMana}|${stamina}|${armor}`;

        if (key === this.vitalsKey) {
            return;
        }

        this.vitalsKey = key;
        const share = Math.max(0, vitals.health / vitals.maxHealth);
        this.healthBar.set(share);
        this.healthText.textContent = `${shown} / ${vitals.maxHealth}`;
        this.bars.classList.toggle('sb-bars--low', share < 0.3);
        this.vignette.classList.toggle('sb-vignette--low', share < 0.3);
        this.manaPart.hidden = vitals.maxMana === 0;

        if (vitals.maxMana > 0) {
            this.manaBar.set(vitals.mana / vitals.maxMana);
            this.manaText.textContent = `${mana} / ${vitals.maxMana}`;
        }

        this.staminaBar.set(vitals.stamina / vitals.maxStamina);
        this.staminaText.textContent = String(stamina);
        this.staminaBar.element.classList.toggle('sb-bar--out', stamina === 0);
        this.armorText.replaceChildren(
            icon('shield'),
            element('span', '', String(armor)),
        );
        this.armorText.hidden = armor === 0;
        this.armorText.title = `${t.armor}: ${Math.round((1 - throughArmor(armor)) * 100)}% ${t.armor_blocks}`;
    }

    /** The crosshair: shown while playing, red over a creature. */
    setAim(shown: boolean, target: AimTarget): void {
        const key = `${shown}|${target}`;

        if (key === this.aimKey) {
            return;
        }

        this.aimKey = key;
        this.aim.hidden = !shown;
        this.aimHint.classList.toggle('sb-aim-hint--off', !shown);
        this.aim.classList.toggle('sb-aim--enemy', target === 'enemy');
        this.aim.classList.toggle('sb-aim--thing', target === 'thing');
    }

    /** The hero's portrait, level, class, experience and free points. */
    setHero(hero: Hero): void {
        const key = `${hero.heroClass}|${hero.level}|${hero.xp}|${hero.freePoints}`;

        if (key === this.heroKey) {
            return;
        }

        this.heroKey = key;
        this.heroPlate.hidden = false;
        this.portraitIcon.replaceChildren(icon(CLASS_ICONS[hero.heroClass]));
        this.levelBadge.textContent = String(hero.level);
        this.heroName.textContent = t.classes[hero.heroClass][0];
        this.xpText.textContent = hero.maxed
            ? t.max_level
            : t.hud.xp_of
                  .replace('{xp}', String(hero.xp))
                  .replace('{next}', String(hero.toNext));
        this.xpBar.set(hero.maxed ? 1 : hero.xp / hero.toNext);
        this.pointsLine.hidden = hero.freePoints === 0;
        this.pointsLine.replaceChildren(
            element(
                'span',
                'sb-hero-plate__gold',
                t.hud.points.replace('{n}', String(hero.freePoints)),
            ),
            ...(this.touch ? [] : [keyBadge('P')]),
        );
        this.heroButton?.classList.toggle('sb-ib--points', hero.freePoints > 0);
    }

    /** The skill diamond: filling while it recharges, dim when short of mana. */
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
        const key = `${skill.name}|${Math.ceil(share * 30)}|${short}|${active}`;

        if (key === this.skillKey) {
            return;
        }

        this.skillKey = key;
        this.skill.hidden = false;
        this.skill.title = `${t.skills[skill.name][0]} — ${t.skills[skill.name][1]}${this.touch ? '' : ' (G)'}`;
        this.skillFill.style.height = `${(1 - share) * 100}%`;
        this.skillCost.textContent = String(skill.cost);
        this.skill.classList.toggle('sb-skill--short', short);
        this.skill.classList.toggle('sb-skill--active', active);
        this.skill.classList.toggle('sb-skill--ready', share === 0 && !short);
    }

    /** A banner across the screen: the new level, and points to put in. */
    levelUp(level: number, freePoints: number): void {
        this.banner.replaceChildren(
            element('strong', '', `${t.level_short} ${level}`),
            element(
                'span',
                '',
                freePoints > 0
                    ? `${t.level_up} · ${t.free_points}: ${freePoints}${this.touch ? '' : ' — P'}`
                    : t.level_up,
            ),
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

    /** Hotbar slots, the held item's line and the totals of carried resources. */
    setInventory(inventory: Inventory): void {
        Array.from(this.hotbar.children).forEach((cell, slot) => {
            if (slot >= HOTBAR) {
                return;
            }

            const stack = inventory.slots[slot];
            const worn =
                stack && ITEMS[stack.item].durability ? condition(stack) : null;
            cell.classList.toggle(
                'sb-hotbar__slot--selected',
                slot === inventory.selected,
            );
            (cell as HTMLElement).title = stack ? t.items[stack.item][0] : '';
            cell.innerHTML =
                `<span class="sb-slot__no">${slot + 1}</span>` +
                (stack
                    ? `<span class="sb-icon">${ITEMS[stack.item].icon}</span>` +
                      (stack.count > 1
                          ? `<span class="sb-slot__count">${stack.count}</span>`
                          : '') +
                      (worn !== null
                          ? `<span class="sb-wear${worn < 0.25 ? ' sb-wear--low' : ''}"><span style="width:${Math.round(worn * 100)}%"></span></span>` +
                            (worn < 0.25
                                ? '<span class="sb-slot__warn"></span>'
                                : '')
                          : '')
                    : '');
        });

        const held = inventory.held;
        const durability = held ? ITEMS[held.item].durability : undefined;
        const heldKey = held ? `${held.item}|${held.wear ?? 0}` : '';

        if (heldKey !== this.heldKey) {
            this.heldKey = heldKey;
            this.held.replaceChildren(
                ...(held
                    ? [
                          element('b', '', t.items[held.item][0]),
                          ...(durability
                              ? [
                                    element(
                                        'span',
                                        '',
                                        `${t.durability} ${durability - (held.wear ?? 0)} / ${durability}`,
                                    ),
                                ]
                              : []),
                      ]
                    : []),
            );
        }

        const resources = (Object.keys(ITEMS) as ItemId[])
            .filter(
                (item) =>
                    !ITEMS[item].durability &&
                    !ITEMS[item].tool &&
                    !ITEMS[item].placeable,
            )
            .map((item) => [item, inventory.total(item)] as const)
            .filter(([, count]) => count > 0);

        this.strip.hidden = resources.length === 0;
        this.strip.replaceChildren(
            ...resources.map(([item, count]) => {
                const chip = element('span', 'sb-strip__item');
                chip.title = t.items[item][0];
                const picture = element('span', 'sb-icon');
                picture.innerHTML = ITEMS[item].icon;
                chip.append(picture, element('span', '', String(count)));

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

    /** Puts a line on top of the feed, keeping at most four. */
    private pushFeed(line: HTMLElement): void {
        this.feed.prepend(line);

        while (this.feed.children.length > 4) {
            this.feed.lastElementChild?.remove();
        }
    }

    /** Adds to a growing feed line, or starts one. */
    private bump(
        key: string,
        svg: string,
        label: string,
        added: number,
        total: string,
        tone: 'plain' | 'xp',
    ): void {
        const existing = this.feedLines.get(key);

        if (existing && existing.element.isConnected) {
            existing.added += added;
            existing.count.textContent = `+${existing.added}`;
            existing.total.textContent = total;
            window.clearTimeout(existing.timer);
            existing.timer = this.forget(key, existing.element);
            this.feed.prepend(existing.element);
            existing.element.classList.remove('sb-feed__line--bump');
            void existing.element.offsetWidth;
            existing.element.classList.add('sb-feed__line--bump');

            return;
        }

        const line = element(
            'div',
            `sb-plate sb-feed__line sb-feed__line--${tone}`,
        );
        const picture = element('span', 'sb-icon');
        picture.innerHTML = svg;
        const count = element('b', 'sb-feed__count', `+${added}`);
        const totalText = element('span', 'sb-feed__total', total);
        line.append(
            picture,
            count,
            element('span', 'sb-feed__text', label),
            totalText,
        );
        this.pushFeed(line);
        this.feedLines.set(key, {
            element: line,
            count,
            total: totalText,
            added,
            timer: this.forget(key, line),
        });
    }

    /** Takes a growing line away once it has stood long enough. */
    private forget(key: string, line: HTMLElement): number {
        return window.setTimeout(() => {
            line.remove();

            if (this.feedLines.get(key)?.element === line) {
                this.feedLines.delete(key);
            }
        }, FEED_MS);
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
