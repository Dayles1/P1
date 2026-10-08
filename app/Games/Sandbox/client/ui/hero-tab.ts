/**
 * The character tab: health and armour, what is worn, the five artifacts
 * (found ones with what they do, the rest as question marks with the
 * land they hide in) and what the player has done so far.
 */

import { t } from '../i18n';
import { ARMOR_SLOTS, ITEMS } from '../items';
import type { ArtifactId } from '../items';
import { MAX_HEALTH, throughArmor } from '../player/vitals';
import { STAT_KEYS } from '../stats';
import { element, escape, icon } from './dom';
import type { MenuHost, TabView } from './menu';

const ARTIFACTS: [ArtifactId, keyof typeof t.biomes][] = [
    ['golden_clover', 'meadow'],
    ['forest_heart', 'forest'],
    ['sun_stone', 'desert'],
    ['frost_crystal', 'snow'],
    ['wind_feather', 'mountains'],
];

export class HeroTab implements TabView {
    readonly element: HTMLElement;

    constructor(private host: MenuHost) {
        this.element = element('div', 'sb-hero');
    }

    render(): void {
        const inventory = this.host.inventory;
        const health = Math.ceil(this.host.health());
        const armor = inventory.armor;

        const card = element('section', 'sb-hero__card');
        card.innerHTML = `
            <div class="sb-hero__line">${escape(t.health)}<b>${health} / ${MAX_HEALTH}</b></div>
            <div class="sb-bar sb-bar--health sb-bar--large"><div class="sb-bar__fill" style="width:${(health / MAX_HEALTH) * 100}%"></div></div>
            <div class="sb-hero__line">${escape(t.armor)}<b>${armor} · ${Math.round((1 - throughArmor(armor)) * 100)}% ${escape(t.armor_blocks)}</b></div>`;

        const worn = element('div', 'sb-hero__worn');

        for (const part of ARMOR_SLOTS) {
            const stack = inventory.worn[part];
            const piece = element(
                'div',
                `sb-hero__piece${stack ? '' : ' sb-hero__piece--empty'}`,
            );
            piece.innerHTML = stack
                ? `<span class="sb-icon">${ITEMS[stack.item].icon}</span><span>${escape(t.items[stack.item][0])}</span>`
                : `<span class="sb-icon"></span><span>${escape(t.armor_slots[part])} —</span>`;
            worn.append(piece);
        }

        card.append(element('h3', '', t.equipment), worn);

        const artifacts = element('section', 'sb-hero__artifacts');
        artifacts.append(element('h3', '', t.artifacts));
        const shelf = element('div', 'sb-hero__shelf');

        for (const [artifact, biome] of ARTIFACTS) {
            const found = inventory.has(artifact);
            const tile = element(
                'div',
                `sb-artifact${found ? ' sb-artifact--found' : ''}`,
            );
            tile.innerHTML = found
                ? `<span class="sb-icon sb-icon--large">${ITEMS[artifact].icon}</span><strong>${escape(t.items[artifact][0])}</strong><small>${escape(t.items[artifact][1])}</small>`
                : `<span class="sb-artifact__unknown">?</span><strong>${escape(t.biomes[biome])}</strong><small>${escape(t.not_found)}</small>`;
            shelf.append(tile);
        }

        artifacts.append(shelf);

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
            } else {
                label.append(icon('star'));
            }

            label.append(element('span', '', t.stat_names[key]));
            rows.append(label, element('dd', '', String(stats[key])));
        }

        list.append(rows);
        this.element.replaceChildren(card, artifacts, list);
    }
}
