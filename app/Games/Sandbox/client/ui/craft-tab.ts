/**
 * The crafting tab: the knowledge points and filters by group (tools,
 * weapons, armour, building, survival) and "can make now" across the
 * top, the recipes on the left — the ones that can be made first, ones
 * still to be learnt with a lock — and the chosen recipe on the right:
 * what it takes, what is missing, where it has to be made, and a big
 * button to make it (or, while it is locked, to learn it for knowledge).
 * Enter presses that button.
 */

import { t } from '../i18n';
import { ITEMS } from '../items';
import { RECIPE_GROUPS, RECIPES } from '../recipes';
import type { Recipe, RecipeGroup } from '../recipes';
import { button, element, escape, icon } from './dom';
import { keyBadge } from './hud';
import type { MenuHost, TabView } from './menu';

type Filter = RecipeGroup | 'all' | 'ready';

export class CraftTab implements TabView {
    readonly element: HTMLElement;
    private filters: HTMLElement;
    private knowledge: HTMLElement;
    private list: HTMLElement;
    private detail: HTMLElement;
    private filter: Filter = 'all';
    private chosen: Recipe | null = null;

    constructor(private host: MenuHost) {
        this.element = element('div', 'sb-craft');
        this.filters = element('nav', 'sb-chips');
        this.knowledge = element('div', 'sb-knowledge');
        this.list = element('div', 'sb-craft__list');
        this.detail = element('section', 'sb-details sb-craft__detail');

        const top = element('div', 'sb-craft__top');
        top.append(this.knowledge, this.filters);
        const body = element('div', 'sb-craft__body');
        body.append(this.list, this.detail);
        this.element.append(top, body);
    }

    /** Enter: learn the chosen recipe while it is locked, else make it. */
    primary(): void {
        const recipe = this.chosen;

        if (!recipe) {
            return;
        }

        if (!this.known(recipe)) {
            this.host.learn(recipe);
        } else if (this.ready(recipe)) {
            this.host.craft(recipe);
        }
    }

    render(): void {
        this.knowledge.replaceChildren(
            icon('book'),
            element('span', '', `${t.knowledge}: `),
            element('b', '', String(this.host.research.points)),
        );
        this.knowledge.title = t.knowledge_hint;
        this.renderFilters();
        const recipes = this.visible();

        if (!this.chosen || !recipes.includes(this.chosen)) {
            this.chosen =
                recipes.find((recipe) => this.ready(recipe)) ??
                recipes[0] ??
                null;
        }

        this.list.replaceChildren(
            ...recipes.map((recipe) => {
                const ready = this.ready(recipe);
                const locked = !this.known(recipe);
                const row = element(
                    'button',
                    `sb-recipe${ready ? ' sb-recipe--ready' : ''}${locked ? ' sb-recipe--locked' : ''}${recipe === this.chosen ? ' sb-recipe--chosen' : ''}`,
                );
                row.type = 'button';
                row.innerHTML = `
                    <span class="sb-icon">${ITEMS[recipe.result].icon}</span>
                    <span class="sb-recipe__name">${escape(t.items[recipe.result][0])}${recipe.count > 1 ? ` ×${recipe.count}` : ''}</span>`;

                if (recipe.near) {
                    row.append(
                        icon(
                            recipe.near === 'fire' ? 'fire' : 'workbench',
                            `sb-ui-icon sb-recipe__station${this.host.stations()[recipe.near] ? '' : ' sb-short'}`,
                        ),
                    );
                }

                if (locked) {
                    row.append(icon('lock', 'sb-ui-icon sb-recipe__lock'));
                } else if (ready) {
                    row.append(icon('check', 'sb-ui-icon sb-recipe__ready'));
                }

                row.addEventListener('click', () => {
                    this.chosen = recipe;
                    this.render();
                });

                return row;
            }),
        );

        this.renderDetail();
    }

    private visible(): Recipe[] {
        const recipes = RECIPES.filter((recipe) =>
            this.filter === 'all'
                ? true
                : this.filter === 'ready'
                  ? this.ready(recipe)
                  : recipe.group === this.filter,
        );

        // What can be made now comes first, locked ones last; otherwise
        // the order of the list.
        const rank = (recipe: Recipe) =>
            this.ready(recipe) ? 0 : this.known(recipe) ? 1 : 2;

        return recipes.sort((a, b) => rank(a) - rank(b));
    }

    private known(recipe: Recipe): boolean {
        return this.host.research.knows(recipe.result);
    }

    private ready(recipe: Recipe): boolean {
        const inventory = this.host.inventory;

        return (
            this.known(recipe) &&
            (!recipe.near || this.host.stations()[recipe.near]) &&
            recipe.needs.every(
                ([item, count]) => inventory.total(item) >= count,
            ) &&
            inventory.room(recipe.result, recipe.count) > 0
        );
    }

    private renderFilters(): void {
        const filters: Filter[] = ['all', 'ready', ...RECIPE_GROUPS];

        this.filters.replaceChildren(
            ...filters.map((filter) => {
                const label =
                    filter === 'all'
                        ? t.all
                        : filter === 'ready'
                          ? t.craftable
                          : t.groups[filter];
                const chip = button(
                    `sb-chip${filter === this.filter ? ' sb-chip--active' : ''}`,
                    label,
                    () => {
                        this.filter = filter;
                        this.render();
                    },
                );

                return chip;
            }),
        );
    }

    private renderDetail(): void {
        const recipe = this.chosen;

        if (!recipe) {
            this.detail.innerHTML = `<p class="sb-details__empty">${escape(t.pick_recipe)}</p>`;

            return;
        }

        const inventory = this.host.inventory;
        const [name, description] = t.items[recipe.result];
        const needs = recipe.needs
            .map(([item, count]) => {
                const have = inventory.total(item);

                return `<li class="${have >= count ? '' : 'sb-short'}"><span class="sb-icon">${ITEMS[item].icon}</span><span>${escape(t.items[item][0])}</span><b>${Math.min(have, count)}/${count}</b></li>`;
            })
            .join('');

        this.detail.innerHTML = `
            <div class="sb-details__head">
                <span class="sb-icon sb-icon--large">${ITEMS[recipe.result].icon}</span>
                <strong>${escape(name)}${recipe.count > 1 ? ` × ${recipe.count}` : ''}</strong>
            </div>
            <p>${escape(description)}</p>
            <ul class="sb-needs">${needs}</ul>`;

        if (recipe.near) {
            const near = this.host.stations()[recipe.near];
            const station = element(
                'p',
                `sb-details__fact sb-station${near ? '' : ' sb-short'}`,
            );
            station.append(
                icon(recipe.near === 'fire' ? 'fire' : 'workbench'),
                element(
                    'span',
                    '',
                    recipe.near === 'fire' ? t.needs_fire : t.needs_workbench,
                ),
            );
            this.detail.append(station);
        }

        const actions = element('div', 'sb-details__actions');

        if (!this.known(recipe)) {
            const cost = recipe.research ?? 0;
            const points = this.host.research.points;
            const lock = element(
                'p',
                `sb-details__fact sb-station${points >= cost ? '' : ' sb-short'}`,
            );
            lock.append(
                icon('lock'),
                element(
                    'span',
                    '',
                    `${t.locked}: ${cost} ${t.research_cost} (${t.knowledge}: ${points})`,
                ),
            );
            const learn = button(
                'sb-button sb-button--primary sb-button--wide',
                `${t.research} · ${cost}`,
                () => this.host.learn(recipe),
                'book',
            );
            learn.disabled = points < cost;
            this.withKey(learn);
            actions.append(learn);
            this.detail.append(
                lock,
                element('p', 'sb-hint', t.knowledge_hint),
                actions,
            );

            return;
        }

        const make = button(
            'sb-button sb-button--primary sb-button--wide',
            t.craft,
            () => this.host.craft(recipe),
            'craft',
        );
        make.disabled = !this.ready(recipe);
        this.withKey(make);
        actions.append(make);
        this.detail.append(actions);
    }

    /** "Enter" on the main button, on a computer. */
    private withKey(target: HTMLButtonElement): void {
        if (!this.host.touch) {
            target.append(keyBadge(t.enter));
        }
    }
}
