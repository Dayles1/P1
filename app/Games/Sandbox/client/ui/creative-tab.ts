/**
 * The creative tab — test mode, only when config/sandbox.php allows it:
 *
 * - every item and resource there is: a click puts a full stack in the bag;
 * - any artifact: its type, rank and (when that rank gives one) skill,
 *   the points rolled as for a find; it goes straight to the store;
 * - the hero: levels up, health and mana to full, immortality.
 *
 * What it gives is saved like anything else; it does not count as found
 * or made for the score.
 */

import { artifactIcon, rollArtifact } from '../artifacts';
import { ARTIFACT_TYPES, artifactRules, PASSIVES, TOP_RANK } from '../hero';
import type { ArtifactType, Passive } from '../hero';
import { t } from '../i18n';
import { ITEMS } from '../items';
import type { ItemId } from '../items';
import { artifactName } from './artifacts-tab';
import { button, element } from './dom';
import type { MenuHost, TabView } from './menu';

export class CreativeTab implements TabView {
    readonly element: HTMLElement;
    private type: ArtifactType = 'stats';
    private rank = 1;
    private skill: Passive = PASSIVES[0];

    constructor(private host: MenuHost) {
        this.element = element('div', 'sb-creative');
    }

    render(): void {
        this.element.replaceChildren(
            element('p', 'sb-hint', t.creative.note),
            this.heroSection(),
            this.artifactSection(),
            this.itemSection(),
        );
    }

    private heroSection(): HTMLElement {
        const section = element('section', 'sb-creative__section');
        const actions = element('div', 'sb-creative__actions');
        const immortal = this.host.vitals().invulnerable;

        actions.append(
            button('sb-button', t.creative.level_up, () =>
                this.host.addLevels(1),
            ),
            button('sb-button', t.creative.ten_levels, () =>
                this.host.addLevels(10),
            ),
            button('sb-button', t.creative.max_level, () =>
                this.host.addLevels(Infinity),
            ),
            button('sb-button', t.creative.refill, () => this.host.refill()),
            button(
                `sb-button${immortal ? ' sb-button--primary' : ''}`,
                `${t.creative.immortal}: ${immortal ? '✓' : '—'}`,
                () => this.host.toggleImmortal(),
            ),
        );
        section.append(element('h3', '', t.creative.hero), actions);

        return section;
    }

    private artifactSection(): HTMLElement {
        const section = element('section', 'sb-creative__section');
        const rules = artifactRules(this.type, this.rank);
        const types = this.chips(
            ARTIFACT_TYPES.map((type) => [type, t.artifact_types[type]]),
            this.type,
            (type) => (this.type = type),
        );
        const ranks = this.chips(
            Array.from({ length: TOP_RANK }, (_, index) => [
                index + 1,
                `${index + 1} · ${t.ranks[index]}`,
            ]),
            this.rank,
            (rank) => (this.rank = rank),
        );
        const sample = rollArtifact(
            this.type,
            this.rank,
            Math.random,
            this.skill,
        );
        const give = button(
            'sb-button sb-button--primary',
            `${t.creative.give}: ${artifactName(sample)}`,
            () =>
                this.host.giveArtifact(
                    rollArtifact(this.type, this.rank, Math.random, this.skill),
                ),
        );
        give.prepend(this.icon(artifactIcon(sample)));

        section.append(
            element('h3', '', t.creative.artifacts),
            element('h4', '', t.creative.type),
            types,
            element('h4', '', t.rank),
            ranks,
        );

        if (rules?.skill) {
            section.append(
                element('h4', '', t.creative.skill),
                this.chips(
                    PASSIVES.map((name) => [name, t.passives[name][0]]),
                    this.skill,
                    (name) => (this.skill = name),
                ),
            );
        }

        section.append(give);

        return section;
    }

    private itemSection(): HTMLElement {
        const section = element('section', 'sb-creative__section');
        const grid = element('div', 'sb-creative__items');

        for (const item of Object.keys(ITEMS) as ItemId[]) {
            const tile = button('sb-creative__item', '', () =>
                this.host.giveItem(item),
            );
            tile.title = t.items[item][1];
            tile.append(
                this.icon(ITEMS[item].icon),
                element('span', '', t.items[item][0]),
            );
            grid.append(tile);
        }

        section.append(
            element('h3', '', t.creative.items),
            element('p', 'sb-hint', t.creative.items_hint),
            grid,
        );

        return section;
    }

    /** A row of chips; picking one redraws the tab. */
    private chips<V extends string | number>(
        options: [V, string][],
        current: V,
        pick: (value: V) => void,
    ): HTMLElement {
        const row = element('div', 'sb-create__chips');

        for (const [value, label] of options) {
            row.append(
                button(
                    `sb-chip${value === current ? ' sb-chip--active' : ''}`,
                    label,
                    () => {
                        pick(value);
                        this.render();
                    },
                ),
            );
        }

        return row;
    }

    private icon(svg: string): HTMLElement {
        const icon = element('span', 'sb-icon');
        icon.innerHTML = svg;

        return icon;
    }
}
