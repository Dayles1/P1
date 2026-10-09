/**
 * Artifacts: the lineage tree and the store, as one board used twice —
 * in the artifacts tab and in the character tab's profile.
 *
 * - the tree: its open cells (an artifact, or an empty place) and the
 *   ones still to open, with the level they open at;
 * - the store: every artifact found and not in the tree, by rank;
 * - the chosen one: its rank (mortal or immortal), what it gives, and
 *   what can be done — merge it into the tree (into the first empty cell,
 *   or into any cell clicked while it is chosen: the one there goes back
 *   to the store), take it out of the tree, or merge three of a type and
 *   rank into one of the next.
 *
 * Enter merges the chosen artifact into the tree.
 */

import { artifactIcon, immortal, mergeGroup } from '../artifacts';
import { speciesOf } from '../gu';
import { ATTRIBUTES, RULES } from '../hero';
import type { Artifact, Hero, Passive } from '../hero';
import { t } from '../i18n';
import { button, element, escape } from './dom';
import { keyBadge } from './hud';
import type { MenuHost, TabView } from './menu';

type Chosen = { from: 'stash'; index: number } | { from: 'tree'; cell: number };

/** "Blood leech · Elite": its Gu and its rank. */
export function artifactName(artifact: Artifact): string {
    return `${t.gu[speciesOf(artifact)]} · ${t.ranks[artifact.rank - 1]}`;
}

/** A skill value as the player reads it: 12%, ×3, ∞, 240 s… */
function formatValue(name: Passive, key: string, value: number): string {
    if (name === 'second_wind' && key === 'cooldown') {
        return `${value} s`;
    }

    if (name === 'double_jump' && key === 'jumps') {
        return String(value);
    }

    if (name === 'water_breathing' && key === 'breath') {
        return value === 0 ? '∞' : `×${value}`;
    }

    if (name === 'radiance') {
        return `×${value}`;
    }

    if (name === 'regeneration') {
        return `+${value}`;
    }

    return `${Math.round(value * 100)}%`;
}

/** What a skill does at a rank, its numbers filled in. */
export function passiveAbout(name: Passive, rank: number): string {
    const values = RULES.artifact_skills[name] as Record<string, number[]>;

    return t.passives[name][1].replace(/\{(\w+)\}/g, (_, key: string) =>
        formatValue(name, key, values[key]?.[rank - 1] ?? 0),
    );
}

/** What an artifact gives, line by line ("+3 Strength", "Vampirism 6: …"). */
export function artifactLines(artifact: Artifact): string[] {
    const lines = ATTRIBUTES.filter(
        (attribute) => (artifact.points[attribute] ?? 0) > 0,
    ).map(
        (attribute) =>
            `+${artifact.points[attribute]} ${t.attributes[attribute][0]}`,
    );

    if (artifact.skill) {
        const { name, rank } = artifact.skill;
        lines.push(
            `${t.passives[name][0]} (${t.rank} ${rank}): ${passiveAbout(name, rank)}`,
        );
    }

    return lines;
}

/** The tree, the store and the chosen artifact. */
export class ArtifactBoard {
    readonly element: HTMLElement;
    private chosen: Chosen | null = null;

    constructor(
        private host: MenuHost,
        compact = false,
    ) {
        this.element = element(
            'div',
            `sb-board${compact ? ' sb-board--compact' : ''}`,
        );
    }

    /** Enter: merge the chosen artifact from the store into the tree. */
    primary(): void {
        this.element
            .querySelector<HTMLButtonElement>(
                '.sb-details__actions .sb-button--primary',
            )
            ?.click();
    }

    render(): void {
        const hero = this.host.hero();

        if (!hero) {
            this.element.replaceChildren();

            return;
        }

        this.keepChoiceValid(hero);

        const tree = element('section', 'sb-board__tree');
        tree.append(
            element('h3', '', t.tree_title),
            element('p', 'sb-hint', t.tree_hint),
            this.cells(hero),
        );

        const stash = element('section', 'sb-board__stash');
        stash.append(
            element(
                'h3',
                '',
                `${t.stash_title} · ${hero.stash.length} / ${RULES.artifacts.stash}`,
            ),
        );

        if (hero.stash.length === 0) {
            stash.append(element('p', 'sb-hint', t.stash_empty));
        } else {
            const grid = element('div', 'sb-board__grid');
            hero.stash.forEach((artifact, index) => {
                const chosen =
                    this.chosen?.from === 'stash' &&
                    this.chosen.index === index;
                grid.append(
                    this.tile(artifact, chosen, () => {
                        this.chosen = { from: 'stash', index };
                        this.render();
                    }),
                );
            });
            stash.append(grid);
        }

        this.element.replaceChildren(tree, stash, this.detail(hero));
    }

    /** The tree's cells: open (taken or empty) and the next ones to open. */
    private cells(hero: Hero): HTMLElement {
        const cells = element('div', 'sb-board__cells');
        const stashChosen = this.chosen?.from === 'stash';

        hero.tree.forEach((artifact, cell) => {
            const chosen =
                this.chosen?.from === 'tree' && this.chosen.cell === cell;
            const pick = () => {
                if (this.chosen?.from === 'stash') {
                    this.host.placeArtifact(this.chosen.index, cell);
                    this.chosen = { from: 'tree', cell };
                } else if (artifact) {
                    this.chosen = { from: 'tree', cell };
                }

                this.render();
            };

            if (artifact) {
                cells.append(this.tile(artifact, chosen, pick, stashChosen));
            } else {
                const empty = button(
                    `sb-cell sb-cell--empty${stashChosen ? ' sb-cell--target' : ''}`,
                    t.tree_empty,
                    pick,
                );
                cells.append(empty);
            }
        });

        for (const at of RULES.artifacts.tree_cells.slice(hero.tree.length)) {
            cells.append(
                element(
                    'div',
                    'sb-cell sb-cell--locked',
                    t.tree_locked.replace('{level}', String(at)),
                ),
            );
        }

        return cells;
    }

    private tile(
        artifact: Artifact,
        chosen: boolean,
        onClick: () => void,
        target = false,
    ): HTMLButtonElement {
        const tile = button(
            `sb-cell sb-cell--rank${artifact.rank}${immortal(artifact.rank) ? ' sb-cell--immortal' : ''}${chosen ? ' sb-cell--chosen' : ''}${target ? ' sb-cell--target' : ''}`,
            '',
            onClick,
        );
        tile.title = artifactName(artifact);
        tile.innerHTML = `
            <span class="sb-icon sb-icon--large">${artifactIcon(artifact)}</span>
            <span class="sb-cell__rank">${artifact.rank}</span>
            <span class="sb-cell__type">${artifact.type === 'skill' ? '✦' : '✚'}</span>`;

        return tile;
    }

    /** The chosen artifact: what it is, what it gives, what to do with it. */
    private detail(hero: Hero): HTMLElement {
        const detail = element('section', 'sb-details sb-board__detail');
        const chosen = this.chosen;
        const artifact =
            chosen?.from === 'stash'
                ? hero.stash[chosen.index]
                : chosen?.from === 'tree'
                  ? hero.tree[chosen.cell]
                  : null;

        if (!chosen || !artifact) {
            detail.append(element('p', 'sb-hint', t.artifacts_hint));

            return detail;
        }

        const layer = immortal(artifact.rank)
            ? t.layers.immortal
            : t.layers.mortal;
        detail.innerHTML = `
            <div class="sb-details__head">
                <span class="sb-icon sb-icon--large">${artifactIcon(artifact)}</span>
                <div>
                    <strong>${escape(artifactName(artifact))}</strong>
                    <small class="sb-rank sb-rank--${artifact.rank}">${escape(t.rank)} ${artifact.rank} · ${escape(layer)}</small>
                </div>
            </div>
            <h4>${escape(t.gives)}</h4>
            <ul class="sb-gives">${artifactLines(artifact)
                .map((line) => `<li>${escape(line)}</li>`)
                .join('')}</ul>`;

        const actions = element('div', 'sb-details__actions');

        if (chosen.from === 'stash') {
            const empty = hero.tree.indexOf(null);
            const place = button(
                `sb-button${empty >= 0 ? ' sb-button--primary' : ''}`,
                t.to_tree,
                () => {
                    this.host.placeArtifact(chosen.index, empty);
                    this.chosen = { from: 'tree', cell: empty };
                    this.render();
                },
                'absorb',
            );
            place.disabled = empty < 0;

            if (empty >= 0 && !this.host.touch) {
                place.append(keyBadge(t.enter));
            }

            const group = mergeGroup(hero.stash, chosen.index);
            const merge = button('sb-button', t.merge, () => {
                this.chosen = null;
                this.host.mergeArtifacts(chosen.index);
            });
            merge.disabled = !group;
            actions.append(place, merge);
            detail.append(
                actions,
                element('p', 'sb-hint', group ? t.choose_cell : t.merge_needs),
            );
        } else {
            const takeOut = button('sb-button', t.take_out, () => {
                this.chosen = null;
                this.host.takeOutArtifact(chosen.cell);
            });
            takeOut.disabled = hero.stashFull;
            actions.append(takeOut);
            detail.append(actions);
        }

        return detail;
    }

    /** Forgets a choice that is gone (merged, taken out, put in). */
    private keepChoiceValid(hero: Hero): void {
        const chosen = this.chosen;

        if (
            (chosen?.from === 'stash' && !hero.stash[chosen.index]) ||
            (chosen?.from === 'tree' && !hero.tree[chosen.cell])
        ) {
            this.chosen = null;
        }
    }
}

/** The artifacts tab: the board on its own. */
export class ArtifactsTab implements TabView {
    readonly element: HTMLElement;
    private board: ArtifactBoard;

    constructor(host: MenuHost) {
        this.board = new ArtifactBoard(host);
        this.element = this.board.element;
    }

    primary(): void {
        this.board.primary();
    }

    render(): void {
        this.board.render();
    }
}
