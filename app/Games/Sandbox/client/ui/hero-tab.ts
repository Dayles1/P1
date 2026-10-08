/**
 * The character tab, laid out to be read at a glance:
 *
 * - the profile: a turning 3D portrait of the hero as they are (build,
 *   clothes, armour, what is in hand), class, gender, level, experience,
 *   free points, the class skill and the skills from legendary artifacts;
 * - the attributes, each with where it comes from (class, levels, points,
 *   artifacts) and a "+" for every free point;
 * - the figures they make, in groups: survival, combat, movement and
 *   knowledge;
 * - the artifacts absorbed, what is worn, and what the player has done.
 */

import { ATTRIBUTES } from '../hero';
import type { Attribute } from '../hero';
import { t } from '../i18n';
import { ARMOR_SLOTS, ITEMS } from '../items';
import { throughArmor } from '../player/vitals';
import { STAT_KEYS } from '../stats';
import { absorbLines } from './artifacts-tab';
import { button, element, escape, icon } from './dom';
import { ICONS } from './icons';
import type { IconName } from './icons';
import type { MenuHost, TabView } from './menu';
import { Portrait } from './portrait';

const ATTRIBUTE_ICONS: Record<Attribute, IconName> = {
    strength: 'sword',
    agility: 'speed',
    spirit: 'spark',
};

const percent = (share: number) => `${Math.round(share * 100)}%`;

export class HeroTab implements TabView {
    readonly element: HTMLElement;
    private portrait = new Portrait('sb-profile__portrait');

    constructor(private host: MenuHost) {
        this.element = element('div', 'sb-hero');
    }

    render(): void {
        const hero = this.host.hero();

        this.element.replaceChildren(
            ...(hero
                ? [
                      this.profile(),
                      this.attributesCard(),
                      this.figuresCard(),
                      this.artifactsCard(),
                  ]
                : []),
            this.wornCard(),
            this.statsCard(),
        );
    }

    /** Portrait, name, level, experience, skills. */
    private profile(): HTMLElement {
        const hero = this.host.hero()!;
        const inventory = this.host.inventory;
        this.portrait.show(
            {
                heroClass: hero.heroClass,
                gender: hero.gender,
                attributes: hero.attributes,
            },
            inventory.held?.item ?? null,
            {
                head: inventory.worn.head?.item ?? null,
                body: inventory.worn.body?.item ?? null,
                feet: inventory.worn.feet?.item ?? null,
            },
        );

        const card = element('section', 'sb-hero__card sb-profile');
        const info = element('div', 'sb-profile__info');
        const skill = hero.skill;
        info.innerHTML = `
            <div class="sb-hero__title">
                <span class="sb-level sb-level--large">${hero.level}</span>
                <div>
                    <strong>${escape(t.classes[hero.heroClass][0])}</strong>
                    <small>${escape(t.genders[hero.gender])} · ${escape(t.level)} ${hero.level}${hero.maxed ? ` · ${escape(t.max_level)}` : ''}</small>
                </div>
            </div>
            <div class="sb-hero__line">${escape(t.xp)}<b>${hero.maxed ? '—' : `${hero.xp} / ${hero.toNext}`}</b></div>
            <div class="sb-xp sb-xp--large"><div class="sb-xp__fill" style="width:${hero.maxed ? 100 : (hero.xp / hero.toNext) * 100}%"></div></div>
            <div class="sb-skill-card">
                <span class="sb-skill-card__icon">${ICONS.spark}</span>
                <div>
                    <b>${escape(t.skills[skill.name][0])}${this.host.touch ? '' : ' <kbd class="sb-key">G</kbd>'}</b>
                    <small>${escape(t.skills[skill.name][1])}</small>
                    <small class="sb-skill-card__cost">${skill.cost} ${escape(t.mana)} · ${skill.cooldown} s</small>
                </div>
            </div>`;

        const passives = (
            [
                'double_jump',
                'water_breathing',
                'vampirism',
                'second_wind',
            ] as const
        ).filter((passive) => hero.has(passive));

        if (passives.length > 0) {
            const list = element('div', 'sb-passives');

            for (const passive of passives) {
                const chip = element(
                    'span',
                    'sb-passive',
                    t.passives[passive][0],
                );
                chip.title = t.passives[passive][1];
                list.append(chip);
            }

            info.append(list);
        }

        if (hero.freePoints > 0) {
            const note = element('p', 'sb-hero__points');
            note.append(
                icon('star'),
                element(
                    'span',
                    '',
                    `${t.free_points}: ${hero.freePoints}. ${t.points_hint}`,
                ),
            );
            info.append(note);
        }

        card.append(this.portrait.element, info);

        return card;
    }

    /** The attributes with where they come from, and "+" for free points. */
    private attributesCard(): HTMLElement {
        const hero = this.host.hero()!;
        const card = element('section', 'sb-hero__card');
        card.append(element('h3', '', t.attributes_title));
        const values = hero.attributes;
        const sources = hero.sources;
        const free = hero.freePoints;

        for (const attribute of ATTRIBUTES) {
            const [name, about] = t.attributes[attribute];
            const source = sources[attribute];
            const parts = [
                `${source.start} ${t.sources.start}`,
                source.levels ? `${source.levels} ${t.sources.levels}` : '',
                source.points ? `${source.points} ${t.sources.points}` : '',
                source.artifacts
                    ? `${source.artifacts} ${t.sources.artifacts}`
                    : '',
            ].filter(Boolean);

            const row = element('div', `sb-stat sb-stat--${attribute}`);
            const label = element('div', 'sb-stat__label');
            label.append(
                element('b', '', name),
                element('small', '', about),
                element('small', 'sb-stat__sources', parts.join(' + ')),
            );
            row.append(
                icon(ATTRIBUTE_ICONS[attribute], 'sb-ui-icon sb-stat__icon'),
                label,
                element('strong', 'sb-stat__value', String(values[attribute])),
            );

            if (free > 0) {
                const add = button(
                    'sb-round sb-attribute__add',
                    '',
                    () => this.host.spendPoint(attribute),
                    'plus',
                );
                add.title = t.add_point;
                add.setAttribute('aria-label', `${t.add_point}: ${name}`);
                row.append(add);
            }

            card.append(row);
        }

        return card;
    }

    /** The figures, grouped. */
    private figuresCard(): HTMLElement {
        const hero = this.host.hero()!;
        const vitals = this.host.vitals();
        const derived = hero.derived;
        const armor = this.host.armor();
        const card = element('section', 'sb-hero__card');
        card.append(element('h3', '', t.derived_title));

        const groups: [string, IconName, [string, string][]][] = [
            [
                t.groups_profile.survival,
                'heart',
                [
                    [
                        t.derived.health,
                        `${Math.ceil(vitals.health)} / ${vitals.maxHealth}`,
                    ],
                    [
                        t.derived.mana,
                        `${Math.floor(vitals.mana)} / ${vitals.maxMana}`,
                    ],
                    [
                        t.derived.stamina,
                        `${Math.round(vitals.stamina)} / ${vitals.maxStamina}`,
                    ],
                    [
                        t.derived.defense,
                        `${Math.round(armor * 10) / 10} · ${percent(1 - throughArmor(armor))} ${t.armor_blocks}`,
                    ],
                    [
                        t.regen,
                        `+${derived.healthRegen.toFixed(1)} ${t.health} · +${derived.manaRegen.toFixed(1)} ${t.mana} / s`,
                    ],
                ],
            ],
            [
                t.groups_profile.combat,
                'sword',
                [
                    [t.derived.damage, `×${derived.damage.toFixed(2)}`],
                    [t.derived.attack_speed, percent(derived.attackSpeed)],
                    [
                        t.derived.crit,
                        `${percent(derived.crit)} · ×${derived.critDamage}`,
                    ],
                ],
            ],
            [
                t.groups_profile.other,
                'speed',
                [
                    [t.derived.speed, percent(derived.speed)],
                    [t.jump, percent(1 + hero.bonus('jump'))],
                    [t.swim, percent(1 + hero.bonus('swim'))],
                    [t.derived.knowledge, `×${derived.knowledge.toFixed(2)}`],
                ],
            ],
        ];

        for (const [title, iconName, rows] of groups) {
            const group = element('div', 'sb-figures');
            const head = element('div', 'sb-figures__head');
            head.append(icon(iconName), element('span', '', title));
            const list = element('dl', 'sb-derived sb-derived--wide');
            list.innerHTML = rows
                .map(
                    ([label, value]) =>
                        `<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`,
                )
                .join('');
            group.append(head, list);
            card.append(group);
        }

        return card;
    }

    /** What the absorbed artifacts gave. */
    private artifactsCard(): HTMLElement {
        const hero = this.host.hero()!;
        const card = element('section', 'sb-hero__card');
        card.append(element('h3', '', t.absorbed_title));
        const absorbed = Object.entries(hero.absorbed).filter(
            ([, times]) => times > 0,
        );

        if (absorbed.length === 0) {
            card.append(element('p', 'sb-hint', t.none_absorbed));

            return card;
        }

        const list = element('div', 'sb-absorbed');

        for (const [artifact, times] of absorbed) {
            const row = element('div', 'sb-absorbed__row');
            const definition = ITEMS[artifact as keyof typeof ITEMS];
            row.innerHTML = `
                <span class="sb-icon">${definition.icon}</span>
                <div>
                    <b>${escape(t.items[artifact as keyof typeof t.items][0])}${times > 1 ? ` ×${times}` : ''}</b>
                    <small>${escape(absorbLines(artifact).join(' · '))}</small>
                </div>`;
            list.append(row);
        }

        card.append(list);

        return card;
    }

    private wornCard(): HTMLElement {
        const inventory = this.host.inventory;
        const card = element('section', 'sb-hero__card');
        const worn = element('div', 'sb-hero__worn');

        for (const part of ARMOR_SLOTS) {
            const stack = inventory.worn[part];
            const piece = element(
                'div',
                `sb-hero__piece${stack ? '' : ' sb-hero__piece--empty'}`,
            );
            piece.innerHTML = stack
                ? `<span class="sb-icon">${ITEMS[stack.item].icon}</span><span>${escape(t.items[stack.item][0])}<small>${escape(t.armor_slots[part])} · +${ITEMS[stack.item].armor?.points ?? 0} ${escape(t.armor)}</small></span>`
                : `<span class="sb-icon"></span><span>${escape(t.armor_slots[part])} —</span>`;
            worn.append(piece);
        }

        card.append(element('h3', '', t.equipment), worn);

        return card;
    }

    private statsCard(): HTMLElement {
        const stats = this.host.stats();
        const list = element('section', 'sb-hero__stats');
        list.append(element('h3', '', t.stats));
        const rows = element('dl', 'sb-stats');

        for (const key of STAT_KEYS) {
            const label = element('dt', '');

            if (
                key === 'deer' ||
                key === 'boar' ||
                key === 'wolf' ||
                key === 'zombie'
            ) {
                label.append(icon('sword'));
            } else if (key === 'deaths') {
                label.append(icon('skull'));
            } else if (key === 'researched') {
                label.append(icon('book'));
            } else if (key === 'artifacts') {
                label.append(icon('gem'));
            } else if (key === 'digs') {
                label.append(icon('shovel'));
            } else {
                label.append(icon('star'));
            }

            label.append(element('span', '', t.stat_names[key]));
            rows.append(label, element('dd', '', String(stats[key])));
        }

        list.append(rows);

        return list;
    }
}
