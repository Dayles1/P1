/**
 * The artifacts tab: every artifact there is, by tier — common, rare,
 * legendary — as tiles showing how many are carried and how often each
 * has been absorbed; and the chosen one on the right: what absorbing it
 * gives, what it does while carried, where it is found, and the buttons
 * to absorb it, recycle it into essence or, for a legendary one, fuse it
 * from what it takes. Enter presses the main button.
 */

import {
    ARTIFACT_LIST,
    essenceOf,
    fusionFor,
    TIERS,
    tierOf,
} from '../artifacts';
import { artifactRules } from '../hero';
import type { BonusKey } from '../hero';
import { t } from '../i18n';
import { ITEMS } from '../items';
import type { ArtifactId } from '../items';
import { button, element, escape } from './dom';
import { keyBadge } from './hud';
import type { MenuHost, TabView } from './menu';

/** Bonuses given as a share rather than in points. */
const SHARES: BonusKey[] = ['speed', 'jump', 'swim', 'breath', 'gather'];

/** Rare artifacts help while carried too (their item description says how). */
const CARRIED: ArtifactId[] = [
    'golden_clover',
    'forest_heart',
    'sun_stone',
    'frost_crystal',
    'wind_feather',
];

/** What absorbing an artifact gives, line by line ("+2 Strength"…). */
export function absorbLines(artifact: string): string[] {
    const rules = artifactRules(artifact);

    if (!rules) {
        return [];
    }

    const lines: string[] = [];

    for (const [attribute, amount] of Object.entries(rules.attributes ?? {})) {
        lines.push(
            `+${amount} ${t.attributes[attribute as keyof typeof t.attributes][0]}`,
        );
    }

    for (const [key, amount] of Object.entries(rules.bonus ?? {})) {
        const bonus = key as BonusKey;

        if (bonus === 'light') {
            lines.push(t.bonuses.light);
        } else if (SHARES.includes(bonus)) {
            lines.push(
                `+${Math.round((amount ?? 0) * 100)}% ${t.bonuses[bonus]}`,
            );
        } else {
            lines.push(`+${amount} ${t.bonuses[bonus]}`);
        }
    }

    if (rules.skill) {
        const [name, about] = t.passives[rules.skill];
        lines.push(`${name}: ${about}`);
    }

    return lines;
}

export class ArtifactsTab implements TabView {
    readonly element: HTMLElement;
    private top: HTMLElement;
    private list: HTMLElement;
    private detail: HTMLElement;
    private chosen: ArtifactId = 'strength_rune';

    constructor(private host: MenuHost) {
        this.element = element('div', 'sb-relics');
        this.top = element('div', 'sb-relics__top');
        this.list = element('div', 'sb-relics__list');
        this.detail = element('section', 'sb-details sb-relics__detail');
        const body = element('div', 'sb-relics__body');
        body.append(this.list, this.detail);
        this.element.append(this.top, body);
    }

    /** Enter: fuse a legendary one that can be made, else absorb. */
    primary(): void {
        this.detail
            .querySelector<HTMLButtonElement>(
                '.sb-details__actions .sb-button--primary',
            )
            ?.click();
    }

    render(): void {
        const inventory = this.host.inventory;
        const essence = element('div', 'sb-knowledge');
        essence.innerHTML = `<span class="sb-icon">${ITEMS.essence.icon}</span>`;
        essence.append(
            element('span', '', `${t.items.essence[0]}: `),
            element('b', '', String(inventory.total('essence'))),
        );
        this.top.replaceChildren(
            essence,
            element('p', 'sb-hint', t.artifacts_hint),
        );

        const hero = this.host.hero();
        this.list.replaceChildren(
            ...TIERS.map((tier) => {
                const section = element(
                    'section',
                    `sb-relics__tier sb-relics__tier--${tier}`,
                );
                section.append(
                    element('h3', '', t.tiers[tier]),
                    element('p', 'sb-hint', t.tier_where[tier]),
                );
                const grid = element('div', 'sb-relics__grid');

                for (const artifact of ARTIFACT_LIST[tier]) {
                    const owned = inventory.total(artifact);
                    const rules = artifactRules(artifact);
                    const taken = hero?.absorbed[artifact] ?? 0;
                    const tile = element(
                        'button',
                        `sb-relic sb-relic--${tier}${owned ? ' sb-relic--owned' : ''}${artifact === this.chosen ? ' sb-relic--chosen' : ''}${rules && taken >= rules.max ? ' sb-relic--done' : ''}`,
                    );
                    tile.type = 'button';
                    tile.title = t.items[artifact][0];
                    tile.innerHTML = `
                        <span class="sb-icon sb-icon--large">${ITEMS[artifact].icon}</span>
                        <span class="sb-relic__name">${escape(t.items[artifact][0])}</span>
                        ${owned ? `<span class="sb-relic__count">×${owned}</span>` : ''}
                        <span class="sb-relic__dots">${Array.from({ length: rules?.max ?? 0 }, (_, index) => `<i class="${index < taken ? 'on' : ''}"></i>`).join('')}</span>`;
                    tile.addEventListener('click', () => {
                        this.chosen = artifact;
                        this.render();
                    });
                    grid.append(tile);
                }

                section.append(grid);

                return section;
            }),
        );

        this.renderDetail();
    }

    private renderDetail(): void {
        const artifact = this.chosen;
        const inventory = this.host.inventory;
        const hero = this.host.hero();
        const rules = artifactRules(artifact);
        const tier = tierOf(artifact);
        const owned = inventory.total(artifact);
        const taken = hero?.absorbed[artifact] ?? 0;
        const max = rules?.max ?? 0;
        const gives = absorbLines(artifact)
            .map((line) => `<li>${escape(line)}</li>`)
            .join('');

        this.detail.innerHTML = `
            <div class="sb-details__head">
                <span class="sb-icon sb-icon--large">${ITEMS[artifact].icon}</span>
                <div>
                    <strong>${escape(t.items[artifact][0])}</strong>
                    <small class="sb-tier sb-tier--${tier}">${escape(t.tiers[tier])}</small>
                </div>
            </div>
            <h4>${escape(t.absorb_gives)}</h4>
            <ul class="sb-gives">${gives}</ul>
            ${CARRIED.includes(artifact) ? `<h4>${escape(t.carry_gives)}</h4><p>${escape(t.items[artifact][1])}</p>` : ''}
            <dl class="sb-derived sb-derived--wide">
                <dt>${escape(t.absorbed_count)}</dt><dd>${taken} / ${max}</dd>
                <dt>${escape(t.owned)}</dt><dd>${owned}</dd>
                <dt>${escape(t.recycle_gives)}</dt><dd>+${essenceOf(artifact)} ${escape(t.items.essence[0])}</dd>
            </dl>
            <p class="sb-hint">${escape(t.tier_where[tier])}</p>`;

        const actions = element('div', 'sb-details__actions');
        const fusion = fusionFor(artifact);

        if (fusion) {
            const needs = fusion.needs
                .map(([item, count]) => {
                    const have = inventory.total(item);

                    return `<li class="${have >= count ? '' : 'sb-short'}"><span class="sb-icon">${ITEMS[item].icon}</span><span>${escape(t.items[item][0])}</span><b>${Math.min(have, count)}/${count}</b></li>`;
                })
                .join('');
            const block = element('div', '');
            block.innerHTML = `<h4>${escape(t.fusion_needs)}</h4><ul class="sb-needs">${needs}</ul>`;
            this.detail.append(block);

            const ready =
                fusion.needs.every(
                    ([item, count]) => inventory.total(item) >= count,
                ) && inventory.room(artifact, 1) > 0;
            const fuse = button(
                `sb-button${ready ? ' sb-button--primary' : ''}`,
                t.fuse,
                () => this.host.fuse(fusion),
                'fuse',
            );
            fuse.disabled = !ready;
            actions.append(fuse);
        }

        const slot = inventory.slots.findIndex(
            (stack) => stack?.item === artifact,
        );
        const absorb = button(
            `sb-button${slot >= 0 && hero && taken < max ? ' sb-button--primary' : ''}`,
            t.absorb,
            () => this.host.absorb(slot),
            'absorb',
        );
        absorb.disabled = slot < 0 || !hero || taken >= max;
        const recycle = button(
            'sb-button',
            t.recycle,
            () => this.host.recycle(slot),
            'recycle',
        );
        recycle.disabled = slot < 0;
        actions.append(absorb, recycle);

        const first = actions.querySelector<HTMLButtonElement>(
            '.sb-button--primary',
        );

        if (first && !this.host.touch) {
            first.append(keyBadge(t.enter));
        }

        this.detail.append(actions);
    }
}
