/**
 * The card to make a hero, shown before the first game (and once to a
 * player from before heroes): the four classes, man or woman, what that
 * makes of the attributes and the figures that follow from them, the
 * class skill, and the figure itself turning slowly in a little 3D
 * preview, dressed and built the way it will be in the world.
 *
 * On a computer 1–4 pick the class, 5–6 the gender and Enter sets off.
 */

import {
    ATTRIBUTES,
    deriveAll,
    GENDERS,
    HERO_CLASSES,
    RULES,
    startingAttributes,
} from '../hero';
import type { Gender, HeroClass } from '../hero';
import { t } from '../i18n';
import { TOUCH } from '../input';
import type { ItemId } from '../items';
import { button, element } from './dom';
import { keyBadge } from './hud';
import { Portrait } from './portrait';

/** What each class holds in the preview. */
const WEAPONS: Record<HeroClass, ItemId> = {
    tank: 'war_hammer',
    fighter: 'iron_sword',
    assassin: 'dagger',
    mage: 'staff',
};

/** The biggest an attribute bar shows at the start. */
const BAR_TOP = 20;

export class CreateHero {
    private element: HTMLElement;
    private classButtons = new Map<HeroClass, HTMLButtonElement>();
    private genderButtons = new Map<Gender, HTMLButtonElement>();
    private details: HTMLElement;
    private heroClass: HeroClass = 'fighter';
    private gender: Gender = 'male';
    private portrait = new Portrait('sb-create__preview');

    constructor(
        root: HTMLElement,
        returning: boolean,
        private done: (heroClass: HeroClass, gender: Gender) => void,
    ) {
        this.element = element('div', 'sb-overlay sb-create');
        const card = element('div', 'sb-card sb-create__card');
        const side = element('div', 'sb-create__side');

        side.append(element('h1', '', t.hero_title));

        if (returning) {
            side.append(element('p', 'sb-hint', t.hero_keeps));
        }

        side.append(element('h3', '', t.hero_pick_class));
        const classes = element('div', 'sb-create__classes');

        HERO_CLASSES.forEach((heroClass, index) => {
            const choice = button(
                'sb-create__class',
                t.classes[heroClass][0],
                () => this.pick(heroClass, this.gender),
            );

            if (!TOUCH) {
                choice.append(keyBadge(String(index + 1)));
            }

            this.classButtons.set(heroClass, choice);
            classes.append(choice);
        });

        side.append(classes, element('h3', '', t.hero_pick_gender));
        const genders = element('div', 'sb-create__genders');

        GENDERS.forEach((gender, index) => {
            const choice = button('sb-chip', t.genders[gender], () =>
                this.pick(this.heroClass, gender),
            );

            if (!TOUCH) {
                choice.append(keyBadge(String(index + 5)));
            }

            this.genderButtons.set(gender, choice);
            genders.append(choice);
        });

        side.append(genders, element('p', 'sb-hint', t.hero_gender_note));
        this.details = element('div', 'sb-create__details');
        const start = button(
            'sb-button sb-button--primary sb-button--wide',
            t.hero_start,
            () => this.finish(),
            'play',
        );

        if (!TOUCH) {
            start.append(keyBadge('Enter'));
        }

        side.append(this.details, start);
        card.append(this.portrait.element, side);
        this.element.append(card);
        root.append(this.element);

        this.pick(this.heroClass, this.gender);
        window.addEventListener('keydown', this.keyDown);
    }

    dispose(): void {
        window.removeEventListener('keydown', this.keyDown);
        this.portrait.dispose();
        this.element.remove();
    }

    private finish(): void {
        this.done(this.heroClass, this.gender);
    }

    private keyDown = (event: KeyboardEvent): void => {
        const digit = Number(event.key);

        if (event.code === 'Enter' || event.code === 'NumpadEnter') {
            event.preventDefault();
            event.stopImmediatePropagation();
            this.finish();
        } else if (digit >= 1 && digit <= HERO_CLASSES.length) {
            this.pick(HERO_CLASSES[digit - 1], this.gender);
        } else if (digit >= 5 && digit < 5 + GENDERS.length) {
            this.pick(this.heroClass, GENDERS[digit - 5]);
        }
    };

    private pick(heroClass: HeroClass, gender: Gender): void {
        this.heroClass = heroClass;
        this.gender = gender;

        for (const [each, choice] of this.classButtons) {
            choice.classList.toggle(
                'sb-create__class--active',
                each === heroClass,
            );
        }

        for (const [each, choice] of this.genderButtons) {
            choice.classList.toggle('sb-chip--active', each === gender);
        }

        const attributes = startingAttributes(heroClass, gender);
        const plain = startingAttributes(heroClass, 'male');
        const derived = deriveAll(attributes);
        const skill = RULES.skills[heroClass];
        const rows = ATTRIBUTES.map((attribute) => {
            const shift = attributes[attribute] - plain[attribute];
            const [name, about] = t.attributes[attribute];

            return `<div class="sb-attribute">
                <span class="sb-attribute__name" title="${about}">${name}</span>
                <span class="sb-attribute__bar"><span style="width:${(attributes[attribute] / BAR_TOP) * 100}%"></span></span>
                <b>${attributes[attribute]}${shift ? `<small class="${shift > 0 ? 'sb-up' : 'sb-down'}">${shift > 0 ? '+' : ''}${shift}</small>` : ''}</b>
            </div>`;
        }).join('');

        this.details.innerHTML = `
            <p class="sb-create__about">${t.classes[heroClass][1]}</p>
            <div class="sb-attributes">${rows}</div>
            <dl class="sb-derived">
                <dt>${t.derived.health}</dt><dd>${derived.health}</dd>
                <dt>${t.derived.mana}</dt><dd>${derived.mana}</dd>
                <dt>${t.derived.stamina}</dt><dd>${derived.stamina}</dd>
                <dt>${t.derived.defense}</dt><dd>${derived.defense}</dd>
                <dt>${t.derived.speed}</dt><dd>${Math.round(derived.speed * 100)}%</dd>
                <dt>${t.derived.crit}</dt><dd>${Math.round(derived.crit * 100)}%</dd>
            </dl>
            <p class="sb-create__skill"><b>${t.skill_title}: ${t.skills[skill.name][0]}</b> — ${t.skills[skill.name][1]}</p>`;

        this.portrait.show(
            { heroClass, gender, attributes },
            WEAPONS[heroClass],
        );
    }
}
