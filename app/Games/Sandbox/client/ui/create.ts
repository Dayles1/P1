/**
 * The awakening: the card to make a hero, shown before the first game
 * (and once to a player from before heroes), with the figure itself
 * turning slowly in a little 3D preview, bare-handed, built the way it
 * will be in the world. There is no class to pick — in the world of Gu
 * the Gu a hero raises decide the path; till then everyone starts as the
 * all-rounder (STARTING_CLASS). Two tabs:
 *
 * - the hero: a few words on the world, man or woman, what that makes of
 *   the attributes and the figures that follow from them;
 * - the look: realistic or anime (a setting of the device), hairstyle,
 *   hair colour, a beard (for a man) and the colour of the eyes.
 *
 * The same card changes the look of a hero already made (from the
 * character tab): then it shows only the look, and saves or cancels.
 *
 * On a computer 1–2 pick the gender, Enter sets off (or saves) and
 * Escape cancels a change.
 */

import { ATTRIBUTES, deriveAll, GENDERS, startingAttributes } from '../hero';
import type { Gender, Hero, HeroClass } from '../hero';
import { t } from '../i18n';
import { TOUCH } from '../input';
import { loadHuman } from '../player/human';
import {
    BEARDS,
    defaultAppearance,
    EYE_COLOR_NAMES,
    EYE_COLORS,
    HAIR_COLOR_NAMES,
    HAIR_COLORS,
    HAIR_STYLES,
} from '../player/looks';
import type { Appearance } from '../player/looks';
import { BODY_STYLES } from '../settings';
import type { BodyStyle } from '../settings';
import { button, element } from './dom';
import { keyBadge } from './hud';
import { Portrait } from './portrait';

/** The class every new hero has until the Gu decide the path: the all-rounder. */
const STARTING_CLASS: HeroClass = 'fighter';

/** The biggest an attribute bar shows at the start. */
const BAR_TOP = 20;

/** What the card ends with. */
export interface HeroChoice {
    heroClass: HeroClass;
    gender: Gender;
    style: BodyStyle;
    look: Appearance;
}

export interface CreateOptions {
    /** A player from before heroes: their things stay. */
    returning: boolean;
    style: BodyStyle;
    /** A hero already made, to change only the look of. */
    hero?: Hero;
    done: (choice: HeroChoice) => void;
    cancel?: () => void;
}

type Panel = 'hero' | 'look';

export class CreateHero {
    private element: HTMLElement;
    private side: HTMLElement;
    private heroClass: HeroClass;
    private gender: Gender;
    private style: BodyStyle;
    private look: Appearance;
    /** Until the look is touched it follows the gender's default. */
    private lookChosen: boolean;
    private panel: Panel;
    private portrait = new Portrait('sb-create__preview');

    constructor(
        root: HTMLElement,
        private options: CreateOptions,
    ) {
        const hero = options.hero;

        this.heroClass = hero?.heroClass ?? STARTING_CLASS;
        this.gender = hero?.gender ?? 'male';
        this.style = options.style;
        this.look = hero ? { ...hero.look } : defaultAppearance(this.gender);
        this.lookChosen = Boolean(hero);
        this.panel = hero ? 'look' : 'hero';

        this.element = element('div', 'sb-overlay sb-create');
        const card = element('div', 'sb-card sb-create__card');
        this.side = element('div', 'sb-create__side');
        card.append(this.portrait.element, this.side);
        this.element.append(card);
        root.append(this.element);

        // Both bodies ready, so a change of gender or hair (and starting) swaps at once.
        for (const gender of GENDERS) {
            void loadHuman(gender);
        }

        this.render();
        window.addEventListener('keydown', this.keyDown);
    }

    dispose(): void {
        window.removeEventListener('keydown', this.keyDown);
        this.portrait.dispose();
        this.element.remove();
    }

    private finish(): void {
        this.options.done({
            heroClass: this.heroClass,
            gender: this.gender,
            style: this.style,
            look: { ...this.look },
        });
    }

    private keyDown = (event: KeyboardEvent): void => {
        const digit = Number(event.key);
        const editing = Boolean(this.options.hero);

        if (event.code === 'Enter' || event.code === 'NumpadEnter') {
            event.preventDefault();
            event.stopImmediatePropagation();
            this.finish();
        } else if (event.code === 'Escape' && this.options.cancel) {
            event.preventDefault();
            event.stopImmediatePropagation();
            this.options.cancel();
        } else if (editing) {
            return;
        } else if (digit >= 1 && digit <= GENDERS.length) {
            this.pickGender(GENDERS[digit - 1]);
        }
    };

    private pickGender(gender: Gender): void {
        this.gender = gender;

        if (!this.lookChosen) {
            this.look = defaultAppearance(gender);
        } else if (gender === 'female') {
            this.look.beard = 'none';
        }

        this.render();
    }

    private changeLook(change: Partial<Appearance>): void {
        Object.assign(this.look, change);
        this.lookChosen = true;
        this.render();
    }

    private render(): void {
        const editing = Boolean(this.options.hero);
        const parts: HTMLElement[] = [
            element('h1', '', editing ? t.look_title : t.hero_title),
        ];

        if (this.options.returning && !editing) {
            parts.push(element('p', 'sb-hint', t.hero_keeps));
        }

        if (!editing) {
            const tabs = element('div', 'sb-segmented sb-create__tabs');

            for (const panel of ['hero', 'look'] as const) {
                tabs.append(
                    button(
                        `sb-segment${panel === this.panel ? ' sb-segment--active' : ''}`,
                        panel === 'hero' ? t.hero_tab_hero : t.hero_tab_look,
                        () => {
                            this.panel = panel;
                            this.render();
                        },
                    ),
                );
            }

            parts.push(tabs);
        }

        parts.push(
            ...(this.panel === 'hero' ? this.heroPanel() : this.lookPanel()),
        );

        const start = button(
            'sb-button sb-button--primary sb-button--wide',
            editing ? t.look_save : t.hero_start,
            () => this.finish(),
            editing ? undefined : 'play',
        );

        if (!TOUCH) {
            start.append(keyBadge('Enter'));
        }

        parts.push(start);

        if (editing && this.options.cancel) {
            const cancel = button(
                'sb-button sb-button--wide',
                t.look_cancel,
                () => this.options.cancel?.(),
            );

            if (!TOUCH) {
                cancel.append(keyBadge('Esc'));
            }

            parts.push(cancel);
        }

        this.side.replaceChildren(...parts);

        const attributes =
            this.options.hero?.attributes ??
            startingAttributes(this.heroClass, this.gender);

        this.portrait.show(
            {
                heroClass: this.heroClass,
                gender: this.gender,
                attributes,
                style: this.style,
                appearance: this.look,
            },
            null,
        );
    }

    /** The world in a few words, the gender, and what it makes of the hero. */
    private heroPanel(): HTMLElement[] {
        const genders = element('div', 'sb-create__chips');

        GENDERS.forEach((gender, index) => {
            const choice = this.chip(
                t.genders[gender],
                gender === this.gender,
                () => this.pickGender(gender),
            );

            if (!TOUCH) {
                choice.append(keyBadge(String(index + 1)));
            }

            genders.append(choice);
        });

        return [
            element('p', 'sb-create__intro', t.hero_intro),
            element('h3', '', t.hero_pick_gender),
            genders,
            element('p', 'sb-hint', t.hero_gender_note),
            this.details(),
        ];
    }

    /** Drawing style, hair, beard, eyes. */
    private lookPanel(): HTMLElement[] {
        const styles = element('div', 'sb-create__chips');

        for (const style of BODY_STYLES) {
            styles.append(
                this.chip(t.body_styles[style], style === this.style, () => {
                    this.style = style;
                    this.render();
                }),
            );
        }

        const hair = element('div', 'sb-create__chips');

        for (const style of HAIR_STYLES) {
            hair.append(
                this.chip(t.hair_styles[style], style === this.look.hair, () =>
                    this.changeLook({ hair: style }),
                ),
            );
        }

        const hairColors = element('div', 'sb-create__swatches');

        for (const color of HAIR_COLOR_NAMES) {
            hairColors.append(
                this.swatch(
                    t.hair_colors[color],
                    HAIR_COLORS[color],
                    color === this.look.hair_color,
                    () => this.changeLook({ hair_color: color }),
                ),
            );
        }

        const eyes = element('div', 'sb-create__swatches');

        for (const color of EYE_COLOR_NAMES) {
            eyes.append(
                this.swatch(
                    t.eye_colors[color],
                    EYE_COLORS[color],
                    color === this.look.eyes,
                    () => this.changeLook({ eyes: color }),
                ),
            );
        }

        const parts = [
            element('h3', '', t.body_style),
            styles,
            element('h3', '', t.hair_style),
            hair,
            element('h3', '', t.hair_color),
            hairColors,
        ];

        if (this.gender === 'male') {
            const beards = element('div', 'sb-create__chips');

            for (const beard of BEARDS) {
                beards.append(
                    this.chip(t.beards[beard], beard === this.look.beard, () =>
                        this.changeLook({ beard }),
                    ),
                );
            }

            parts.push(element('h3', '', t.beard), beards);
        }

        parts.push(element('h3', '', t.eye_color), eyes);

        return parts;
    }

    /** The starting attributes and the figures that follow from them. */
    private details(): HTMLElement {
        const heroClass = this.heroClass;
        const attributes = startingAttributes(heroClass, this.gender);
        const plain = startingAttributes(heroClass, 'male');
        const derived = deriveAll(attributes);
        const rows = ATTRIBUTES.map((attribute) => {
            const shift = attributes[attribute] - plain[attribute];
            const [name, about] = t.attributes[attribute];

            return `<div class="sb-attribute">
                <span class="sb-attribute__name" title="${about}">${name}</span>
                <span class="sb-attribute__bar"><span style="width:${(attributes[attribute] / BAR_TOP) * 100}%"></span></span>
                <b>${attributes[attribute]}${shift ? `<small class="${shift > 0 ? 'sb-up' : 'sb-down'}">${shift > 0 ? '+' : ''}${shift}</small>` : ''}</b>
            </div>`;
        }).join('');
        const details = element('div', 'sb-create__details');

        details.innerHTML = `
            <div class="sb-attributes">${rows}</div>
            <dl class="sb-derived">
                <dt>${t.derived.health}</dt><dd>${derived.health}</dd>
                <dt>${t.derived.mana}</dt><dd>${derived.mana}</dd>
                <dt>${t.derived.stamina}</dt><dd>${derived.stamina}</dd>
                <dt>${t.derived.defense}</dt><dd>${derived.defense}</dd>
                <dt>${t.derived.speed}</dt><dd>${Math.round(derived.speed * 100)}%</dd>
                <dt>${t.derived.crit}</dt><dd>${Math.round(derived.crit * 100)}%</dd>
            </dl>`;

        return details;
    }

    private chip(
        label: string,
        active: boolean,
        onClick: () => void,
    ): HTMLButtonElement {
        return button(
            `sb-chip${active ? ' sb-chip--active' : ''}`,
            label,
            onClick,
        );
    }

    private swatch(
        label: string,
        color: number,
        active: boolean,
        onClick: () => void,
    ): HTMLButtonElement {
        const swatch = button(
            `sb-swatch${active ? ' sb-swatch--active' : ''}`,
            '',
            onClick,
        );

        swatch.title = label;
        swatch.setAttribute('aria-label', label);
        swatch.style.setProperty(
            '--sb-swatch',
            `#${color.toString(16).padStart(6, '0')}`,
        );

        return swatch;
    }
}
