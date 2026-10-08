/**
 * The game menu: one window with tabs — inventory, crafting, character,
 * settings — and, while a chest is open, the chest. It slides in and out;
 * the ✕, Esc or a tap outside closes it. On a phone held sideways it
 * fills the screen, with everything sized for thumbs.
 */

import type { Tab } from '../i18n';
import { t } from '../i18n';
import type { Inventory } from '../inventory';
import type { ArmorSlot } from '../items';
import type { Recipe, Station } from '../recipes';
import type { Quality, Settings } from '../settings';
import type { Stats } from '../stats';
import type { Structure } from '../world/structures';
import { BagTab } from './bag-tab';
import { ChestTab } from './chest-tab';
import { CraftTab } from './craft-tab';
import { button, element } from './dom';
import { HeroTab } from './hero-tab';
import type { IconName } from './icons';
import { SettingsTab } from './settings-tab';

/** What the menu needs from the game. */
export interface MenuHost {
    inventory: Inventory;
    settings: Settings;
    graphics: { gpu: string; software: boolean; smoothing: boolean };
    health: () => number;
    stats: () => Stats;
    stations: () => Record<Station, boolean>;
    muted: () => boolean;
    craft: (recipe: Recipe) => void;
    drop: (index: number, count: number) => void;
    consume: (index: number) => void;
    equip: (index: number) => void;
    unequip: (slot: ArmorSlot, index: number | null) => void;
    chestChanged: () => void;
    changeSettings: (change: Partial<Settings>) => void;
    toggleMute: () => void;
    close: () => void;
}

export interface TabView {
    element: HTMLElement;
    render: () => void;
}

const TABS: [Tab, IconName][] = [
    ['bag', 'bag'],
    ['craft', 'craft'],
    ['hero', 'hero'],
    ['settings', 'settings'],
    ['chest', 'chest'],
];

export class Menu {
    private element: HTMLElement;
    private body: HTMLElement;
    private buttons = new Map<Tab, HTMLButtonElement>();
    private views: Record<Exclude<Tab, 'chest'>, TabView>;
    private chestView: ChestTab;
    private current: Tab = 'bag';
    private closing = 0;
    chest: Structure | null = null;

    constructor(
        root: HTMLElement,
        private host: MenuHost,
    ) {
        this.element = element('div', 'sb-menu');
        this.element.hidden = true;

        const sheet = element('div', 'sb-menu__sheet');
        const header = element('header', 'sb-menu__header');
        const tabs = element('nav', 'sb-tabs');

        for (const [tab, iconName] of TABS) {
            const tabButton = button(
                'sb-tab',
                t.tabs[tab],
                () => this.switchTo(tab),
                iconName,
            );
            this.buttons.set(tab, tabButton);
            tabs.append(tabButton);
        }

        header.append(
            tabs,
            button('sb-round sb-menu__close', '', () => host.close(), 'close'),
        );

        this.body = element('div', 'sb-menu__body');
        sheet.append(header, this.body);
        this.element.append(sheet);
        this.element.addEventListener('pointerdown', (event) => {
            if (event.target === this.element) {
                host.close();
            }
        });
        root.append(this.element);

        this.views = {
            bag: new BagTab(host),
            craft: new CraftTab(host),
            hero: new HeroTab(host),
            settings: new SettingsTab(host),
        };
        this.chestView = new ChestTab(host, () => this.chest);
    }

    get open(): boolean {
        return this.element.classList.contains('sb-menu--open');
    }

    get tab(): Tab {
        return this.current;
    }

    show(tab: Tab, chest: Structure | null = null): void {
        window.clearTimeout(this.closing);
        this.chest = chest;
        this.element.hidden = false;
        this.switchTo(tab);
        // Let the browser lay it out closed first, so it slides in.
        void this.element.offsetWidth;
        this.element.classList.add('sb-menu--open');
    }

    hide(): void {
        this.element.classList.remove('sb-menu--open');
        this.chest = null;
        window.clearTimeout(this.closing);
        this.closing = window.setTimeout(() => {
            this.element.hidden = true;
        }, 220);
    }

    /** Redraws the open tab (after the inventory changed). */
    render(): void {
        if (this.open) {
            this.view(this.current).render();
        }
    }

    /** The quality picked in the settings, for the smoothing note. */
    qualityChanged(quality: Quality): void {
        (this.views.settings as SettingsTab).noteQuality(quality);
    }

    switchTo(tab: Tab): void {
        if (tab === 'chest' && !this.chest) {
            tab = 'bag';
        }

        this.current = tab;

        for (const [each, tabButton] of this.buttons) {
            tabButton.classList.toggle('sb-tab--active', each === tab);
            tabButton.hidden = each === 'chest' && !this.chest;
        }

        const view = this.view(tab);
        this.body.replaceChildren(view.element);
        view.render();
    }

    private view(tab: Tab): TabView {
        return tab === 'chest' ? this.chestView : this.views[tab];
    }
}
