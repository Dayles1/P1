/**
 * The crafting tab: filters by group (tools, weapons, armour, building,
 * survival) and "can make now" across the top, the recipes on the left —
 * the ones that can be made first — and the chosen recipe on the right:
 * what it takes, what is missing, where it has to be made, and a big
 * button to make it.
 */

import { t } from '../i18n';
import { ITEMS } from '../items';
import { RECIPE_GROUPS, RECIPES } from '../recipes';
import type { Recipe, RecipeGroup } from '../recipes';
import { button, element, escape, icon } from './dom';
import type { MenuHost, TabView } from './menu';

type Filter = RecipeGroup | 'all' | 'ready';

export class CraftTab implements TabView {
    readonly element: HTMLElement;
    private filters: HTMLElement;
    private list: HTMLElement;
    private detail: HTMLElement;
    private filter: Filter = 'all';
    private chosen: Recipe | null = null;

    constructor(private host: MenuHost) {
        this.element = element('div', 'sb-craft');
        this.filters = element('nav', 'sb-chips');
        this.list = element('div', 'sb-craft__list');
        this.detail = element('section', 'sb-details sb-craft__detail');

        const body = element('div', 'sb-craft__body');
        body.append(this.list, this.detail);
        this.element.append(this.filters, body);
    }

    render(): void {
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
                const row = element(
                    'button',
                    `sb-recipe${ready ? ' sb-recipe--ready' : ''}${recipe === this.chosen ? ' sb-recipe--chosen' : ''}`,
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

                if (ready) {
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

        // What can be made now comes first; otherwise the order of the list.
        return recipes.sort(
            (a, b) => Number(this.ready(b)) - Number(this.ready(a)),
        );
    }

    private ready(recipe: Recipe): boolean {
        const inventory = this.host.inventory;

        return (
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

        const make = button(
            'sb-button sb-button--primary sb-button--wide',
            t.craft,
            () => this.host.craft(recipe),
            'craft',
        );
        make.disabled = !this.ready(recipe);
        const actions = element('div', 'sb-details__actions');
        actions.append(make);
        this.detail.append(actions);
    }
}
